import { useState, useEffect, useRef, useCallback } from "react";
import { Megaphone, Plus, Send, Calendar, Loader2, RefreshCw, Clock, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZernioWhatsApp, WABABroadcast, WABATemplate } from "@/hooks/whatsapp/useZernioWhatsApp";
import { toast } from "@/hooks/use-toast";

interface Props { accountId: string }

const STATUS_BADGES: Record<string, { label: string; className: string; icon: any }> = {
  draft: { label: "Rascunho", className: "text-muted-foreground bg-muted", icon: Clock },
  scheduled: { label: "Agendado", className: "text-amber-500 bg-amber-500/10", icon: Calendar },
  sending: { label: "Enviando", className: "text-blue-500 bg-blue-500/10", icon: Loader2 },
  sent: { label: "Enviado", className: "text-[hsl(142,70%,45%)] bg-[hsl(142,70%,45%)]/10", icon: CheckCircle2 },
  failed: { label: "Falhou", className: "text-destructive bg-destructive/10", icon: AlertCircle },
};

export default function BroadcastManager({ accountId }: Props) {
  const { listBroadcasts, createBroadcast, sendBroadcast, scheduleBroadcast, getTemplates } = useZernioWhatsApp();
  const [broadcasts, setBroadcasts] = useState<WABABroadcast[]>([]);
  const [templates, setTemplates] = useState<WABATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Form state
  const [bcName, setBcName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bcRes, tplRes] = await Promise.all([
        listBroadcasts(accountId),
        getTemplates(accountId),
      ]);
      if (!mountedRef.current) return;
      setBroadcasts(bcRes.data?.broadcasts || []);
      setTemplates((tplRes.data?.templates || []).filter(t => t.status === "APPROVED"));
    } catch (e) {
      console.error("[BroadcastManager] loadData error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [accountId, listBroadcasts, getTemplates]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = useCallback(async () => {
    const tpl = templates.find(t => t.name === selectedTemplate);
    if (!bcName || !tpl) return;

    const recipients = recipientsText
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const [phone, ...rest] = line.split(",");
        return { phone: phone.trim(), name: rest[0]?.trim() || undefined };
      });

    if (recipients.length === 0) {
      toast({ title: "Adicione pelo menos um destinatário", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await createBroadcast(accountId, bcName, { name: tpl.name, language: tpl.language }, recipients);
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        const bcId = res.data?.broadcast?.id;
        if (scheduleDate && bcId) {
          await scheduleBroadcast(bcId, new Date(scheduleDate).toISOString());
          toast({ title: "Broadcast agendado!", description: `Será enviado em ${new Date(scheduleDate).toLocaleString("pt-BR")}` });
        } else {
          toast({ title: "Broadcast criado!", description: "Pronto para enviar." });
        }
        setShowForm(false);
        setBcName(""); setSelectedTemplate(""); setRecipientsText(""); setScheduleDate("");
        loadData();
      }
    } catch (e: any) {
      toast({ title: "Erro ao criar broadcast", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  }, [templates, selectedTemplate, bcName, recipientsText, scheduleDate, accountId, createBroadcast, scheduleBroadcast, loadData]);

  const handleSend = useCallback(async (bc: WABABroadcast) => {
    setSending(bc.id);
    try {
      const res = await sendBroadcast(bc.id);
      if (res.error) {
        toast({ title: "Erro ao enviar", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Broadcast enviado!", description: `${res.data?.sent || 0} entregues, ${res.data?.failed || 0} falhas` });
        loadData();
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar broadcast", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setSending(null);
    }
  }, [sendBroadcast, loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" /> Broadcasts
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Envie mensagens em massa usando templates aprovados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadData} className="h-8 w-8"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Broadcast
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da campanha</Label>
              <Input placeholder="ex: Newsletter Janeiro" value={bcName} onChange={e => setBcName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Template aprovado</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.name} value={t.name}>{t.name} ({t.language})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && <p className="text-[10px] text-amber-500">Nenhum template aprovado. Crie um na aba Templates primeiro.</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Destinatários (um por linha: telefone ou telefone,nome)</Label>
            <Textarea
              placeholder={"+5511999999999, João\n+5521888888888, Maria"}
              value={recipientsText}
              onChange={e => setRecipientsText(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Use formato E.164 (+55...). {recipientsText.split("\n").filter(l => l.trim()).length} destinatário(s)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Agendamento (opcional)</Label>
            <Input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={creating || !bcName || !selectedTemplate}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : scheduleDate ? <Calendar className="w-4 h-4 mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
              {scheduleDate ? "Agendar" : "Criar Broadcast"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum broadcast criado ainda.</div>
      ) : (
        <div className="grid gap-3">
          {broadcasts.map(bc => {
            const info = STATUS_BADGES[bc.status] || STATUS_BADGES.draft;
            const Icon = info.icon;
            return (
              <div key={bc.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm truncate">{bc.name}</p>
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${info.className}`}>
                      <Icon className="w-3 h-3" /> {info.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {bc.recipientCount != null && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {bc.recipientCount}</span>
                    )}
                    {bc.scheduledAt && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(bc.scheduledAt).toLocaleString("pt-BR")}</span>
                    )}
                    {bc.sent != null && (
                      <span className="text-[10px] text-muted-foreground">{bc.sent} enviados · {bc.failed || 0} falhas</span>
                    )}
                  </div>
                </div>
                {bc.status === "draft" && (
                  <Button size="sm" variant="default" onClick={() => handleSend(bc)} disabled={sending === bc.id} className="gap-1.5 shrink-0">
                    {sending === bc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}