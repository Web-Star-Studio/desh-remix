import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Plus, Trash2, Loader2, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZernioWhatsApp, WABATemplate } from "@/hooks/whatsapp/useZernioWhatsApp";
import { toast } from "@/hooks/use-toast";

interface Props { accountId: string }

const STATUS_MAP: Record<string, { icon: any; label: string; className: string }> = {
  APPROVED: { icon: CheckCircle2, label: "Aprovado", className: "text-[hsl(142,70%,45%)] bg-[hsl(142,70%,45%)]/10" },
  PENDING: { icon: Clock, label: "Pendente", className: "text-amber-500 bg-amber-500/10" },
  REJECTED: { icon: XCircle, label: "Rejeitado", className: "text-destructive bg-destructive/10" },
};

export default function TemplateManager({ accountId }: Props) {
  const { getTemplates, createTemplate, deleteTemplate } = useZernioWhatsApp();
  const [templates, setTemplates] = useState<WABATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("pt_BR");
  const [bodyText, setBodyText] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTemplates(accountId);
      if (mountedRef.current) setTemplates(res.data?.templates || []);
    } catch (e) {
      console.error("[TemplateManager] loadTemplates error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [accountId, getTemplates]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleCreate = useCallback(async () => {
    if (!name || !bodyText) return;
    setCreating(true);
    try {
      const res = await createTemplate(accountId, name.toLowerCase().replace(/\s+/g, "_"), category, language, [
        { type: "BODY", text: bodyText },
      ]);
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Template criado", description: "Aguardando aprovação da Meta (até 24h)." });
        setShowForm(false);
        setName(""); setBodyText("");
        loadTemplates();
      }
    } catch (e: any) {
      toast({ title: "Erro ao criar template", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [name, bodyText, category, language, accountId, createTemplate, loadTemplates]);

  const handleDelete = useCallback(async (tpl: WABATemplate) => {
    setDeleting(tpl.name);
    try {
      const res = await deleteTemplate(accountId, tpl.name);
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Template removido" });
        loadTemplates();
      }
    } catch (e: any) {
      toast({ title: "Erro ao remover template", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setDeleting(null);
    }
  }, [accountId, deleteTemplate, loadTemplates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" /> Templates
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Templates de mensagem aprovados pela Meta para iniciar conversas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadTemplates} className="h-8 w-8"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Template
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nome do template</Label>
              <Input placeholder="ex: boas_vindas" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utilitário</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Corpo da mensagem</Label>
            <Textarea placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado!" value={bodyText} onChange={e => setBodyText(e.target.value)} rows={3} />
            <p className="text-[10px] text-muted-foreground">Use {"{{1}}"}, {"{{2}}"} etc. para variáveis dinâmicas</p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !name || !bodyText}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar Template
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum template encontrado. Crie o primeiro acima.</div>
      ) : (
        <div className="grid gap-3">
          {templates.map(tpl => {
            const statusInfo = STATUS_MAP[tpl.status] || STATUS_MAP.PENDING;
            const StatusIcon = statusInfo.icon;
            const bodyComp = tpl.components?.find((c: any) => c.type === "BODY" || c.type === "body");
            return (
              <div key={tpl.id || tpl.name} className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors group">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{tpl.name}</p>
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${statusInfo.className}`}>
                      <StatusIcon className="w-3 h-3" /> {statusInfo.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{tpl.category}</span>
                    <span className="text-[10px] text-muted-foreground">{tpl.language}</span>
                  </div>
                  {bodyComp && <p className="text-xs text-muted-foreground truncate">{bodyComp.text}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => handleDelete(tpl)}
                  disabled={deleting === tpl.name}
                >
                  {deleting === tpl.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}