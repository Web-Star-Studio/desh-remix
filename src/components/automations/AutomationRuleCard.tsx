import { memo } from "react";
import { Switch } from "@/components/ui/switch";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DeshContextMenu } from "@/components/ui/DeshContextMenu";
import { ArrowRight, Pencil, Copy, Trash2, History, FlaskConical, ToggleRight, ToggleLeft } from "lucide-react";
import { TRIGGER_TYPES, ACTION_TYPES, type AutomationRule } from "@/hooks/automation/useAutomations";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Build a short human-readable summary of trigger/action config */
export function configSummary(rule: AutomationRule): string {
  const parts: string[] = [];
  const tc = rule.trigger_config || {};
  const ac = rule.action_config || {};

  if (tc.from_contains) parts.push(`de: ${tc.from_contains}`);
  if (tc.subject_contains) parts.push(`assunto: ${tc.subject_contains}`);
  if (tc.keywords) parts.push(`palavras: ${tc.keywords}`);
  if (tc.match_in) parts.push(`em: ${tc.match_in === "from" ? "remetente" : "assunto"}`);
  if (tc.min_amount) parts.push(`≥ R$${tc.min_amount}`);
  if (tc.score_threshold) parts.push(`score < ${tc.score_threshold}`);
  if (tc.interval_hours) parts.push(`a cada ${tc.interval_hours}h`);
  if (tc.project_filter) parts.push(`projeto: ${tc.project_filter}`);
  if (tc.habit_name) parts.push(`hábito: ${tc.habit_name}`);
  if (tc.check_hour) parts.push(`às ${tc.check_hour}h`);
  if (tc.days_overdue) parts.push(`${tc.days_overdue}+ dia(s) atraso`);

  if (ac.title) parts.push(`→ "${ac.title}"`);
  if (ac.priority && ac.priority !== "medium") parts.push(`prioridade: ${ac.priority}`);
  if (ac.amount) parts.push(`+${ac.amount} XP`);
  if (ac.tag) parts.push(`tag: ${ac.tag}`);

  return parts.join(" • ");
}

export interface RuleCardProps {
  rule: AutomationRule;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onViewLogs: () => void;
  onTest: () => void;
  isTesting: boolean;
  isDeleting: boolean;
}

const AutomationRuleCard = memo(function AutomationRuleCard({ rule, onToggle, onDelete, onEdit, onDuplicate, onViewLogs, onTest, isTesting, isDeleting }: RuleCardProps) {
  const trigger = TRIGGER_TYPES.find(t => t.value === rule.trigger_type);
  const action = ACTION_TYPES.find(a => a.value === rule.action_type);
  const summary = configSummary(rule);

  return (
    <DeshContextMenu actions={[
      { id: "edit", label: "Editar automação", icon: Pencil, onClick: onEdit },
      { id: "toggle", label: rule.enabled ? "Desativar" : "Ativar", icon: rule.enabled ? ToggleLeft : ToggleRight, onClick: onToggle },
      { id: "duplicate", label: "Duplicar", icon: Copy, onClick: onDuplicate },
      { id: "test", label: "Executar agora", icon: FlaskConical, onClick: onTest, disabled: isTesting },
      { id: "logs", label: "Ver histórico", icon: History, onClick: onViewLogs },
      { id: "delete", label: "Excluir", icon: Trash2, destructive: true, dividerAfter: true, onClick: onDelete },
    ]}>
      <div className={`flex items-start gap-3 p-3 rounded-xl transition-all group ${rule.enabled ? "bg-muted/50 hover:bg-muted/60" : "bg-muted/20 opacity-60 hover:opacity-80"}`}>
        <Switch
          checked={rule.enabled}
          onCheckedChange={onToggle}
          className="flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{rule.name}</p>
            {!rule.enabled && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-semibold">pausada</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
            {trigger?.icon} {trigger?.label}
            <ArrowRight className="w-3 h-3 opacity-40" />
            {action?.icon} {action?.label}
            {rule.execution_count > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium ml-1">
                {rule.execution_count}x
              </Badge>
            )}
            {rule.last_executed_at && (
              <span className="ml-1 hidden sm:inline text-muted-foreground/60">
                • {formatDistanceToNow(new Date(rule.last_executed_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>
          {summary && (
            <p className="text-[11px] text-muted-foreground/50 mt-1 truncate italic">{summary}</p>
          )}
        </div>
        <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
          <DeshTooltip label="Executar agora">
            <button onClick={onTest} disabled={isTesting} className="p-1.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-50">
              <FlaskConical className={`w-3.5 h-3.5 ${isTesting ? "animate-pulse" : ""}`} />
            </button>
          </DeshTooltip>
          <DeshTooltip label="Ver logs">
            <button onClick={onViewLogs} className="p-1.5 rounded-xl hover:bg-muted/70 text-muted-foreground">
              <History className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
          <DeshTooltip label="Editar">
            <button onClick={onEdit} className="p-1.5 rounded-xl hover:bg-muted/70 text-muted-foreground">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
          <DeshTooltip label="Duplicar">
            <button onClick={onDuplicate} className="p-1.5 rounded-xl hover:bg-muted/70 text-muted-foreground">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
          <button onClick={onDelete}
            className={`p-1.5 rounded-xl transition-colors ${isDeleting ? "bg-destructive/20 text-destructive" : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"}`}
            title={isDeleting ? "Clique novamente para confirmar" : "Excluir"}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </DeshContextMenu>
  );
});

export default AutomationRuleCard;
