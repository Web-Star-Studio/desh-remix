import { useState } from "react";
import { Save, X } from "lucide-react";

interface EmailAutomation {
  id?: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  template_slug: string | null;
  target_audience: string;
  active: boolean;
}

interface EmailTemplate {
  slug: string;
  name: string;
}

interface Props {
  automation: EmailAutomation | null;
  templates: EmailTemplate[];
  onSave: (data: Partial<EmailAutomation>) => void;
  onCancel: () => void;
}

const EmailAutomationForm = ({ automation, templates, onSave, onCancel }: Props) => {
  const [name, setName] = useState(automation?.name || "");
  const [triggerType, setTriggerType] = useState(automation?.trigger_type || "cron");
  const [cronExpr, setCronExpr] = useState(automation?.trigger_config?.cron || "0 8 * * 1");
  const [eventName, setEventName] = useState(automation?.trigger_config?.event || "credit_low");
  const [threshold, setThreshold] = useState(automation?.trigger_config?.threshold || 5);
  const [templateSlug, setTemplateSlug] = useState(automation?.template_slug || "");
  const [targetAudience, setTargetAudience] = useState(automation?.target_audience || "all");

  const handleSubmit = () => {
    if (!name.trim()) return;
    const triggerConfig: any = {};
    if (triggerType === "cron") triggerConfig.cron = cronExpr;
    if (triggerType === "threshold") { triggerConfig.event = eventName; triggerConfig.threshold = threshold; }
    if (triggerType === "event") triggerConfig.event = eventName;

    onSave({
      name,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      template_slug: templateSlug || null,
      target_audience: targetAudience,
      active: automation?.active ?? true,
    });
  };

  const cronPresets = [
    { label: "Toda segunda 08:00", value: "0 8 * * 1" },
    { label: "Diário 07:00", value: "0 7 * * *" },
    { label: "Diário 20:00", value: "0 20 * * *" },
    { label: "Sexta 17:00", value: "0 17 * * 5" },
    { label: "1º do mês 09:00", value: "0 9 1 * *" },
  ];

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{automation ? "Editar Automação" : "Nova Automação"}</h4>
        <button onClick={onCancel} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-white/50 uppercase mb-1 block">Nome</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Relatório semanal"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/50 uppercase mb-1 block">Tipo de Gatilho</label>
          <select
            value={triggerType}
            onChange={e => setTriggerType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white"
          >
            <option value="cron">Cron (agendado)</option>
            <option value="event">Evento</option>
            <option value="threshold">Threshold</option>
          </select>
        </div>
      </div>

      {/* Trigger-specific config */}
      {triggerType === "cron" && (
        <div>
          <label className="text-[10px] text-white/50 uppercase mb-1 block">Expressão Cron</label>
          <input
            value={cronExpr}
            onChange={e => setCronExpr(e.target.value)}
            placeholder="0 8 * * 1"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white font-mono placeholder:text-white/30 mb-2"
          />
          <div className="flex flex-wrap gap-1">
            {cronPresets.map(p => (
              <button
                key={p.value}
                onClick={() => setCronExpr(p.value)}
                className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                  cronExpr === p.value ? "bg-primary/20 text-primary" : "bg-white/5 text-white/50 hover:text-white/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(triggerType === "event" || triggerType === "threshold") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/50 uppercase mb-1 block">Evento</label>
            <select
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white"
            >
              <option value="credit_low">Créditos baixos</option>
              <option value="new_connection">Nova conexão</option>
              <option value="inactivity">Inatividade</option>
            </select>
          </div>
          {triggerType === "threshold" && (
            <div>
              <label className="text-[10px] text-white/50 uppercase mb-1 block">Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={e => setThreshold(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-white/50 uppercase mb-1 block">Template</label>
          <select
            value={templateSlug}
            onChange={e => setTemplateSlug(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white"
          >
            <option value="">— Nenhum (usar padrão) —</option>
            {templates.map(t => (
              <option key={t.slug} value={t.slug}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/50 uppercase mb-1 block">Audiência</label>
          <select
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-sm text-white"
          >
            <option value="all">Todos os usuários</option>
            <option value="active">Ativos (últimos 7 dias)</option>
            <option value="inactive">Inativos (7+ dias)</option>
            <option value="admins">Apenas admins</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white">Cancelar</button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          Salvar
        </button>
      </div>
    </div>
  );
};

export default EmailAutomationForm;
