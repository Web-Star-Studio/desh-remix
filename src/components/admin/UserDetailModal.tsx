import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock, Database, Plug, CalendarDays, Loader2, ScrollText,
  CreditCard, Wallet, TrendingUp, CheckSquare, FolderOpen,
  Star, Activity, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  data_count: number;
  credits_balance?: number;
  credits_spent?: number;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  workspaces_count?: number;
  tasks_count?: number;
  notes_count?: number;
  connections_count?: number;
}

interface DataByType { data_type: string; count: number; }
interface Connection { name: string; category: string; platform: string; status: string; created_at: string; }
interface RelatedLog { action: string; user_email: string | null; created_at: string; details: Record<string, any>; }
interface CreditHistoryItem { action: string; amount: number; description: string | null; created_at: string; }
interface WorkspaceItem { id: string; name: string; icon: string | null; color: string | null; is_default: boolean; created_at: string; }
interface ActivityLogItem { action: string; metadata: Record<string, any> | null; created_at: string; }
interface UserDetails {
  data_by_type: DataByType[];
  connections: Connection[];
  related_logs: RelatedLog[];
  credits: { balance: number; total_earned: number; total_spent: number } | null;
  credit_history: CreditHistoryItem[];
  subscription: { plan: string; status: string; trial_ends_at: string | null; created_at: string } | null;
  workspaces: WorkspaceItem[];
  tasks_summary: { total: number; done: number; in_progress: number; pending: number } | null;
  activity_logs: ActivityLogItem[];
  
}

interface UserDetailModalProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserDetailModal = ({ user, open, onOpenChange }: UserDetailModalProps) => {
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !open) { setDetails(null); return; }
    const fetchDetails = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("admin_get_user_details", { _target_user_id: user.id } as any);
      if (!error && data) setDetails(data as unknown as UserDetails);
      setLoading(false);
    };
    fetchDetails();
  }, [user, open]);

  if (!user) return null;

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(parseISO(d), "dd MMM yyyy, HH:mm", { locale: ptBR }); } catch { return d; }
  };

  const timeOnPlatform = () => {
    try { return formatDistanceToNow(parseISO(user.created_at), { locale: ptBR, addSuffix: false }); } catch { return "—"; }
  };

  const lastLoginAgo = () => {
    if (!user.last_sign_in_at) return "Nunca";
    try { return formatDistanceToNow(parseISO(user.last_sign_in_at), { locale: ptBR, addSuffix: true }); } catch { return "—"; }
  };

  const tasksDone = details?.tasks_summary?.done ?? 0;
  const tasksTotal = details?.tasks_summary?.total ?? 0;
  const taskRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {user.avatar_url && <AvatarImage src={user.avatar_url} />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {(user.display_name || user.email || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base truncate">{user.display_name || "Sem nome"}</DialogTitle>
              <DialogDescription className="text-xs truncate">{user.email}</DialogDescription>
            </div>
            <div className="flex gap-1.5">
              <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px]">{user.role}</Badge>
              {user.email_confirmed_at && <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Verificado</Badge>}
              {user.subscription_plan && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{user.subscription_plan}</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
          <MetricCard icon={CalendarDays} label="Na plataforma" value={timeOnPlatform()} />
          <MetricCard icon={Clock} label="Último login" value={lastLoginAgo()} />
          <MetricCard icon={Wallet} label="Créditos" value={String(user.credits_balance ?? 0)} accent />
          <MetricCard icon={CreditCard} label="Gastos" value={String(user.credits_spent ?? 0)} />
          <MetricCard icon={CheckSquare} label="Tarefas" value={`${tasksDone}/${tasksTotal}`} />
          <MetricCard icon={Database} label="Dados" value={String(user.data_count)} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : details ? (
          <Tabs defaultValue="overview" className="mt-3">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview" className="text-[11px]">Visão Geral</TabsTrigger>
              <TabsTrigger value="credits" className="text-[11px]">Créditos</TabsTrigger>
              <TabsTrigger value="activity" className="text-[11px]">Atividade</TabsTrigger>
              <TabsTrigger value="connections" className="text-[11px]">Conexões</TabsTrigger>
              <TabsTrigger value="admin" className="text-[11px]">Admin Logs</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-3">
              {/* Workspaces */}
              {details.workspaces.length > 0 && (
                <Section title="Workspaces" icon={FolderOpen}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {details.workspaces.map(w => (
                      <div key={w.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                        <span className="text-base">{w.icon || "📁"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{w.name}</p>
                          {w.is_default && <span className="text-[9px] text-primary">Padrão</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Tasks Summary */}
              {details.tasks_summary && details.tasks_summary.total > 0 && (
                <Section title="Tarefas" icon={CheckSquare}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${taskRate}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{taskRate}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <MiniStat label="Pendente" value={details.tasks_summary.pending} />
                    <MiniStat label="Em progresso" value={details.tasks_summary.in_progress} />
                    <MiniStat label="Concluído" value={details.tasks_summary.done} accent />
                  </div>
                </Section>
              )}

              {/* Data by type */}
              {details.data_by_type.length > 0 && (
                <Section title="Dados por tipo" icon={Database}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {details.data_by_type.map(d => (
                      <div key={d.data_type} className="flex items-center justify-between px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                        <span className="text-xs text-foreground font-medium truncate">{d.data_type}</span>
                        <span className="text-xs text-muted-foreground font-mono ml-2">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

            </TabsContent>

            {/* Credits Tab */}
            <TabsContent value="credits" className="space-y-4 mt-3">
              {details.credits && (
                <div className="grid grid-cols-3 gap-2">
                  <MetricCard icon={Wallet} label="Saldo" value={String(details.credits.balance)} accent />
                  <MetricCard icon={ArrowUp} label="Total ganho" value={String(details.credits.total_earned)} />
                  <MetricCard icon={ArrowDown} label="Total gasto" value={String(details.credits.total_spent)} />
                </div>
              )}

              {details.subscription && (
                <Section title="Assinatura" icon={CreditCard}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground capitalize">{details.subscription.plan}</p>
                      <p className="text-[10px] text-muted-foreground">Desde {fmtDate(details.subscription.created_at)}</p>
                    </div>
                    <Badge variant={details.subscription.status === "active" ? "default" : "secondary"} className="text-[10px]">
                      {details.subscription.status}
                    </Badge>
                  </div>
                </Section>
              )}

              {details.credit_history.length > 0 && (
                <Section title="Histórico de créditos" icon={ScrollText}>
                  <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                    {details.credit_history.map((ch, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${ch.amount > 0 ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                          {ch.amount > 0 ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : ch.amount < 0 ? <ArrowDown className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{ch.description || ch.action}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtDate(ch.created_at)}</p>
                        </div>
                        <span className={`text-xs font-mono font-semibold ${ch.amount > 0 ? "text-emerald-400" : "text-destructive"}`}>
                          {ch.amount > 0 ? "+" : ""}{ch.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4 mt-3">
              {details.activity_logs.length > 0 ? (
                <Section title="Atividade recente" icon={Activity}>
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {details.activity_logs.map((al, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                        <Activity className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{al.action}</p>
                          {al.metadata && Object.keys(al.metadata).length > 0 && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {Object.entries(al.metadata).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(al.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-6">Nenhum log de atividade encontrado.</p>
              )}
            </TabsContent>

            {/* Connections Tab */}
            <TabsContent value="connections" className="space-y-4 mt-3">
              {details.connections.length > 0 && (
                <Section title="Integrações" icon={Plug}>
                  <div className="space-y-2">
                    {details.connections.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Plug className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.platform} · {c.category}</p>
                        </div>
                        <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {details.connections.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">Nenhuma conexão encontrada.</p>
              )}
            </TabsContent>

            {/* Admin Logs Tab */}
            <TabsContent value="admin" className="space-y-4 mt-3">
              {details.related_logs.length > 0 ? (
                <Section title="Ações administrativas" icon={ScrollText}>
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {details.related_logs.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{l.action}</Badge>
                            <span className="text-[10px] text-muted-foreground">{l.user_email}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : (
                <p className="text-center text-xs text-muted-foreground py-6">Nenhum log administrativo.</p>
              )}
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border/30">
          Cadastro: {fmtDate(user.created_at)} · ID: {user.id.slice(0, 8)}…
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MetricCard = ({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-xl p-3 bg-foreground/[0.03] border border-border/30 ${accent ? "ring-1 ring-primary/20" : ""}`}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3 h-3 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
    <p className={`text-sm font-semibold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
  </div>
);

const MiniStat = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className="px-3 py-2 rounded-xl bg-foreground/[0.03] border border-border/30 text-center">
    <p className={`text-sm font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <h4 className="text-xs font-semibold text-foreground">{title}</h4>
    </div>
    {children}
  </div>
);

export default UserDetailModal;
