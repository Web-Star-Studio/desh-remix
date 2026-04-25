# DESH — Edge Functions Index

> Última atualização: 2026-03-27

## Arquitetura

```
supabase/functions/
├── _shared/              # Módulos compartilhados (CORS, auth, utils, AI handlers)
├── <function>/index.ts   # Entry point de cada function
└── README.md             # Este arquivo
```

### Módulos Compartilhados (`_shared/`)

| Módulo | Descrição |
|--------|-----------|
| `utils.ts` | `corsHeaders`, `handleCors()`, `jsonResponse()`, `errorResponse()` |
| `auth.ts` | `verifyAuth()` — validação JWT com fallback getUser |
| `credits.ts` | `deductCredits()`, `insufficientCreditsResponse()` |
| `composio-client.ts` | `getComposioAccessToken()`, `initiateConnection()`, `getConnectedToolkits()` |
| `r2-client.ts` | Upload/download para Cloudflare R2 |
| `pandora-prompt.ts` | System prompt builder para Pandora AI |
| `ai-*.ts` | Handlers de IA por módulo (email, calendar, tasks, etc.) |
| `pluggy-*.ts` | Handlers para integração Pluggy (Open Finance) |
| `media-*.ts` | Handlers para geração de mídia (imagem, PDF, TTS) |

---

## Funções — Índice Completo

### 🔌 Integrações & Proxy

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `composio-proxy` | ✅ Ativo | 651 | Proxy para Composio Actions (Gmail, Calendar, Drive, Contacts) | `useEdgeFn`, `useComposioProxy` |
| `composio-webhook` | ✅ Ativo | 188 | Recebe webhooks Composio V3 (trigger events, token expired) | Composio platform |
| `integrations-connect` | ✅ Ativo | 76 | OAuth flow Composio — initiate/list/disconnect | `useComposioConnection` |
| `late-proxy` | ✅ Ativo | 206 | Proxy para Late API (busca semântica) | `useLateProxy` |
| `pluggy-proxy` | ✅ Ativo | 58 | Proxy para Pluggy Open Finance | Finance hooks |
| `widgets-proxy` | ✅ Ativo | 44 | Proxy para widgets (clima, notícias, ações) | Dashboard widgets |
| `mapbox-proxy` | ✅ Ativo | 44 | Proxy para Mapbox APIs | Map components |
| `mapbox-geocode` | ✅ Ativo | 28 | Geocodificação Mapbox | MapPage |
| `mapbox-reverse-geocode` | ✅ Ativo | 28 | Geocodificação reversa Mapbox | MapPage |
| `mapbox-directions` | ✅ Ativo | 28 | Rotas Mapbox | MapPage |
| `mapbox-token` | ✅ Ativo | 27 | Token Mapbox para frontend | MapPage |
| `serp-proxy` | ✅ Ativo | 28 | Proxy para SERP API | SEO tools |
| `serp-search` | ✅ Ativo | 26 | Busca SERP | SEO tools |
| `serp-monitor-check` | ✅ Ativo | 26 | Monitoramento SERP | SEO automation |

### 📧 Email & Gmail

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `gmail-gateway` | ✅ Ativo | 26 | Sync gateway Gmail (router) | EmailPage |
| `gmail-webhook` | ✅ Ativo | 262 | Push notifications do Gmail (watch) | Google Cloud Pub/Sub |
| `email-ai` | ✅ Ativo | 25 | IA para e-mails (resumo, classificação) | useEmailAI |
| `email-system` | ✅ Ativo | 30 | Sistema de e-mails transacionais | Admin |
| `email-automation-runner` | ✅ Ativo | 173 | Executa automações de e-mail | Cron / Triggers |
| `email-unsubscribe` | ✅ Ativo | 318 | Gerencia unsubscribes Gmail | EmailPage |
| `send-notification-email` | ✅ Ativo | 686 | Envia e-mails de notificação | Triggers DB |
| `auth-email-hook` | ✅ Ativo | 302 | Hook de e-mails auth (signup, reset) | Supabase Auth |
| `inbox-ai` | ✅ Ativo | 25 | IA para inbox (priorização) | useEmailAI |

### 🤖 IA & Chat

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `chat` | ✅ Ativo | 554 | Pandora Chat principal | PandoraChat |
| `tool-worker` | ✅ Ativo | 478 | Executa tools de IA (background jobs) | useAIToolExecution, DB trigger |
| `deep-research` | ✅ Ativo | 350 | Pesquisa profunda com IA | PandoraChat |
| `ai-proactive-insights` | ✅ Ativo | 258 | Insights proativos de IA | Dashboard |
| `welcome-chat` | ✅ Ativo | 111 | Chat de boas-vindas | Onboarding |
| `search-web` | ✅ Ativo | 527 | Busca web para IA | PandoraChat tools |

### 🧩 IA por Módulo (Routers — delegam para `_shared/ai-*.ts`)

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `calendar-ai` | ✅ Ativo | 25 | IA para calendário | CalendarPage |
| `contacts-ai` | ✅ Ativo | 25 | IA para contatos | ContactsPage |
| `finance-ai` | ✅ Ativo | 25 | IA para finanças | FinancePage |
| `files-ai` | ✅ Ativo | 25 | IA para arquivos | FilesPage |
| `tasks-ai` | ✅ Ativo | 25 | IA para tarefas | TasksPage |
| `notes-ai` | ✅ Ativo | 25 | IA para notas | NotesPage |
| `messages-ai` | ✅ Ativo | 25 | IA para mensagens | WhatsApp |
| `social-ai` | ✅ Ativo | 26 | IA para social/SEO | SocialPage |
| `map-ai` | ✅ Ativo | 25 | IA para mapas | MapPage |
| `automation-ai` | ✅ Ativo | 25 | IA para automações | AutomationsPage |
| `week-planner-ai` | ✅ Ativo | 25 | IA para planejamento semanal | WeekPlanner |
| `productivity-ai` | ✅ Ativo | 47 | IA para produtividade | Dashboard |
| `comms-ai` | ✅ Ativo | 47 | IA para comunicações | CommsPage |
| `data-ai` | ✅ Ativo | 43 | IA para dados genéricos | DataPage |

### 💰 Billing & Pagamentos

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `billing` | ✅ Ativo | 52 | Checkout e gerenciamento billing | BillingPage |
| `stripe-webhook` | ✅ Ativo | 312 | Webhook Stripe (pagamentos, assinaturas) | Stripe |
| `financial-webhook` | ✅ Ativo | 331 | Webhook financeiro (Pluggy) | Pluggy |
| `finance-sync` | ✅ Ativo | 26 | Sync de dados financeiros | FinancePage |

### 📱 WhatsApp

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `whatsapp-web-proxy` | ✅ Ativo | 2610 | Proxy WhatsApp Web (maior function) | WhatsApp module |
| `pandora-whatsapp` | ✅ Ativo | 1004 | Pandora IA para WhatsApp | WhatsApp AI |
| `whatsapp-proxy` | ✅ Ativo | 205 | Proxy WhatsApp Cloud API | WhatsApp module |
| `whatsapp-webhook` | ✅ Ativo | 203 | Webhook WhatsApp Cloud | Meta |
| `whatsapp-gateway-callback` | ✅ Ativo | 244 | Callback do gateway WhatsApp | Gateway |
| `whatsapp-embedded-signup` | ✅ Ativo | 132 | Signup embarcado WhatsApp Business | WhatsApp onboarding |

### 📂 Arquivos & Mídia

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `files-storage` | ✅ Ativo | 852 | Storage de arquivos (upload, R2, OCR) | FilesPage |
| `drive-cross-copy` | ✅ Ativo | 134 | Cópia cross-service (Drive ↔ R2) | GoogleDriveExplorer |
| `media-gen` | ✅ Ativo | 43 | Geração de mídia (imagem, PDF, TTS) | MediaPage |

### 🔧 Utilitários & Sistema

| Função | Status | Linhas | Descrição | Chamada por |
|--------|--------|--------|-----------|-------------|
| `demo-seed` | ✅ Ativo | 284 | Seed de dados demo | Onboarding |
| `data-io` | ✅ Ativo | 26 | Import/export de dados | Settings |
| `process-archived-users` | ✅ Ativo | 204 | Processa exclusão de contas arquivadas | Cron |
| `facebook-auth` | ✅ Ativo | 113 | Auth Facebook/Instagram | Social connections |
| `morning-briefing` | ✅ Ativo | 12 | Briefing matinal (router) | Dashboard |
| `news` | ✅ Ativo | 12 | Notícias (router) | Dashboard |
| `stocks` | ✅ Ativo | 12 | Ações/bolsa (router) | Dashboard |
| `weather` | ✅ Ativo | 12 | Clima (router) | Dashboard |

---

## Convenções

### CORS
Todas as funções chamadas pelo frontend **devem** usar os CORS headers centralizados:

```typescript
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();
  // ...
  return jsonResponse({ ok: true });
});
```

### Autenticação
Funções que requerem auth usam `verifyAuth()`:

```typescript
import { verifyAuth } from "../_shared/auth.ts";

const { userId, supabase } = await verifyAuth(req);
```

### Créditos
Funções que consomem créditos:

```typescript
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";

const creditResult = await deductCredits(supabase, userId, cost, "action_name");
if (!creditResult.success) return insufficientCreditsResponse(creditResult);
```

### Doc Header
Cada function deve ter no topo:

```typescript
/**
 * @function nome-da-funcao
 * @description O que faz
 * @status active | deprecated
 * @calledBy Quem chama esta função
 */
```

---

## Estatísticas

- **Total de funções**: 65
- **Com doc headers `@function`**: 65 ✅ (100%)
- **Usando `_shared/utils.ts`**: 43 (CORS centralizado)
- **Com CORS inline (custom)**: 3 (`auth-email-hook`, `whatsapp-web-proxy`, `whatsapp-gateway-callback`)
- **Maior função**: `whatsapp-web-proxy` (2610 linhas)
- **Total de linhas**: ~12.000+
