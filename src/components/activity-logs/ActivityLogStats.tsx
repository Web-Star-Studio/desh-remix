import GlassCard from "@/components/dashboard/GlassCard";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  totalLogs: number;
  totalCategories: number;
  totalDays: number;
  lastLogDate: string | null;
}

const ActivityLogStats = ({ totalLogs, totalCategories, totalDays, lastLogDate }: Props) => {
  const stats = [
    { value: totalLogs, label: "Total de logs" },
    { value: totalCategories, label: "Categorias" },
    { value: totalDays, label: "Dias com atividade" },
    {
      value: lastLogDate
        ? formatDistanceToNow(new Date(lastLogDate), { locale: ptBR, addSuffix: false })
        : "—",
      label: "Último log",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {stats.map((s, i) => (
        <GlassCard key={i} size="auto" className="text-center py-3">
          <p className="text-2xl font-bold text-foreground">{s.value}</p>
          <p className="text-[11px] text-muted-foreground">{s.label}</p>
        </GlassCard>
      ))}
    </div>
  );
};

export default ActivityLogStats;
