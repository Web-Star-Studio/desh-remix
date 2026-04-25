import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, FileDown, FileUp, Download, Upload, Loader2, Lock, Shield, Trash2, XCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";

const PrivacySection = () => {
  const { user } = useAuth();
  const { isConnected: isComposioConnected, connectedToolkits, disconnectToolkit: disconnectComposioToolkit } = useComposioConnection();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [deletionStep, setDeletionStep] = useState<"idle" | "confirm" | "done">("idle");
  const [confirmText, setConfirmText] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const handleExport = useCallback(async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-io", { body: { action: "export" } });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `desh-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "✅ Exportação concluída", description: "Todos os seus dados foram baixados. LGPD Art. 18, V — Portabilidade." });
    } catch (err: any) {
      toast({ title: "Erro ao exportar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  }, [user]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    try {
      const text = await file.text();
      let parsed: any;
      if (file.name.endsWith(".json")) {
        parsed = JSON.parse(text);
        if (parsed._meta?.format === "desh-export") {
          const { data, error } = await supabase.functions.invoke("data-io", { body: { action: "import", type: "desh-export", data: parsed } });
          if (error) throw error;
          const counts = data.imported || {};
          const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ");
          toast({ title: "✅ Importação concluída", description: summary || "Dados importados com sucesso." });
        } else if (Array.isArray(parsed)) {
          const first = parsed[0] || {};
          const isContact = first.name && (first.email || first.phone);
          const type = isContact ? "contacts-csv" : "tasks-csv";
          const { data, error } = await supabase.functions.invoke("data-io", { body: { action: "import", type, data: parsed } });
          if (error) throw error;
          const counts = data.imported || {};
          toast({ title: "✅ Importação concluída", description: Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ") || "Dados importados." });
        } else {
          toast({ title: "Formato não suportado", description: "O arquivo JSON não possui formato reconhecido.", variant: "destructive" });
        }
      } else if (file.name.endsWith(".csv")) {
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length < 2) throw new Error("CSV vazio");
        const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
        const rows = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = values[i] || ""; });
          return obj;
        });
        const isContact = headers.some(h => /name|nome/i.test(h)) && headers.some(h => /email|phone|telefone/i.test(h));
        const type = isContact ? "contacts-csv" : "tasks-csv";
        const { data, error } = await supabase.functions.invoke("data-io", { body: { action: "import", type, data: rows } });
        if (error) throw error;
        toast({ title: "✅ Importação concluída", description: Object.entries(data.imported || {}).map(([k, v]) => `${v} ${k}`).join(", ") || "Dados importados." });
      } else {
        toast({ title: "Formato não suportado", description: "Use arquivos .json ou .csv", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message || "Verifique o formato do arquivo.", variant: "destructive" });
    } finally {
      if (mountedRef.current) setImporting(false);
      e.target.value = "";
    }
  };

  const handleRevokeGoogle = async () => {
    if (!user) return;
    setRevoking("google");
    try {
      await disconnectComposioToolkit("gmail");
      toast({ title: "✅ Acesso Google revogado", description: "Conexão Google desconectada. LGPD Art. 18, IX." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setRevoking(null);
    }
  };

  const handleRevokeWhatsapp = async () => {
    if (!user) return;
    setRevoking("whatsapp");
    try {
      await supabase.from("whatsapp_connections").delete().eq("user_id", user.id);
      toast({ title: "✅ Integração WhatsApp/Meta revogada", description: "Seus dados de conexão WhatsApp foram removidos. LGPD Art. 18, IX." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setRevoking(null);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user || confirmText.toLowerCase() !== "excluir") return;
    try {
      await supabase.from("admin_logs").insert({
        action: "account_deletion_request",
        user_id: user.id,
        user_email: user.email,
        details: { requested_at: new Date().toISOString(), reason: "LGPD Art. 18, VI — Usuário solicitou exclusão" },
      });
      setDeletionStep("done");
      toast({ title: "✅ Solicitação recebida", description: "Nossa equipe processará a exclusão em até 15 dias úteis (LGPD Art. 18, VI)." });
    } catch (err: any) {
      toast({ title: "Erro ao registrar solicitação", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* LGPD Rights overview */}
      <div className="bg-foreground/5 rounded-xl p-3">
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-primary" /> Seus direitos (LGPD Art. 18)
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { icon: "👁️", label: "Acesso", desc: "Ver seus dados" },
            { icon: "✏️", label: "Retificação", desc: "Corrigir dados incorretos" },
            { icon: "📦", label: "Portabilidade", desc: "Exportar seus dados" },
            { icon: "🗑️", label: "Exclusão", desc: "Solicitar remoção" },
            { icon: "🔕", label: "Revogação", desc: "Retirar consentimento" },
            { icon: "ℹ️", label: "Informação", desc: "Saber como são usados" },
          ].map(r => (
            <div key={r.label} className="flex items-start gap-1.5 p-1.5 rounded-lg bg-foreground/5">
              <span className="text-xs">{r.icon}</span>
              <div>
                <p className="text-[11px] font-medium text-foreground">{r.label}</p>
                <p className="text-[10px] text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Portabilidade de dados</p>
        <button onClick={handleExport} disabled={exporting}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors text-left">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <FileDown className="w-4 h-4 text-primary" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Exportar todos os dados</p>
            <p className="text-xs text-muted-foreground">Tarefas, contatos, finanças, notas, IA e configurações — JSON</p>
          </div>
          <Download className="w-4 h-4 text-muted-foreground" />
        </button>

        <label className={`mt-2 w-full flex items-center gap-3 p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
          {importing ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <FileUp className="w-4 h-4 text-primary" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Importar dados</p>
            <p className="text-xs text-muted-foreground">JSON (backup Desh) ou CSV (tarefas/contatos)</p>
          </div>
          <Upload className="w-4 h-4 text-muted-foreground" />
          <input type="file" accept=".json,.csv" onChange={handleImportFile} className="hidden" />
        </label>
      </div>

      {/* Revoke integrations */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Revogar integrações</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Google Workspace</p>
              <p className="text-xs text-muted-foreground">
                {isComposioConnected("gmail") || isComposioConnected("googlecalendar")
                  ? `Conectado via Composio (${connectedToolkits.filter(t => t.startsWith("google")).length} serviço(s))`
                  : "Nenhum serviço conectado"}
              </p>
            </div>
            {isComposioConnected("gmail") ? (
              <button onClick={handleRevokeGoogle} disabled={revoking === "google"}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 flex-shrink-0">
                {revoking === "google" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                Revogar
              </button>
            ) : (
              <button onClick={() => navigate("/integrations")}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors flex-shrink-0">
                Conectar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5">
            <span className="text-base flex-shrink-0">💬</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">WhatsApp / Meta</p>
              <p className="text-xs text-muted-foreground">Integração WhatsApp Business Cloud API</p>
            </div>
            <button onClick={handleRevokeWhatsapp} disabled={revoking === "whatsapp"}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 flex-shrink-0">
              {revoking === "whatsapp" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Revogar
            </button>
          </div>
        </div>
      </div>

      {/* Account deletion */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Solicitar exclusão de conta</p>
        <AnimatePresence mode="wait">
          {deletionStep === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-3 rounded-xl bg-destructive/5 border border-destructive/10">
              <div className="flex items-start gap-2.5 mb-3">
                <Trash2 className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Excluir minha conta e dados</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Todos os seus dados pessoais serão permanentemente removidos. Esta ação não pode ser desfeita. Processamento em até 15 dias úteis (LGPD Art. 18, VI).
                  </p>
                </div>
              </div>
              <button onClick={() => setDeletionStep("confirm")}
                className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium">
                Solicitar exclusão →
              </button>
            </motion.div>
          )}
          {deletionStep === "confirm" && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3">
              <p className="text-xs font-semibold text-destructive">⚠️ Confirmação obrigatória</p>
              <p className="text-xs text-muted-foreground">
                Digite <strong className="text-foreground">excluir</strong> para confirmar a solicitação de exclusão permanente da sua conta.
              </p>
              <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder='Digite "excluir"'
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-destructive/30" />
              <div className="flex gap-2">
                <button onClick={handleRequestDeletion} disabled={confirmText.toLowerCase() !== "excluir"}
                  className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-40">
                  Confirmar exclusão
                </button>
                <button onClick={() => { setDeletionStep("idle"); setConfirmText(""); }}
                  className="px-3 py-2 rounded-lg bg-foreground/5 text-muted-foreground text-xs hover:bg-foreground/10 transition-colors">
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
          {deletionStep === "done" && (
            <motion.div key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-foreground/5 border border-foreground/10 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Solicitação registrada</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nossa equipe processará a exclusão completa dos seus dados em até 15 dias úteis. Você receberá uma confirmação por e-mail ({user?.email}).
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legal links */}
      <div className="pt-2 border-t border-foreground/10 flex flex-wrap gap-3">
        <a href="/privacy" target="_blank" className="text-[11px] text-primary hover:underline flex items-center gap-1">
          <Eye className="w-3 h-3" /> Política de Privacidade
        </a>
        <a href="/terms" target="_blank" className="text-[11px] text-primary hover:underline flex items-center gap-1">
          <FileDown className="w-3 h-3" /> Termos de Uso
        </a>
        <a href="mailto:dev@webstar.studio" className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Shield className="w-3 h-3" /> DPO: dev@webstar.studio
        </a>
      </div>
    </div>
  );
};

export default PrivacySection;
