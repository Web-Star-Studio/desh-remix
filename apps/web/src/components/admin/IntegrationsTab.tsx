import { useState, useEffect, useMemo, useCallback } from "react";
import { usePlatformIntegrations } from "@/hooks/integrations/usePlatformIntegrations";
import { Switch } from "@/components/ui/switch";
import { useAdminData } from "@/hooks/admin/useAdminData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, Search, CheckCircle2, XCircle, Clock, ToggleLeft,
  AlertTriangle, Users, Plug, Mail, Calendar, FileText,
  CheckSquare, HardDrive, Image, RefreshCw, Activity,
} from "lucide-react";

// ── Descriptions & mappings ──
const DESCRIPTIONS: Record<string, string> = {
  google: "Gmail, Calendar, Tasks, Contatos, Drive, Meet",
  whatsapp: "Conexão WhatsApp Web, mensagens, Pandora WA",
  pluggy: "Conexões bancárias via Pluggy (Open Banking Brasil)",
};

const CATEGORY_MAP: Record<string, string> = {
  google: "Google",
  whatsapp: "WhatsApp",
  pluggy: "Open Banking",
};

// ── Composio toolkit config ──
const COMPOSIO_TOOLKITS = [
  { id: "gmail", label: "Gmail", icon: Mail, color: "text-red-400" },
  { id: "googlecalendar", label: "Calendar", icon: Calendar, color: "text-blue-400" },
  { id: "googletasks", label: "Tasks", icon: CheckSquare, color: "text-green-400" },
  { id: "googledrive", label: "Drive", icon: HardDrive, color: "text-amber-400" },
  { id: "googledocs", label: "Docs", icon: FileText, color: "text-indigo-400" },
  { id: "googlephotos", label: "Photos", icon: Image, color: "text-pink-400" },
];

interface ComposioStat { toolkit: string; user_count: number; }
interface ConnectionLog { id: string; action: string; user_email: string | null; details: any; created_at: string; }

const IntegrationsTab = () => {
  const { integrations, loading, toggleIntegration } = usePlatformIntegrations();
  const { logAction, logs } = useAdminData();
  const [toggling, setToggling] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [composioStats, setComposioStats] = useState<ComposioStat[]>([]);
  const [composioLoading, setComposioLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"platform" | "composio" | "logs">("platform");

  // ── Fetch Composio adoption stats ──
  const fetchComposioStats = useCallback(async () => {
    setComposioLoading(true);
    try {
      const { data, error } = await supabase
        .from("composio_user_emails")
        .select("toolkit, user_id");
      if (!error && data) {
        const map = new Map<string, Set<string>>();
        data.forEach((row: any) => {
          if (!map.has(row.toolkit)) map.set(row.toolkit, new Set());
          map.get(row.toolkit)!.add(row.user_id);
        });
        const stats: ComposioStat[] = Array.from(map.entries()).map(([toolkit, users]) => ({
          toolkit,
          user_count: users.size,
        }));
        setComposioStats(stats);
      }
    } catch (e) {
      console.error("Error fetching composio stats:", e);
    } finally {
      setComposioLoading(false);
    }
  }, []);

  useEffect(() => { fetchComposioStats(); }, [fetchComposioStats]);

  // ── Platform integration stats ──
  const stats = useMemo(() => {
    const active = integrations.filter(i => i.enabled).length;
    const inactive = integrations.length - active;
    const lastUpdated = integrations.reduce((latest, i) => {
      if (!i.updated_at) return latest;
      return !latest || new Date(i.updated_at) > new Date(latest) ? i.updated_at : latest;
    }, "" as string);
    return { total: integrations.length, active, inactive, lastUpdated };
  }, [integrations]);

  const totalComposioUsers = useMemo(() => {
    const uniqueUsers = new Set<string>();
    composioStats.forEach(s => {
      // We only have count, but we need unique users across toolkits
    });
    return composioStats.reduce((sum, s) => Math.max(sum, s.user_count), 0);
  }, [composioStats]);

  // ── Connection logs from admin_logs ──
  const connectionLogs = useMemo(() => {
    return logs.filter(l =>
      l.action.includes("integration") ||
      l.action.includes("connect") ||
      l.action.includes("composio") ||
      l.action.includes("oauth")
    ).slice(0, 20);
  }, [logs]);

  const filtered = useMemo(() => {
    return integrations.filter(i => {
      if (statusFilter === "active" && !i.enabled) return false;
      if (statusFilter === "inactive" && i.enabled) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return i.label.toLowerCase().includes(s) ||
          i.id.toLowerCase().includes(s) ||
          (DESCRIPTIONS[i.id] || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [integrations, searchTerm, statusFilter]);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    if (currentEnabled && confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setToggling(id);
    try {
      const newState = !currentEnabled;
      await toggleIntegration(id, newState);
      await logAction("integration_toggle", { integration_id: id, enabled: newState });
      toast({ title: newState ? "Integração ativada" : "Integração desativada", description: `${id} foi ${newState ? "ativada" : "desativada"}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao alterar integração", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Overview Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: ToggleLeft, label: "Plataformas", value: stats.total, color: "text-primary" },
          { icon: CheckCircle2, label: "Ativas", value: stats.active, color: "text-green-500" },
          { icon: XCircle, label: "Inativas", value: stats.inactive, color: "text-destructive" },
          { icon: Plug, label: "Toolkits Composio", value: composioStats.length, color: "text-blue-500" },
          { icon: Users, label: "Usuários c/ Composio", value: totalComposioUsers, color: "text-amber-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Section Tabs ── */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {[
          { id: "platform" as const, label: "Plataformas", icon: ToggleLeft },
          { id: "composio" as const, label: "Composio Adoption", icon: Plug },
          { id: "logs" as const, label: "Logs de Conexão", icon: Activity },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Section: Platform Integrations ── */}
      {activeSection === "platform" && (
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Controle de Plataformas</h3>
              <p className="text-xs text-muted-foreground">
                Integrações desativadas ficam ocultas para todos os usuários.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground w-36 outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="all">Todos</option>
                <option value="active">Ativas</option>
                <option value="inactive">Inativas</option>
              </select>
            </div>
          </div>

          {stats.lastUpdated && (
            <p className="text-[10px] text-muted-foreground mb-3">
              Última alteração: {format(new Date(stats.lastUpdated), "dd MMM yyyy, HH:mm", { locale: ptBR })}
            </p>
          )}

          <div className="space-y-2">
            {filtered.map((integration) => (
              <div key={integration.id}>
                <div
                  className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                    integration.enabled
                      ? "bg-foreground/[0.02] border-border/50"
                      : "bg-destructive/[0.05] border-destructive/20"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{integration.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{integration.label}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          {CATEGORY_MAP[integration.id] || "Outro"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {DESCRIPTIONS[integration.id] || integration.id}
                      </p>
                      {integration.updated_at && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          Atualizado em {format(new Date(integration.updated_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      integration.enabled
                        ? "bg-green-500/15 text-green-600"
                        : "bg-destructive/15 text-destructive"
                    }`}>
                      {integration.enabled ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={() => handleToggle(integration.id, integration.enabled)}
                      disabled={toggling === integration.id}
                    />
                  </div>
                </div>

                {confirmId === integration.id && (
                  <div className="flex items-center gap-3 px-4 py-2.5 mt-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 flex-1">
                      Desativar <strong>{integration.label}</strong> irá ocultar para todos os usuários. Continuar?
                    </p>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2.5 py-1 rounded-lg bg-background border border-border text-xs text-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleToggle(integration.id, integration.enabled)}
                        disabled={toggling === integration.id}
                        className="px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
                      >
                        {toggling === integration.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Desativar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-xs">
                {searchTerm ? "Nenhuma integração encontrada." : "Nenhuma integração cadastrada."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section: Composio Adoption ── */}
      {activeSection === "composio" && (
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Adoção de Toolkits Composio</h3>
              <p className="text-xs text-muted-foreground">
                Quantos usuários conectaram cada serviço via Composio OAuth.
              </p>
            </div>
            <button
              onClick={fetchComposioStats}
              disabled={composioLoading}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${composioLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {composioLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {COMPOSIO_TOOLKITS.map(({ id, label, icon: Icon, color }) => {
                const stat = composioStats.find(s => s.toolkit === id || s.toolkit === label.toLowerCase());
                const count = stat?.user_count || 0;
                return (
                  <div
                    key={id}
                    className={`relative p-4 rounded-xl border transition-all ${
                      count > 0
                        ? "bg-foreground/[0.02] border-border/50"
                        : "bg-muted/30 border-border/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-xs font-medium text-foreground">{label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {count === 1 ? "usuário conectado" : "usuários conectados"}
                    </p>
                    {count > 0 && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Extra toolkits not in predefined list */}
          {composioStats.filter(s => !COMPOSIO_TOOLKITS.some(t => t.id === s.toolkit)).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-[11px] text-muted-foreground mb-2 font-medium">Outros toolkits</p>
              <div className="flex flex-wrap gap-2">
                {composioStats
                  .filter(s => !COMPOSIO_TOOLKITS.some(t => t.id === s.toolkit))
                  .map(s => (
                    <span
                      key={s.toolkit}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-muted text-foreground border border-border/50"
                    >
                      {s.toolkit}: <strong>{s.user_count}</strong>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section: Connection Logs ── */}
      {activeSection === "logs" && (
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Logs de Conexão</h3>
            <p className="text-xs text-muted-foreground">
              Histórico de ações de integração realizadas por administradores.
            </p>
          </div>

          {connectionLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              Nenhum log de integração encontrado.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {connectionLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-foreground/[0.02] border border-border/30"
                >
                  <div className="mt-0.5">
                    <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      {log.details?.integration_id && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {log.details.integration_id}
                        </span>
                      )}
                      {log.details?.enabled !== undefined && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          log.details.enabled
                            ? "bg-green-500/15 text-green-600"
                            : "bg-destructive/15 text-destructive"
                        }`}>
                          {log.details.enabled ? "ativou" : "desativou"}
                        </span>
                      )}
                    </div>
                    {log.user_email && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">por {log.user_email}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0">
                    {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IntegrationsTab;
