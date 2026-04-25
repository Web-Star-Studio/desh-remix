import { useState, useEffect } from "react";
import { Shield, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import GlassCard from "./GlassCard";

interface AuditEntry {
  id: string;
  sender_phone: string;
  action: string;
  reason: string | null;
  message_preview: string | null;
  credits_used: number;
  created_at: string;
}

function formatPhone(phone: string): string {
  if (phone.length === 13 && phone.startsWith("55")) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return `+${phone}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(entries: AuditEntry[]): Record<string, AuditEntry[]> {
  const groups: Record<string, AuditEntry[]> = {};
  const today = new Date().toLocaleDateString("pt-BR");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("pt-BR");

  for (const entry of entries) {
    const dayStr = new Date(entry.created_at).toLocaleDateString("pt-BR");
    const label = dayStr === today ? "Hoje" : dayStr === yesterday ? "Ontem" : dayStr;
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }
  return groups;
}

export default function PandoraAuditLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState({ processed: 0, blocked: 0 });
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!user) return;
    fetchEntries(0);
    fetchStats();
  }, [user]);

  const fetchEntries = async (pageNum: number) => {
    if (!user) return;
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const { data, error } = await supabase
      .from("pandora_wa_audit_log" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE);

    if (!error && data) {
      if (pageNum === 0) {
        setEntries(data as unknown as AuditEntry[]);
      } else {
        setEntries((prev) => [...prev, ...(data as unknown as AuditEntry[])]);
      }
      setHasMore((data as any[]).length > PAGE_SIZE);
      setPage(pageNum);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!user) return;
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();

    const [processedRes, blockedRes] = await Promise.all([
      supabase
        .from("pandora_wa_audit_log" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "processed")
        .gte("created_at", oneDayAgo),
      supabase
        .from("pandora_wa_audit_log" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("action", "blocked")
        .gte("created_at", oneDayAgo),
    ]);

    setStats({
      processed: (processedRes as any).count ?? 0,
      blocked: (blockedRes as any).count ?? 0,
    });
  };

  const grouped = groupByDay(entries);

  const reasonLabel: Record<string, string> = {
    authorized: "Autorizada",
    not_authorized: "Não autorizado",
    not_verified: "Não verificado",
    outside_hours: "Fora do horário",
    group_message: "Grupo",
    inactive: "Desativada",
    no_allowed_numbers: "Sem números",
    settings_error: "Erro de config",
  };

  return (
    <GlassCard size="auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Log de Atividade da Pandora</h3>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
              <CheckCircle className="w-3 h-3" />
              {stats.processed} processadas
            </Badge>
            <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
              <XCircle className="w-3 h-3" />
              {stats.blocked} bloqueadas
            </Badge>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Últimas 24 horas</p>

        {entries.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            Nenhuma atividade registrada ainda.
          </p>
        )}

        <div className="space-y-4">
          {Object.entries(grouped).map(([day, dayEntries]) => (
            <div key={day} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{day}</p>
              <div className="space-y-1">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 text-xs py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    {entry.action === "processed" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="text-muted-foreground w-10 shrink-0">{formatTime(entry.created_at)}</span>
                    <span className="font-mono text-foreground shrink-0">{formatPhone(entry.sender_phone)}</span>
                    <Badge
                      variant={entry.action === "processed" ? "default" : "destructive"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {entry.action === "processed" ? "Processada" : "Bloqueada"}
                    </Badge>
                    <span className="text-muted-foreground truncate flex-1">
                      {entry.action === "processed"
                        ? entry.message_preview
                          ? `"${entry.message_preview}"`
                          : ""
                        : reasonLabel[entry.reason ?? ""] || entry.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchEntries(page + 1)}
            disabled={loading}
            className="w-full text-xs"
          >
            <ChevronDown className="w-3 h-3 mr-1" />
            Ver mais
          </Button>
        )}

        {stats.blocked > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            🚨 {stats.blocked} tentativa(s) bloqueada(s) nas últimas 24h.{" "}
            Se você não reconhece esses números, sua segurança está funcionando.
          </div>
        )}
      </div>
    </GlassCard>
  );
}
