import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Plus, Copy, Eye, EyeOff, Trash2, ShieldOff, Loader2,
  CheckCircle2, AlertTriangle, Clock, Info, ChevronDown,
  ChevronUp, Activity, Wifi, MessageSquare, QrCode, RefreshCw,
  Pencil, Check, X, Server,
} from "lucide-react";
import { useGatewayApiKeys } from "@/hooks/integrations/useGatewayApiKeys";
import { useGatewayApiKeyLogs, type GatewayKeyLog } from "@/hooks/integrations/useGatewayApiKeyLogs";
import GlassCard from "./GlassCard";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Event badge ──────────────────────────────────────────────────────────────
function EventBadge({ event }: { event: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    qr_code: {
      label: "QR Code",
      icon: <QrCode className="w-3 h-3" />,
      cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    session_connected: {
      label: "Conectado",
      icon: <Wifi className="w-3 h-3" />,
      cls: "bg-primary/15 text-primary border-primary/30",
    },
    session_disconnected: {
      label: "Desconectado",
      icon: <ShieldOff className="w-3 h-3" />,
      cls: "bg-muted text-muted-foreground border-border",
    },
    message_received: {
      label: "Mensagem",
      icon: <MessageSquare className="w-3 h-3" />,
      cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
  };

  const def = map[event] ?? {
    label: event,
    icon: <Activity className="w-3 h-3" />,
    cls: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${def.cls}`}>
      {def.icon}
      {def.label}
    </span>
  );
}

// ─── Per-key logs panel ────────────────────────────────────────────────────────
function KeyLogsPanel({ keyId }: { keyId: string }) {
  const { logs, loading, total, refetch } = useGatewayApiKeyLogs(keyId);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Últimos {logs.length} de {total} uso{total !== 1 ? "s" : ""}
        </span>
        <button
          onClick={refetch}
          className="p-1 rounded-md hover:bg-foreground/5 text-muted-foreground transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 italic">
          Nenhum uso registrado ainda
        </p>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single log row ────────────────────────────────────────────────────────────
function LogRow({ log }: { log: GatewayKeyLog }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-foreground/3 hover:bg-foreground/5 transition-colors">
      <EventBadge event={log.event} />
      <div className="flex-1 min-w-0">
        {log.session_id && (
          <p className="text-[10px] text-muted-foreground truncate font-mono">
            {log.session_id.slice(0, 20)}…
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {log.ip_address && log.ip_address !== "unknown" && (
          <span className="text-[10px] font-mono text-muted-foreground bg-foreground/5 px-1.5 py-0.5 rounded">
            {log.ip_address}
          </span>
        )}
        <span
          className="text-[10px] text-muted-foreground whitespace-nowrap"
          title={format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
        >
          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>
    </div>
  );
}

// ─── Newly-generated key modal ────────────────────────────────────────────────
function NewKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true);
      toast({ title: "Chave copiada!", description: "Cole no .env do seu gateway." });
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">API Key gerada!</h3>
            <p className="text-xs text-muted-foreground">Copie agora — não será mostrada novamente</p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Esta é a <strong>única vez</strong> que a chave completa é exibida. Após fechar, armazene-a com segurança.
          </p>
        </div>

        <div className="relative">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-foreground/5 border border-border font-mono text-sm break-all select-all">
            <span className="flex-1 text-foreground">
              {revealed ? rawKey : rawKey.replace(/(?<=desh_.{4}).+/, "•".repeat(rawKey.length - 9))}
            </span>
            <button
              onClick={() => setRevealed(v => !v)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado!" : "Copiar chave"}
        </button>

        <div className="mt-4 p-3 rounded-xl bg-foreground/5 border border-border">
          <p className="text-xs font-medium text-foreground mb-2">Configure no .env do seu gateway:</p>
          <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">{`DESH_GATEWAY_API_KEY=${rawKey}
DESH_CALLBACK_URL=https://fzidukdcyqsqajoebdfe.supabase.co/functions/v1/whatsapp-gateway-callback`}</pre>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-foreground/5 transition-colors"
        >
          Já copiei — Fechar
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Key row with expandable logs ─────────────────────────────────────────────
function KeyRow({
  keyData,
  onRevoke,
  onDelete,
  onRename,
}: {
  keyData: ReturnType<typeof useGatewayApiKeys>["keys"][0];
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(keyData.label);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const isRevoked = !!keyData.revoked_at;
  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd MMM yyyy 'às' HH:mm", { locale: ptBR }) : "—";

  function handleSaveLabel() {
    const trimmed = labelDraft.trim();
    if (!trimmed) return;
    onRename(keyData.id, trimmed);
    setEditingLabel(false);
  }

  function handleCopyEnv() {
    const snippet = `DESH_GATEWAY_API_KEY=${keyData.key_prefix}...\nDESH_CALLBACK_URL=https://fzidukdcyqsqajoebdfe.supabase.co/functions/v1/whatsapp-gateway-callback`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopiedEnv(true);
      toast({ title: "Configuração copiada!", description: "Cole no .env do gateway." });
      setTimeout(() => setCopiedEnv(false), 2000);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`rounded-xl border transition-colors ${
        isRevoked
          ? "border-border bg-foreground/2 opacity-60"
          : "border-border bg-foreground/3"
      }`}
    >
      {/* Key header */}
      <div className="flex items-start gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-foreground">
              {keyData.key_prefix}…
            </span>
            {isRevoked ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/15 text-destructive border border-destructive/30">
                <ShieldOff className="w-2.5 h-2.5" /> Revogada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30">
                <CheckCircle2 className="w-2.5 h-2.5" /> Ativa
              </span>
            )}
          </div>

          {/* Editable label */}
          {editingLabel ? (
            <div className="flex items-center gap-1 mt-1">
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveLabel(); if (e.key === "Escape") setEditingLabel(false); }}
                className="flex-1 text-xs px-2 py-0.5 rounded bg-background border border-primary text-foreground focus:outline-none"
              />
              <button onClick={handleSaveLabel} className="p-0.5 text-primary hover:opacity-80">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => { setEditingLabel(false); setLabelDraft(keyData.label); }} className="p-0.5 text-muted-foreground hover:opacity-80">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5 group/label">
              <p className="text-xs text-muted-foreground truncate">{keyData.label}</p>
              {!isRevoked && (
                <button
                  onClick={() => setEditingLabel(true)}
                  className="opacity-0 group-hover/label:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-all"
                  title="Editar label"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" /> Criada: {fmtDate(keyData.created_at)}
            </span>
            {keyData.last_used_at && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Activity className="w-2.5 h-2.5" /> Último uso: {fmtDate(keyData.last_used_at)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Per-gateway config */}
          {!isRevoked && (
            <button
              onClick={() => setShowConfig(v => !v)}
              title="Configuração do gateway"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-foreground/10 transition-colors"
            >
              <Server className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Toggle logs */}
          <button
            onClick={() => setExpanded(v => !v)}
            title={expanded ? "Ocultar logs" : "Ver logs de uso"}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-foreground/10 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {!isRevoked && (
            <button
              onClick={() => onRevoke(keyData.id)}
              title="Revogar chave"
              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              <ShieldOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(keyData.id)}
            title="Excluir chave"
            className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Per-gateway .env config snippet */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-3.5 pb-3.5"
          >
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                  <Server className="w-3 h-3" /> Configuração — {keyData.label}
                </span>
                <button
                  onClick={handleCopyEnv}
                  className="flex items-center gap-1 text-[10px] text-primary hover:opacity-80 transition-opacity"
                >
                  {copiedEnv ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedEnv ? "Copiado!" : "Copiar .env"}
                </button>
              </div>
              <div className="rounded-lg bg-foreground/5 border border-border p-3">
                <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{`# Gateway: ${keyData.label}
DESH_GATEWAY_API_KEY=${keyData.key_prefix}...
DESH_CALLBACK_URL=https://fzidukdcyqsqajoebdfe.supabase.co/functions/v1/whatsapp-gateway-callback`}</pre>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                A chave completa foi exibida apenas no momento da criação. Regenere se perdeu.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable logs */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-3.5 pb-3.5"
          >
            <KeyLogsPanel keyId={keyData.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Global logs panel ────────────────────────────────────────────────────────
function GlobalLogsPanel() {
  const { logs, loading, total, refetch } = useGatewayApiKeyLogs();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4 border-t border-border pt-4">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Histórico global de uso</span>
          {total > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-muted-foreground font-medium">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); refetch(); }}
            className="p-1 rounded hover:bg-foreground/5 text-muted-foreground"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 italic">
                  Nenhum uso registrado ainda
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GatewayApiKeyManager() {
  const { keys, loading, generating, generateKey, revokeKey, deleteKey, renameKey } = useGatewayApiKeys();
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Gateway Principal");

  async function handleGenerate() {
    if (!label.trim()) return;
    const raw = await generateKey(label.trim());
    if (raw) {
      setNewKeyRaw(raw);
      setShowForm(false);
      setLabel("Gateway Principal");
    }
  }

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <>
      <AnimatePresence>
        {newKeyRaw && (
          <NewKeyModal rawKey={newKeyRaw} onClose={() => setNewKeyRaw(null)} />
        )}
      </AnimatePresence>

      <GlassCard>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <p className="widget-title">API Keys do Gateway</p>
            {activeKeys.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                {activeKeys.length} ativa{activeKeys.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            {showForm ? "Cancelar" : "Nova chave"}
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-foreground/5 border border-border mb-4">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Use estas chaves no gateway Node.js (header <code className="bg-foreground/10 px-1 rounded font-mono">X-Api-Key</code>) em vez da <code className="bg-foreground/10 px-1 rounded font-mono">service_role</code> global. Cada chamada é registrada com IP e tipo de evento.
          </p>
        </div>

        {/* Generate form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border border-border rounded-xl p-4 mb-4 bg-foreground/3 space-y-3">
                <p className="text-xs font-medium text-foreground">Nova API Key</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Label (identificação)</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="ex: Gateway Railway"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating || !label.trim()}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</>
                  ) : (
                    <><Key className="w-4 h-4" /> Gerar chave</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keys list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Key className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhuma API key criada</p>
            <p className="text-xs text-muted-foreground/60">Gere uma chave para usar no seu gateway Node.js</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {activeKeys.map((k) => (
                <KeyRow key={k.id} keyData={k} onRevoke={revokeKey} onDelete={deleteKey} onRename={renameKey} />
              ))}
            </AnimatePresence>

            {revokedKeys.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Revogadas</p>
                <AnimatePresence>
                  {revokedKeys.map((k) => (
                    <KeyRow key={k.id} keyData={k} onRevoke={revokeKey} onDelete={deleteKey} onRename={renameKey} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Global logs summary */}
            <GlobalLogsPanel />
          </div>
        )}
      </GlassCard>
    </>
  );
}
