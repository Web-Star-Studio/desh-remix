import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, RefreshCw, Copy, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function DebugModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchDebug() {
    setLoading(true); setData(null); setOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${session?.access_token}`,
      };
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-web-proxy/debug`, { headers });
      setData(await res.json());
    } catch (e) { setData({ error: e instanceof Error ? e.message : "Erro" }); }
    finally { setLoading(false); }
  }

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button onClick={fetchDebug} title="Diagnóstico WhatsApp" className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0">
        <Bug className="w-3.5 h-3.5" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}
                className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Diagnóstico — WhatsApp Web</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={fetchDebug} disabled={loading} title="Atualizar" className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    {data && <button onClick={handleCopy} title="Copiar JSON" className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>}
                    <button onClick={() => setOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Consultando…</span>
                    </div>
                  ) : data ? (
                    <pre className="text-[11px] font-mono text-foreground/90 whitespace-pre-wrap break-all leading-relaxed">{JSON.stringify(data, null, 2)}</pre>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-12">Nenhum dado</p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
