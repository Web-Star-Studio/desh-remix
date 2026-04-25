import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bug,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import WidgetEmptyState from "./WidgetEmptyState";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/admin/useAdminRole";

interface ErrorRow {
  id: string;
  severity: string;
  module: string | null;
  message: string;
  stack: string | null;
  metadata: Record<string, unknown> | null;
  url: string | null;
  created_at: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  warning: "bg-warning/15 text-warning border-warning/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive/25 text-destructive border-destructive/50",
};

/** Heuristic: errors that look like edge-function boot/runtime failures */
const FN_KEYWORDS = [
  "BOOT_ERROR",
  "boot",
  "edge",
  "function",
  "FunctionsHttpError",
  "FunctionsRelayError",
  "Deno",
  "WORKER",
];

function isFunctionError(r: ErrorRow): boolean {
  const haystack = `${r.module || ""} ${r.message || ""} ${JSON.stringify(r.metadata || {})}`.toLowerCase();
  return FN_KEYWORDS.some(k => haystack.includes(k.toLowerCase()));
}

export default function SystemErrorsWidget() {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(); // last 7 days
      const { data } = await (supabase.from("error_reports") as any)
        .select("id,severity,module,message,stack,metadata,url,created_at")
        .in("severity", ["error", "critical", "warning"])
        .eq("resolved", false)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      setRows((data || []) as ErrorRow[]);
    } catch (err) {
      console.error("[SystemErrorsWidget] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!roleLoading && isAdmin) fetchRows();
  }, [roleLoading, isAdmin, fetchRows]);

  const fnErrors = useMemo(() => rows.filter(isFunctionError).slice(0, 10), [rows]);

  // Don't render for non-admins
  if (roleLoading) {
    return (
      <GlassCard size="standard">
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      </GlassCard>
    );
  }
  if (!isAdmin) return null;

  return (
    <GlassCard size="standard">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <WidgetTitle
            icon={<ShieldAlert className="w-4 h-4 text-destructive" />}
            label="Erros do Sistema"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={fetchRows}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-foreground/5 transition-colors focusable"
              aria-label="Atualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => navigate("/admin?tab=errors")}
              className="p-1.5 rounded-md hover:bg-foreground/5 transition-colors focusable"
              aria-label="Abrir painel completo"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Counter */}
        {!loading && (
          <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-mono">
              {fnErrors.length} func
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              {rows.length} total
            </Badge>
            <span className="ml-auto">últimos 7 dias</span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-foreground/[0.04] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : fnErrors.length === 0 ? (
            <WidgetEmptyState
              icon={Bug}
              title="Tudo limpo"
              description="Nenhum erro de função recente."
            />
          ) : (
            fnErrors.map(row => (
              <ErrorItem
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
              />
            ))
          )}
        </div>
      </div>
    </GlassCard>
  );
}

interface ErrorItemProps {
  row: ErrorRow;
  expanded: boolean;
  onToggle: () => void;
}

function ErrorItem({ row, expanded, onToggle }: ErrorItemProps) {
  const severityClass = SEVERITY_BADGE[row.severity] || SEVERITY_BADGE.error;
  const fnName = (row.metadata?.function as string) || row.module || "edge-function";
  const isBootError =
    row.message?.includes("BOOT_ERROR") ||
    (row.metadata?.code as string)?.includes("BOOT");

  return (
    <div className="rounded-lg border border-border/60 bg-foreground/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 p-2 text-left hover:bg-foreground/[0.04] transition-colors focusable"
      >
        <div className="mt-0.5">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] uppercase font-mono ${severityClass}`}>
              {row.severity}
            </Badge>
            {isBootError && (
              <Badge variant="outline" className="text-[9px] uppercase font-mono bg-destructive/10 text-destructive border-destructive/30">
                BOOT
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground font-mono truncate">{fnName}</span>
          </div>
          <p className="text-xs text-foreground line-clamp-2 leading-snug">{row.message}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-border/60 bg-background/40">
          {row.stack ? (
            <div>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mt-2 mb-1">Stack trace</p>
              <pre className="text-[10px] font-mono p-2 rounded bg-muted/40 text-foreground/80 overflow-x-auto max-h-40 leading-relaxed">
                {row.stack}
              </pre>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic mt-2">Sem stack trace disponível</p>
          )}

          {row.metadata && Object.keys(row.metadata).length > 0 && (
            <div>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mb-1">Metadata</p>
              <pre className="text-[10px] font-mono p-2 rounded bg-muted/40 text-foreground/80 overflow-x-auto max-h-32">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            </div>
          )}

          {row.url && (
            <p className="text-[10px] text-muted-foreground truncate">
              <span className="font-mono">URL:</span> {row.url}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
