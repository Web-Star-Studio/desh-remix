import { useState } from "react";
import { useAdminRole } from "@/hooks/admin/useAdminRole";
import { usePandoraDebug } from "@/hooks/ai/usePandoraDebug";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Activity, Zap, Clock, CheckCircle, ChevronDown, ChevronRight, Brain, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  retry: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const CHANNEL_ICONS: Record<string, string> = {
  chat: "💬", mcp: "🔌", whatsapp: "📱", "whatsapp-mcp": "📱🔌",
};

export default function PandoraDebugPage() {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const { session, toolCalls, metrics, loading, error, refresh, clearSession } = usePandoraDebug();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const navigate = useNavigate();

  if (roleLoading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Brain className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Pandora Debug</h1>
            <p className="text-xs text-muted-foreground">Observabilidade de sessões e tool calls</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Calls hoje", value: metrics.totalToday, icon: Zap, color: "text-primary" },
          { label: "Taxa de sucesso", value: `${metrics.successRate}%`, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Tool mais usado", value: metrics.topTool, icon: Activity, color: "text-blue-400" },
          { label: "Duração média", value: metrics.avgDurationMs > 0 ? `${metrics.avgDurationMs}ms` : "—", icon: Clock, color: "text-amber-400" },
        ].map((m) => (
          <Card key={m.label} className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <m.icon className={`w-5 h-5 ${m.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className="text-sm font-semibold truncate">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Session */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Sessão Ativa</CardTitle>
          {session && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearSession}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {!session ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma sessão ativa (últimos 30 min)</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Canal</span>
                <p className="font-medium">{CHANNEL_ICONS[session.active_channel] || "❓"} {session.active_channel}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Última atividade</span>
                <p className="font-medium">{formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true, locale: ptBR })}</p>
              </div>
              {session.context_snapshot && Object.keys(session.context_snapshot).length > 0 && (
                <div className="md:col-span-2">
                  <span className="text-muted-foreground text-xs">Context Snapshot</span>
                  <pre className="mt-1 p-2 bg-muted/30 rounded text-xs overflow-x-auto max-h-40 scrollbar-thin">
                    {JSON.stringify(session.context_snapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool Calls Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tool Calls (últimas 50)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {toolCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-4">Nenhum tool call registrado</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left p-2 pl-4 font-medium w-6"></th>
                    <th className="text-left p-2 font-medium">Timestamp</th>
                    <th className="text-left p-2 font-medium">Tool</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Categoria</th>
                    <th className="text-left p-2 font-medium hidden sm:table-cell">Canal</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium hidden md:table-cell">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {toolCalls.map((tc) => {
                    const isExpanded = expandedRow === tc.id;
                    const duration = tc.started_at && tc.completed_at
                      ? `${new Date(tc.completed_at).getTime() - new Date(tc.started_at).getTime()}ms`
                      : "—";
                    return (
                      <ToolCallRow
                        key={tc.id}
                        tc={tc}
                        duration={duration}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedRow(isExpanded ? null : tc.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ToolCallRow({ tc, duration, isExpanded, onToggle }: {
  tc: any; duration: string; isExpanded: boolean; onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="p-2 pl-4">
          {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </td>
        <td className="p-2 text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(tc.created_at), { addSuffix: true, locale: ptBR })}
        </td>
        <td className="p-2 font-mono font-medium">{tc.tool_name}</td>
        <td className="p-2 text-muted-foreground hidden md:table-cell">{tc.tool_category}</td>
        <td className="p-2 hidden sm:table-cell">{CHANNEL_ICONS[tc.channel] || tc.channel}</td>
        <td className="p-2">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[tc.status] || "bg-muted text-muted-foreground"}`}>
            {tc.status}
          </Badge>
        </td>
        <td className="p-2 text-muted-foreground hidden md:table-cell">{duration}</td>
      </tr>
      {isExpanded && (
        <tr className="bg-muted/10">
          <td colSpan={7} className="p-3 pl-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {tc.input_params && Object.keys(tc.input_params).length > 0 && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Input</p>
                  <pre className="p-2 bg-muted/30 rounded overflow-x-auto max-h-32 scrollbar-thin">
                    {JSON.stringify(tc.input_params, null, 2)}
                  </pre>
                </div>
              )}
              {tc.output_result && Object.keys(tc.output_result).length > 0 && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Output</p>
                  <pre className="p-2 bg-muted/30 rounded overflow-x-auto max-h-32 scrollbar-thin">
                    {JSON.stringify(tc.output_result, null, 2)}
                  </pre>
                </div>
              )}
              {tc.error_message && (
                <div className="md:col-span-2">
                  <p className="text-destructive font-medium mb-1">Erro</p>
                  <p className="text-destructive/80">{tc.error_message}</p>
                </div>
              )}
              {tc.retry_count > 0 && (
                <p className="text-muted-foreground">Retries: {tc.retry_count}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
