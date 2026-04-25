import { memo } from "react";
import { ListTodo, FileText, CheckSquare, Bug, Lightbulb, Users } from "lucide-react";

interface TaskTemplatesProps {
  onCreateFromTemplate: (title: string, priority: "low" | "medium" | "high", project?: string, subtasks?: string[]) => void;
}

const templates = [
  {
    label: "Bug Fix",
    icon: Bug,
    title: "Corrigir: ",
    priority: "high" as const,
    subtasks: ["Reproduzir o bug", "Identificar causa raiz", "Implementar fix", "Testar regressão"],
  },
  {
    label: "Feature",
    icon: Lightbulb,
    title: "Implementar: ",
    priority: "medium" as const,
    subtasks: ["Definir requisitos", "Criar protótipo", "Desenvolver", "Code review", "Deploy"],
  },
  {
    label: "Reunião",
    icon: Users,
    title: "Reunião: ",
    priority: "medium" as const,
    subtasks: ["Preparar pauta", "Agendar participantes", "Fazer ata", "Enviar follow-up"],
  },
  {
    label: "Checklist",
    icon: CheckSquare,
    title: "Checklist: ",
    priority: "low" as const,
    subtasks: ["Item 1", "Item 2", "Item 3"],
  },
  {
    label: "Pesquisa",
    icon: FileText,
    title: "Pesquisar: ",
    priority: "low" as const,
    subtasks: ["Coletar dados", "Analisar informações", "Documentar conclusões"],
  },
];

const TaskTemplates = memo(({ onCreateFromTemplate }: TaskTemplatesProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[9px] text-muted-foreground/50 mr-0.5">Templates:</span>
      {templates.map(t => {
        const Icon = t.icon;
        return (
          <button
            key={t.label}
            onClick={() => onCreateFromTemplate(t.title, t.priority, undefined, t.subtasks)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/5 text-muted-foreground text-[10px] hover:bg-primary/10 hover:text-primary transition-colors"
            title={`Criar tarefa: ${t.label}`}
          >
            <Icon className="w-3 h-3" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
});

TaskTemplates.displayName = "TaskTemplates";
export default TaskTemplates;
