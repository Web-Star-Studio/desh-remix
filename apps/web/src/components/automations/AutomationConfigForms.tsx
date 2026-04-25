import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface ConfigFormProps {
  triggerType?: string;
  actionType?: string;
  triggerConfig?: Record<string, any>;
  actionConfig?: Record<string, any>;
  setTriggerConfig?: (v: Record<string, any>) => void;
  setActionConfig?: (v: Record<string, any>) => void;
  selectClasses: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom", short: "D" },
  { value: 1, label: "Seg", short: "S" },
  { value: 2, label: "Ter", short: "T" },
  { value: 3, label: "Qua", short: "Q" },
  { value: 4, label: "Qui", short: "Q" },
  { value: 5, label: "Sex", short: "S" },
  { value: 6, label: "Sáb", short: "S" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function ScheduledTriggerForm({ triggerConfig, setTriggerConfig, selectClasses }: {
  triggerConfig: Record<string, any>;
  setTriggerConfig: (v: Record<string, any>) => void;
  selectClasses: string;
}) {
  const mode = triggerConfig.schedule_mode || "daily";
  const hour = triggerConfig.hour ?? 8;
  const minute = triggerConfig.minute ?? 0;
  const days: number[] = triggerConfig.days_of_week ?? [1, 2, 3, 4, 5];
  const intervalHours = triggerConfig.interval_hours ?? 24;

  const setMode = (m: string) => {
    const base = { ...triggerConfig, schedule_mode: m, hour, minute };
    if (m === "daily") {
      setTriggerConfig({ ...base, interval_hours: 24 });
    } else if (m === "weekly") {
      setTriggerConfig({ ...base, interval_hours: 168, days_of_week: days.length ? days : [1] });
    } else if (m === "custom") {
      setTriggerConfig({ ...base, days_of_week: days.length ? days : [1, 2, 3, 4, 5] });
    } else if (m === "interval") {
      setTriggerConfig({ ...base, interval_hours: intervalHours });
    }
  };

  const toggleDay = (day: number) => {
    const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    if (next.length === 0) return;
    setTriggerConfig({ ...triggerConfig, days_of_week: next });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground font-medium">Frequência</label>
        <select value={mode} onChange={e => setMode(e.target.value)} className={selectClasses}>
          <option value="daily">Diariamente</option>
          <option value="weekly">Semanalmente</option>
          <option value="custom">Personalizado (dias da semana)</option>
          <option value="interval">Intervalo fixo (horas)</option>
        </select>
      </div>

      {mode === "interval" ? (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Intervalo (horas)</label>
          <select value={intervalHours} onChange={e => setTriggerConfig({ ...triggerConfig, interval_hours: Number(e.target.value) })} className={selectClasses}>
            <option value={1}>A cada 1 hora</option>
            <option value={2}>A cada 2 horas</option>
            <option value={4}>A cada 4 horas</option>
            <option value={6}>A cada 6 horas</option>
            <option value={8}>A cada 8 horas</option>
            <option value={12}>A cada 12 horas</option>
          </select>
        </div>
      ) : (
        <>
          {(mode === "weekly" || mode === "custom") && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Dias da semana</label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map(d => {
                  const active = days.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Horário</label>
            <div className="flex items-center gap-2">
              <select
                value={hour}
                onChange={e => setTriggerConfig({ ...triggerConfig, hour: Number(e.target.value) })}
                className={selectClasses}
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-muted-foreground">:</span>
              <select
                value={minute}
                onChange={e => setTriggerConfig({ ...triggerConfig, minute: Number(e.target.value) })}
                className={selectClasses}
              >
                {[0, 15, 30, 45].map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}

      <div className="p-2 rounded-lg bg-muted/30 border border-border/20">
        <p className="text-[10px] text-muted-foreground">
          {mode === "daily" && `⏰ Executa todos os dias às ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
          {mode === "weekly" && `⏰ Executa ${days.map(d => DAYS_OF_WEEK[d].label).join(", ")} às ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
          {mode === "custom" && `⏰ Executa ${days.map(d => DAYS_OF_WEEK[d].label).join(", ")} às ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
          {mode === "interval" && `🔄 Executa a cada ${intervalHours}h (quando o app estiver aberto)`}
        </p>
      </div>
    </div>
  );
}

/* ─── Trigger Config Sub-Form ─── */
export const TriggerConfigForm = memo(function TriggerConfigForm({
  triggerType, triggerConfig = {}, setTriggerConfig = () => {}, selectClasses,
}: ConfigFormProps) {
  switch (triggerType) {
    case "email_received": return (
      <div className="space-y-2">
        <Input value={triggerConfig.from_contains || ""} onChange={e => setTriggerConfig({ ...triggerConfig, from_contains: e.target.value })} placeholder="Filtrar por remetente (ex: boss@company.com)" className="rounded-xl bg-muted/50 border-border/30" />
        <Input value={triggerConfig.subject_contains || ""} onChange={e => setTriggerConfig({ ...triggerConfig, subject_contains: e.target.value })} placeholder="Filtrar por assunto (ex: fatura, urgente)" className="rounded-xl bg-muted/50 border-border/30" />
      </div>
    );
    case "finance_transaction": return (
      <Input type="number" value={triggerConfig.min_amount || ""} onChange={e => setTriggerConfig({ ...triggerConfig, min_amount: Number(e.target.value) || undefined })} placeholder="Valor mínimo (ex: 500)" className="rounded-xl bg-muted/50 border-border/30" />
    );
    case "contact_low_score": return (
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Score mínimo (dispara abaixo deste valor)</label>
        <Input type="number" min={1} max={99} value={triggerConfig.score_threshold ?? 30} onChange={e => setTriggerConfig({ ...triggerConfig, score_threshold: Number(e.target.value) })} className="rounded-xl bg-muted/50 border-border/30" />
      </div>
    );
    case "scheduled": return (
      <ScheduledTriggerForm triggerConfig={triggerConfig} setTriggerConfig={setTriggerConfig} selectClasses={selectClasses} />
    );
    case "email_keyword": return (
      <div className="space-y-2">
        <Input value={triggerConfig.keywords || ""} onChange={e => setTriggerConfig({ ...triggerConfig, keywords: e.target.value })} placeholder="Palavras-chave separadas por vírgula (ex: urgente, fatura, pagamento)" className="rounded-xl bg-muted/50 border-border/30" />
        <select value={triggerConfig.match_in || "subject"} onChange={e => setTriggerConfig({ ...triggerConfig, match_in: e.target.value })} className={selectClasses}>
          <option value="subject">Buscar no assunto</option><option value="from">Buscar no remetente</option>
        </select>
      </div>
    );
    case "habit_incomplete": return (
      <div className="space-y-2">
        <Input value={triggerConfig.habit_name || ""} onChange={e => setTriggerConfig({ ...triggerConfig, habit_name: e.target.value })} placeholder="Nome do hábito (vazio = todos os hábitos)" className="rounded-xl bg-muted/50 border-border/30" />
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Verificar a partir de que hora?</label>
          <select value={triggerConfig.check_hour ?? 20} onChange={e => setTriggerConfig({ ...triggerConfig, check_hour: Number(e.target.value) })} className={selectClasses}>
            {Array.from({ length: 15 }, (_, i) => i + 8).map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </div>
      </div>
    );
    case "task_overdue": return (
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Dias de atraso mínimo</label>
        <Input type="number" min={1} max={30} value={triggerConfig.days_overdue ?? 1} onChange={e => setTriggerConfig({ ...triggerConfig, days_overdue: Number(e.target.value) })} className="rounded-xl bg-muted/50 border-border/30" />
      </div>
    );
    case "task_created": return (
      <Input value={triggerConfig.project_filter || ""} onChange={e => setTriggerConfig({ ...triggerConfig, project_filter: e.target.value })} placeholder="Filtrar por projeto (opcional)" className="rounded-xl bg-muted/50 border-border/30" />
    );
    case "whatsapp_received": return (
      <Input value={triggerConfig.from_contains || ""} onChange={e => setTriggerConfig({ ...triggerConfig, from_contains: e.target.value })} placeholder="Filtrar por remetente (opcional)" className="rounded-xl bg-muted/50 border-border/30" />
    );
    default: return null;
  }
});

/* ─── Action Config Sub-Form ─── */
export const ActionConfigForm = memo(function ActionConfigForm({
  actionType, actionConfig = {}, setActionConfig = () => {}, selectClasses,
}: ConfigFormProps) {
  switch (actionType) {
    case "create_task": return (
      <div className="space-y-2">
        <Input value={actionConfig.title || ""} onChange={e => setActionConfig({ ...actionConfig, title: e.target.value })} placeholder="Título (use {{contact_name}}, {{score}}, {{sender}}...)" className="rounded-xl bg-muted/50 border-border/30" />
        <Textarea value={actionConfig.description || ""} onChange={e => setActionConfig({ ...actionConfig, description: e.target.value })} placeholder="Descrição (opcional, suporta variáveis)" rows={2} className="rounded-xl bg-muted/50 border-border/30" />
        <select value={actionConfig.priority || "medium"} onChange={e => setActionConfig({ ...actionConfig, priority: e.target.value })} className={selectClasses}>
          <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground flex-shrink-0">Prazo (dias):</label>
          <Input type="number" min={1} value={actionConfig.days_until_due ?? ""} onChange={e => setActionConfig({ ...actionConfig, days_until_due: e.target.value ? Number(e.target.value) : undefined })} placeholder="ex: 7" className="w-24 rounded-xl bg-muted/50 border-border/30" />
        </div>
      </div>
    );
    case "send_notification": return (
      <div className="space-y-2">
        <Input value={actionConfig.title || ""} onChange={e => setActionConfig({ ...actionConfig, title: e.target.value })} placeholder="Título da notificação" className="rounded-xl bg-muted/50 border-border/30" />
        <Input value={actionConfig.body || ""} onChange={e => setActionConfig({ ...actionConfig, body: e.target.value })} placeholder="Corpo (use {{sender}}, {{name}}, {{amount}})" className="rounded-xl bg-muted/50 border-border/30" />
      </div>
    );
    case "add_tag": return (
      <Input value={actionConfig.tag || ""} onChange={e => setActionConfig({ ...actionConfig, tag: e.target.value })} placeholder="Nome da tag" className="rounded-xl bg-muted/50 border-border/30" />
    );
    case "create_note": return (
      <div className="space-y-2">
        <Input value={actionConfig.title || ""} onChange={e => setActionConfig({ ...actionConfig, title: e.target.value })} placeholder="Título da nota (use {{date}}, {{title}}...)" className="rounded-xl bg-muted/50 border-border/30" />
        <Textarea value={actionConfig.content || ""} onChange={e => setActionConfig({ ...actionConfig, content: e.target.value })} placeholder="Conteúdo da nota" rows={3} className="rounded-xl bg-muted/50 border-border/30" />
      </div>
    );
    case "create_event": return (
      <div className="space-y-2">
        <Input value={actionConfig.title || ""} onChange={e => setActionConfig({ ...actionConfig, title: e.target.value })} placeholder="Título do evento" className="rounded-xl bg-muted/50 border-border/30" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground flex-shrink-0">Em quantos dias:</label>
          <Input type="number" min={0} value={actionConfig.days_offset ?? 1} onChange={e => setActionConfig({ ...actionConfig, days_offset: Number(e.target.value) })} className="w-24 rounded-xl bg-muted/50 border-border/30" />
        </div>
      </div>
    );
    case "send_whatsapp": return (
      <div className="space-y-2">
        <Input value={actionConfig.to || ""} onChange={e => setActionConfig({ ...actionConfig, to: e.target.value })} placeholder="Número destino (opcional, usa contato do gatilho)" className="rounded-xl bg-muted/50 border-border/30" />
        <Textarea value={actionConfig.message || ""} onChange={e => setActionConfig({ ...actionConfig, message: e.target.value })} placeholder="Mensagem (use {{contact_name}}, {{title}}...)" rows={2} className="rounded-xl bg-muted/50 border-border/30" />
      </div>
    );
    case "pandora_whatsapp": return (
      <div className="space-y-3">
        <Input value={actionConfig.to || ""} onChange={e => setActionConfig({ ...actionConfig, to: e.target.value })} placeholder="Número WhatsApp destino (ex: 5511999998888)" className="rounded-xl bg-muted/50 border-border/30" />
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">Prompt para a Pandora</label>
          <Textarea value={actionConfig.prompt || ""} onChange={e => setActionConfig({ ...actionConfig, prompt: e.target.value })} placeholder="Ex: Faça um resumo motivacional do meu dia, incluindo minhas tarefas, eventos e hábitos pendentes. Termine com uma frase inspiradora." rows={4} className="rounded-xl bg-muted/50 border-border/30" />
        </div>
        <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
          <p className="text-[11px] font-medium text-primary">🤖 A Pandora tem acesso a:</p>
          <div className="flex flex-wrap gap-1">
            {["Tarefas", "Eventos", "Hábitos", "Finanças", "Contatos"].map(item => (
              <span key={item} className="px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] text-primary font-medium">{item}</span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Escreva em linguagem natural o que quer que a Pandora faça. Ela usará seus dados reais para gerar a resposta.</p>
        </div>
      </div>
    );
    default: return null;
  }
});
