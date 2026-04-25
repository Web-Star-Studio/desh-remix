import { useState, forwardRef } from "react";
import {
  Send, Loader2, CheckCircle2, Webhook, ShieldCheck, AlertTriangle, PlusCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Send Test Message ────────────────────────────────────────────────────────

export const SendTestMessage = forwardRef<HTMLDivElement, { sendMessage: (to: string, text: string) => Promise<unknown> }>(
  function SendTestMessage({ sendMessage }, ref) {
    const [sendTo, setSendTo] = useState("");
    const [sendText, setSendText] = useState("");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<"ok" | "error" | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSend() {
      const toClean = sendTo.replace(/\D/g, "");
      if (!toClean || toClean.length < 7 || toClean.length > 20) {
        setResult("error"); setError("Número inválido"); setTimeout(() => setResult(null), 4000); return;
      }
      if (!sendText.trim()) {
        setResult("error"); setError("Digite uma mensagem"); setTimeout(() => setResult(null), 4000); return;
      }
      setSending(true); setResult(null); setError(null);
      try {
        const jid = sendTo.includes("@") ? sendTo : `${toClean}@c.us`;
        await sendMessage(jid, sendText.trim());
        setResult("ok"); setSendText(""); setTimeout(() => setResult(null), 4000);
      } catch (e) {
        setResult("error"); setError(e instanceof Error ? e.message : "Erro ao enviar"); setTimeout(() => setResult(null), 4000);
      } finally { setSending(false); }
    }

    return (
      <div ref={ref} className="space-y-2">
        <p className="text-xs font-medium text-foreground">Enviar mensagem de teste</p>
        <input type="tel" placeholder="Número (ex: 5511999999999)" value={sendTo} onChange={(e) => setSendTo(e.target.value)}
          className="w-full bg-foreground/5 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <textarea placeholder="Mensagem…" value={sendText} onChange={(e) => setSendText(e.target.value)} rows={2}
          className="w-full bg-foreground/5 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        <div className="flex items-center gap-2">
          <button onClick={handleSend} disabled={sending || !sendTo || !sendText}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? "Enviando…" : "Enviar"}
          </button>
          {result === "ok" && <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="w-3.5 h-3.5" /> Enviado!</span>}
          {result === "error" && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>
    );
  }
);

// ── Create Instance Button ──────────────────────────────────────────────────

export const CreateInstanceButton = forwardRef<HTMLDivElement, { onCreateSession: () => Promise<void> }>(
  function CreateInstanceButton({ onCreateSession }, ref) {
    const [expanded, setExpanded] = useState(false);
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    async function handleCreate() {
      setCreating(true); setResult(null);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-web-proxy/instance-create`, { method: "POST", headers, body: JSON.stringify({}) });
        const body = await res.json();
        if (res.ok && body.ok) {
          setResult({ ok: true, msg: body.created ? "Instância criada e conectando…" : "Instância já existe — conectando…" });
          await onCreateSession();
        } else { setResult({ ok: false, msg: body.error ?? "Erro ao criar instância" }); }
      } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : "Erro desconhecido" }); }
      finally { setCreating(false); setTimeout(() => setResult(null), 8000); }
    }

    return (
      <div ref={ref} className="rounded-lg border border-border bg-foreground/5 overflow-hidden">
        <button onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <PlusCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 text-left">Instância morta? Recriar instância BAILEYS</span>
          <AlertTriangle className="w-3 h-3 text-destructive/60 flex-shrink-0" />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Use quando a instância está com erro 401 (Logged Out) e o botão "Conectar" não gera QR.
                </p>
                <button onClick={handleCreate} disabled={creating}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/20 border border-accent/40 text-accent-foreground text-xs font-medium hover:bg-accent/30 transition-colors disabled:opacity-50 w-full justify-center">
                  {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando…</> : <><PlusCircle className="w-3.5 h-3.5" /> Recriar instância</>}
                </button>
                {result && <p className={`text-[10px] text-center ${result.ok ? "text-primary" : "text-destructive"}`}>{result.ok ? "✓" : "✗"} {result.msg}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
