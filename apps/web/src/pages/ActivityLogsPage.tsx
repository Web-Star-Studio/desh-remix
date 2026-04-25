import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import ActivityLogToolbar, { type TimePeriod } from "@/components/activity-logs/ActivityLogToolbar";
import ActivityLogStats from "@/components/activity-logs/ActivityLogStats";
import ActivityLogItem from "@/components/activity-logs/ActivityLogItem";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { format, subHours, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/components/dashboard/ConfirmDialog";

interface ActivityLog {
  id: string;
  action: string;
  category: string;
  details: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 50;

const ActivityLogsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["user-activity-logs", user?.id, limit],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase.from("user_activity_logs" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit) as any);
      if (error) throw error;
      return (data || []) as ActivityLog[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    let result = logs;

    // Time period filter
    if (timePeriod !== "all") {
      const now = new Date();
      let cutoff: Date;
      switch (timePeriod) {
        case "hour":  cutoff = subHours(now, 1); break;
        case "today": cutoff = startOfDay(now); break;
        case "week":  cutoff = startOfWeek(now, { weekStartsOn: 1 }); break;
        case "month": cutoff = startOfMonth(now); break;
        default:      cutoff = new Date(0);
      }
      result = result.filter(l => new Date(l.created_at) >= cutoff);
    }

    if (filterCategory !== "all") {
      result = result.filter(l => l.category === filterCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.action.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        JSON.stringify(l.details).toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterCategory, search, timePeriod]);

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {};
    for (const log of filtered) {
      const dateKey = format(new Date(log.created_at), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const categories = useMemo(() => {
    const cats = new Set(logs.map(l => l.category));
    return Array.from(cats).sort();
  }, [logs]);

  const handleClearAll = async () => {
    const ok = await confirm({
      title: "Limpar todo o histórico?",
      description: "Todos os logs de atividade serão excluídos permanentemente.",
      confirmLabel: "Limpar tudo",
    });
    if (!ok) return;
    await (supabase.from("user_activity_logs" as any).delete().eq("user_id", user!.id) as any);
    queryClient.invalidateQueries({ queryKey: ["user-activity-logs"] });
    toast({ title: "Histórico limpo" });
  };

  const handleDeleteOne = async (id: string) => {
    await (supabase.from("user_activity_logs" as any).delete().eq("id", id) as any);
    queryClient.invalidateQueries({ queryKey: ["user-activity-logs"] });
    toast({ title: "Log removido" });
  };

  const formatDate = (dateKey: string) => {
    const d = new Date(dateKey + "T12:00:00");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey === format(today, "yyyy-MM-dd")) return "Hoje";
    if (dateKey === format(yesterday, "yyyy-MM-dd")) return "Ontem";
    return format(d, "dd 'de' MMMM, yyyy", { locale: ptBR });
  };

  return (
    <PageLayout maxWidth="5xl">
      <PageHeader
        title="Logs de Atividade"
        icon={<ScrollText className="w-6 h-6 text-primary drop-shadow" />}
        subtitle={`Acompanhe todas as suas ações no sistema${logs.length > 0 ? ` · ${logs.length} registros` : ""}`}
      />
      {dialog}

      <AnimatedItem index={0}>
        <ActivityLogToolbar
          search={search}
          onSearchChange={setSearch}
          filterCategory={filterCategory}
          onFilterChange={setFilterCategory}
          timePeriod={timePeriod}
          onTimePeriodChange={setTimePeriod}
          categories={categories}
          onRefresh={() => refetch()}
          onClearAll={handleClearAll}
          logs={filtered}
          hasLogs={logs.length > 0}
        />
      </AnimatedItem>

      <AnimatedItem index={1}>
        <ActivityLogStats
          totalLogs={logs.length}
          totalCategories={categories.length}
          totalDays={grouped.length}
          lastLogDate={logs.length > 0 ? logs[0].created_at : null}
        />
      </AnimatedItem>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <AnimatedItem index={2}>
          <GlassCard size="auto">
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <ScrollText className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search || filterCategory !== "all" ? "Nenhum log encontrado com esses filtros" : "Nenhum log de atividade ainda"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Suas ações no sistema serão registradas aqui automaticamente
              </p>
            </div>
          </GlassCard>
        </AnimatedItem>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, dayLogs], gi) => (
            <AnimatedItem key={dateKey} index={gi + 2}>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground/80 px-1 mb-2 sticky top-0 z-10">
                  {formatDate(dateKey)}
                  <span className="ml-2 text-muted-foreground font-normal">({dayLogs.length})</span>
                </p>
                <GlassCard size="auto" className="divide-y divide-border/20">
                  {dayLogs.map(log => (
                    <ActivityLogItem key={log.id} log={log} onDelete={handleDeleteOne} />
                  ))}
                </GlassCard>
              </div>
            </AnimatedItem>
          ))}

          {logs.length >= limit && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setLimit(l => l + PAGE_SIZE)}
              >
                Carregar mais logs
              </Button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
};

export default ActivityLogsPage;
