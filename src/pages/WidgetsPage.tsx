import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { CalendarDays, Mail, CheckSquare, StickyNote, MessageCircle, User, FolderOpen, DollarSign, GripVertical, LayoutGrid } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useWidgetLayout } from "@/hooks/ui/useWidgetLayout";

const iconMap: Record<string, any> = {
  calendar: CalendarDays, tasks: CheckSquare, email: Mail,
  notes: StickyNote, messages: MessageCircle, contacts: User,
  files: FolderOpen, wallet: DollarSign,
};

const categoryMap: Record<string, string> = {
  calendar: "Produtividade", tasks: "Produtividade", email: "Comunicação",
  notes: "Produtividade", messages: "Comunicação", contacts: "Comunicação",
  files: "Produtividade", wallet: "Finanças",
};

const descriptionMap: Record<string, string> = {
  calendar: "Eventos e compromissos", tasks: "Lista de tarefas com prioridades",
  email: "Inbox com IA integrada", notes: "Notas rápidas e organização",
  messages: "WhatsApp integrado", contacts: "CRM pessoal com score",
  files: "Arquivos e Google Drive", wallet: "Open Banking e gastos",
};

export default function WidgetsPage() {
  const { widgets, toggleWidget, moveWidgetById } = useWidgetLayout();
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    dragOverId.current = null;
  }, []);

  const visibleCount = widgets.filter(w => w.visible).length;

  return (
    <PageLayout maxWidth="5xl">
      <PageHeader
        title="Widgets"
        icon={<LayoutGrid className="w-6 h-6 text-primary drop-shadow" />}
        subtitle={`${visibleCount}/${widgets.length} widgets ativos no seu Dashboard`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {widgets.map((w, i) => {
          const Icon = iconMap[w.id] || LayoutGrid;
          const category = categoryMap[w.id] || "Outros";
          const description = descriptionMap[w.id] || "";

          return (
            <AnimatedItem key={w.id} index={i}>
              <div
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", w.id); setDragId(w.id); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; dragOverId.current = w.id; }}
                onDrop={(e) => { e.preventDefault(); const src = e.dataTransfer.getData("text/plain"); if (src && src !== w.id) moveWidgetById(src, w.id); setDragId(null); dragOverId.current = null; }}
                onDragEnd={handleDragEnd}
                className={`transition-all ${dragId === w.id ? "opacity-40 scale-95" : ""}`}
              >
                <GlassCard
                  className={`p-4 cursor-pointer transition-all ${
                    w.visible ? "ring-1 ring-primary/20" : "opacity-60"
                  }`}
                  onClick={() => toggleWidget(w.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${w.visible ? "bg-primary/10" : "bg-foreground/5"}`}>
                        <Icon className={`w-4 h-4 ${w.visible ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{w.label}</p>
                        <p className="text-[10px] text-muted-foreground">{category}</p>
                      </div>
                    </div>
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${w.visible ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    <span className="text-[10px] text-muted-foreground">{w.visible ? "Ativo" : "Inativo"}</span>
                  </div>
                </GlassCard>
              </div>
            </AnimatedItem>
          );
        })}
      </div>
    </PageLayout>
  );
}
