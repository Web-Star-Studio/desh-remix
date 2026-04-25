# WhatsApp Web Gateway — Servidor Node.js

Este é o servidor independente que você deve hospedar para usar a integração **WhatsApp Web (QR Code)** no DESH.

> ⚠️ **Aviso Legal**: Esta integração usa a API não oficial do WhatsApp Web. O uso pode violar os [Termos de Serviço do WhatsApp](https://www.whatsapp.com/legal/terms-of-service). Use por sua conta e risco. Recomendado apenas para contas pessoais ou ambientes de teste.

---

## Arquitetura

```
DESH Frontend
     │
     ▼
Edge Function "whatsapp-web-proxy"   ← autenticação JWT + roteamento
     │
     ▼  HTTP com X-Gateway-Secret
Node.js Gateway (este serviço)       ← whatsapp-web.js + Express
     │                                  processo persistente (Railway/Fly.io/VPS)
     ▼
Supabase DB                          ← persiste sessões, conversas e mensagens
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` com:

```env
# Token compartilhado com a Edge Function do DESH
# Deve ser igual ao secret WHATSAPP_WEB_GATEWAY_SECRET configurado no DESH
GATEWAY_SECRET=seu-token-secreto-aqui

# Supabase (use service_role para escrever direto nas tabelas)
SUPABASE_URL=https://fzidukdcyqsqajoebdfe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# URL da Edge Function whatsapp-session-proxy (M2M — heartbeats e zombie detection)
# Padrão derivado de SUPABASE_URL, mas pode ser sobrescrito
SESSION_PROXY_URL=https://fzidukdcyqsqajoebdfe.supabase.co/functions/v1/whatsapp-session-proxy

# Porta do servidor (Railway usa PORT automaticamente)
PORT=3000

# Diretório para persistir as sessões WA (evita re-escaneamento do QR)
SESSION_DIR=./wa-sessions
```

---

## Código Completo — `server.ts`

```typescript
import express from "express";
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const app = express();
app.use(express.json());

const GATEWAY_SECRET = process.env.GATEWAY_SECRET!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const SESSION_DIR = process.env.SESSION_DIR ?? "./wa-sessions";

// M2M proxy URL — defaults to <SUPABASE_URL>/functions/v1/whatsapp-session-proxy
const SESSION_PROXY_URL =
  process.env.SESSION_PROXY_URL ??
  `${SUPABASE_URL}/functions/v1/whatsapp-session-proxy`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Map of active clients: sessionId → Client instance
const clients = new Map<string, Client>();

// ── Auth Middleware ──────────────────────────────────────────────────────────
function requireSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secret = req.headers["x-gateway-secret"];
  if (secret !== GATEWAY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── Helper: PATCH session via whatsapp-session-proxy (M2M, used for heartbeats) ──
// Uses the shared GATEWAY_SECRET as Bearer token — no Supabase client needed.
async function patchSessionViaProxy(
  sessionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${SESSION_PROXY_URL}?session_id=${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GATEWAY_SECRET}`,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`proxy PATCH failed [${res.status}]: ${body}`);
  }
}

// ── Helper: update session status in Supabase (used for WA events) ──────────
async function updateSession(sessionId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("whatsapp_web_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (error) console.error(`[${sessionId}] DB update error:`, error.message);
}

// ── Helper: ensure/get conversation ─────────────────────────────────────────
async function ensureConversation(userId: string, phoneNumber: string): Promise<string> {
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("channel", "whatsapp_web")
    .eq("external_contact_id", phoneNumber)
    .single();

  if (data) return data.id;

  const { data: newConv, error: insertError } = await supabase
    .from("whatsapp_conversations")
    .insert({
      user_id: userId,
      channel: "whatsapp_web",
      external_contact_id: phoneNumber,
      title: phoneNumber,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      labels: [],
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  return newConv!.id;
}

// ── Helper: fetch userId from session ────────────────────────────────────────
async function getUserIdForSession(sessionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("whatsapp_web_sessions")
    .select("user_id")
    .eq("session_id", sessionId)
    .single();
  return data?.user_id ?? null;
}

// ── Create/Start Session ─────────────────────────────────────────────────────
async function startSession(sessionId: string): Promise<void> {
  if (clients.has(sessionId)) {
    console.log(`[${sessionId}] Session already active.`);
    return;
  }

  console.log(`[${sessionId}] Starting WhatsApp Web client...`);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: SESSION_DIR,
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  clients.set(sessionId, client);

  // QR Code event — convert to base64 PNG and persist in DB
  client.on("qr", async (qr) => {
    console.log(`[${sessionId}] QR received`);
    const qrBase64 = await qrcode.toDataURL(qr).then((d) => d.split(",")[1]);
    await updateSession(sessionId, {
      status: "QR_PENDING",
      last_qr_code: qrBase64,
    });
  });

  // Ready — session authenticated
  client.on("ready", async () => {
    console.log(`[${sessionId}] Client ready!`);
    await updateSession(sessionId, {
      status: "CONNECTED",
      last_qr_code: null,
      last_connected_at: new Date().toISOString(),
      last_error: null,
    });
  });

  // Disconnected
  client.on("disconnected", async (reason) => {
    console.log(`[${sessionId}] Disconnected: ${reason}`);
    clients.delete(sessionId);
    await updateSession(sessionId, {
      status: "DISCONNECTED",
      last_error: reason,
    });
  });

  // Auth failure
  client.on("auth_failure", async (msg) => {
    console.error(`[${sessionId}] Auth failure: ${msg}`);
    clients.delete(sessionId);
    await updateSession(sessionId, {
      status: "ERROR",
      last_error: `Auth failure: ${msg}`,
    });
  });

  // Inbound message — persist in whatsapp_conversations + whatsapp_messages
  client.on("message", async (msg) => {
    if (msg.fromMe) return; // handled separately on send

    const userId = await getUserIdForSession(sessionId);
    if (!userId) return;

    const phoneNumber = msg.from.replace("@c.us", "");

    try {
      const conversationId = await ensureConversation(userId, phoneNumber);

      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        direction: "inbound",
        type: "text",
        content_text: msg.body,
        content_raw: {
          from: msg.from,
          to: msg.to,
          body: msg.body,
          timestamp: msg.timestamp,
          id: msg.id,
        },
        sent_at: new Date(msg.timestamp * 1000).toISOString(),
        status: "received",
      });

      // Update conversation last_message_at + unread_count
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          unread_count: supabase.rpc("increment_unread" as never, { conv_id: conversationId }),
        })
        .eq("id", conversationId);

      // TODO: Add AI auto-reply logic here
    } catch (e) {
      console.error(`[${sessionId}] Failed to persist inbound message:`, e);
    }
  });

  await client.initialize();
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (_req, res) => res.json({ ok: true, activeSessions: clients.size }));

// GET /sessions — list active sessions (public, non-sensitive — used by DESH dashboard)
app.get("/sessions", async (_req, res) => {
  const { data } = await supabase
    .from("whatsapp_web_sessions")
    .select("session_id, status, last_connected_at, last_error")
    .in("status", ["CONNECTED", "QR_PENDING"]);

  const sessions = data ?? [];
  res.json({
    sessions,
    activeSessions: sessions.length,
    connected: sessions.filter((s) => s.status === "CONNECTED").length,
    qrPending: sessions.filter((s) => s.status === "QR_PENDING").length,
  });
});

// POST /sessions — start a new session
app.post("/sessions", requireSecret, async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

  try {
    // Start async — don't await (QR comes via DB realtime)
    startSession(sessionId).catch((e) => {
      console.error(`[${sessionId}] startSession error:`, e);
      updateSession(sessionId, { status: "ERROR", last_error: String(e) });
    });
    res.json({ ok: true, sessionId });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /sessions/:id/qr — not strictly needed (DB realtime handles it), kept for manual polling
app.get("/sessions/:id/qr", requireSecret, async (req, res) => {
  const { id } = req.params;
  const { data } = await supabase
    .from("whatsapp_web_sessions")
    .select("status, last_qr_code")
    .eq("session_id", id)
    .single();

  res.json({ status: data?.status, qrCode: data?.last_qr_code });
});

// GET /sessions/:id/status
app.get("/sessions/:id/status", requireSecret, async (req, res) => {
  const client = clients.get(req.params.id);
  const { data } = await supabase
    .from("whatsapp_web_sessions")
    .select("status, last_connected_at, last_error")
    .eq("session_id", req.params.id)
    .single();

  res.json({
    status: data?.status ?? (client ? "CONNECTED" : "DISCONNECTED"),
    lastConnectedAt: data?.last_connected_at,
    lastError: data?.last_error,
    activeInMemory: clients.has(req.params.id),
  });
});

// DELETE /sessions/:id — destroy session
app.delete("/sessions/:id", requireSecret, async (req, res) => {
  const { id } = req.params;
  const client = clients.get(id);
  if (client) {
    await client.destroy().catch(() => {});
    clients.delete(id);
  }
  // Clean up session files
  const sessionPath = path.join(SESSION_DIR, `session-${id}`);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }
  await updateSession(id, { status: "DISCONNECTED", last_qr_code: null });
  res.json({ ok: true });
});

// POST /messages — send outbound text message
app.post("/messages", requireSecret, async (req, res) => {
  const { sessionId, to, text } = req.body as { sessionId: string; to: string; text: string };
  if (!sessionId || !to || !text) return res.status(400).json({ error: "sessionId, to, text required" });

  const client = clients.get(sessionId);
  if (!client) return res.status(404).json({ error: "Session not found or not connected" });

  try {
    // Format phone: ensure it ends with @c.us
    const chatId = to.includes("@") ? to : `${to.replace(/\D/g, "")}@c.us`;
    const msgResult = await client.sendMessage(chatId, text);

    // Persist outbound message
    const userId = await getUserIdForSession(sessionId);
    if (userId) {
      const phoneNumber = to.replace(/\D/g, "");
      const conversationId = await ensureConversation(userId, phoneNumber);
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        direction: "outbound",
        type: "text",
        content_text: text,
        content_raw: { to, text, msgId: msgResult.id },
        sent_at: new Date().toISOString(),
        status: "sent",
      });
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    // TODO: Add delivery tracking via message_ack event here
    res.json({ ok: true, msgId: msgResult.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Heartbeat ────────────────────────────────────────────────────────────────
// Every HEARTBEAT_INTERVAL_MS:
//   1. PATCH updated_at via whatsapp-session-proxy for every in-memory session.
//   2. GET sessions from proxy → find those with updated_at > ZOMBIE_THRESHOLD_MS
//      in CONNECTED/QR_PENDING state but missing from the in-memory Map → mark ERROR.

const HEARTBEAT_INTERVAL_MS = 30_000;   // 30 seconds
const ZOMBIE_THRESHOLD_MS   = 120_000;  // 2 minutes without heartbeat = zombie

async function sendHeartbeats() {
  if (clients.size === 0) return;

  const sessionIds = Array.from(clients.keys());

  const results = await Promise.allSettled(
    sessionIds.map(async (sessionId) => {
      await patchSessionViaProxy(sessionId, { updated_at: new Date().toISOString() });
      console.log(`[${sessionId}] ♥ heartbeat → whatsapp-session-proxy`);
    })
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[${sessionIds[i]}] ♥ heartbeat failed:`, r.reason);
    }
  });
}

async function detectZombieSessions() {
  // Fetch all active sessions from the proxy (M2M auth)
  const res = await fetch(SESSION_PROXY_URL, {
    headers: { Authorization: `Bearer ${GATEWAY_SECRET}` },
  });

  if (!res.ok) {
    console.error("[zombie-check] proxy GET failed:", res.status);
    return;
  }

  const sessions: Array<{
    session_id: string;
    status: string;
    updated_at: string;
    user_id: string;
  }> = await res.json();

  const threshold = new Date(Date.now() - ZOMBIE_THRESHOLD_MS);

  for (const session of sessions) {
    const isActive = ["CONNECTED", "QR_PENDING"].includes(session.status);
    const isStale  = new Date(session.updated_at) < threshold;
    const inMemory = clients.has(session.session_id);

    if (isActive && isStale && !inMemory) {
      // Zombie: DB says active but process has no client and heartbeat is stale
      console.warn(
        `[${session.session_id}] ⚠️ zombie — last update: ${session.updated_at}, not in memory`
      );
      await patchSessionViaProxy(session.session_id, {
        status:     "ERROR",
        last_error: `Zombie: no heartbeat for more than ${ZOMBIE_THRESHOLD_MS / 1000}s (last: ${session.updated_at})`,
      }).catch((e) => console.error(`[${session.session_id}] zombie patch failed:`, e));
    }
  }
}

// ── Restore sessions on startup ──────────────────────────────────────────────
async function restoreActiveSessions() {
  const { data } = await supabase
    .from("whatsapp_web_sessions")
    .select("session_id")
    .eq("status", "CONNECTED");

  if (data && data.length > 0) {
    console.log(`Restoring ${data.length} active session(s)...`);
    for (const { session_id } of data) {
      startSession(session_id).catch((e) => console.error(`Restore failed for ${session_id}:`, e));
    }
  }
}

app.listen(PORT, async () => {
  console.log(`WhatsApp Web Gateway running on port ${PORT}`);
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
  await restoreActiveSessions();

  // Start heartbeat loop
  setInterval(async () => {
    await sendHeartbeats();
    await detectZombieSessions();
  }, HEARTBEAT_INTERVAL_MS);

  console.log(`Heartbeat started (every ${HEARTBEAT_INTERVAL_MS / 1000}s, zombie threshold: ${ZOMBIE_THRESHOLD_MS / 1000}s)`);
});
```

---

## package.json

```json
{
  "name": "whatsapp-web-gateway",
  "version": "1.0.0",
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsc",
    "dev": "ts-node server.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "whatsapp-web.js": "^1.23.0",
    "qrcode": "^1.5.3",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/qrcode": "^1.5.5",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.2"
  }
}
```

---

## Deploy no Railway

1. Crie um novo projeto no [Railway](https://railway.app)
2. Clique em **"New Service" → "GitHub Repo"** e selecione este repositório
3. Adicione as variáveis de ambiente:
   - `GATEWAY_SECRET` — mesmo valor de `WHATSAPP_WEB_GATEWAY_SECRET` no DESH
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_DIR` = `/data/wa-sessions`
4. Em **Settings → Volumes**, monte um volume em `/data` para persistir as sessões
5. Anote a URL pública gerada (ex: `https://meu-gateway.up.railway.app`) — use-a no DESH

## Deploy no Fly.io

```bash
# Instale flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly launch --name desh-wa-gateway
fly volumes create wa_sessions --size 1 --region gru
fly secrets set GATEWAY_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

`fly.toml`:
```toml
[mounts]
  source = "wa_sessions"
  destination = "/data/wa-sessions"
```

---

## Fluxo completo

```
1. Usuário insere URL do gateway no DESH → clica "Conectar via QR Code"
2. DESH → POST /whatsapp-web-proxy {action: "createSession", gatewayUrl}
3. Edge Function → cria registro em whatsapp_web_sessions → POST /sessions no gateway
4. Gateway → inicia Client da lib → emite evento "qr"
5. Gateway → PATCH whatsapp_web_sessions {status: QR_PENDING, last_qr_code: "<base64>"}
6. Frontend recebe via Realtime → renderiza <img> do QR
7. Usuário escaneia → Gateway evento "ready" → PATCH {status: CONNECTED}
8. Frontend realtime → exibe "Conectado!"
9. Gateway evento "message" → INSERT em whatsapp_conversations + whatsapp_messages
10. Frontend envia msg → POST /whatsapp-web-proxy {action: "sendMessage"} → Gateway → WA
11. A cada 30s → Gateway PATCH {updated_at: now()} para cada sessão ativa (heartbeat)
12. A cada 30s → Gateway verifica sessões com updated_at > 2min → marca como ERROR (zombie)
```

---

## Heartbeat & Detecção de Zumbis

O gateway executa um loop a cada **30 segundos** que:

1. **Heartbeat** — faz PATCH em `whatsapp_web_sessions` atualizando `updated_at` para cada sessão em memória (`clients` Map). Isso prova que o processo está vivo.

2. **Zombie check** — consulta o banco por sessões com `status IN (CONNECTED, QR_PENDING)` cujo `updated_at` está há mais de **2 minutos** no passado (configável via `ZOMBIE_THRESHOLD_MS`). Sessões zumbis são removidas do Map e marcadas como `ERROR` no banco, acionando o realtime do frontend.

| Constante | Valor padrão | Descrição |
|---|---|---|
| `HEARTBEAT_INTERVAL_MS` | `30000` | Intervalo do loop em ms |
| `ZOMBIE_THRESHOLD_MS` | `120000` | Tempo sem heartbeat para considerar zumbi |
