/**
 * Automation rules CRUD — backed by apps/api `/workspaces/:id/automation-rules{,/:id,/logs}`.
 * Wave A: data plane only. Manual `runRule` calls POST .../:id/run which
 * dispatches a curated subset (create_task, create_note, send_notification);
 * scheduler/event-listener triggers ship in Wave B.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/hooks/use-toast";

// Types — canonical definitions live in /src/types/automations.ts
export type { AutomationRule, AutomationLog } from "@/types/automations";
import type { AutomationRule, AutomationLog } from "@/types/automations";

export const TRIGGER_TYPES = [
  { value: "email_received", label: "Email recebido", icon: "📧", desc: "Quando um novo email chega" },
  { value: "email_keyword", label: "Email com palavra-chave", icon: "🔑", desc: "Quando email contém palavra-chave específica" },
  { value: "task_created", label: "Tarefa criada", icon: "✅", desc: "Quando uma nova tarefa é criada" },
  { value: "task_completed", label: "Tarefa concluída", icon: "🎉", desc: "Quando uma tarefa é marcada como feita" },
  { value: "task_overdue", label: "Tarefa atrasada", icon: "🚨", desc: "Quando uma tarefa passa da data de vencimento" },
  { value: "event_created", label: "Evento criado", icon: "📅", desc: "Quando um novo evento é adicionado" },
  { value: "contact_added", label: "Contato adicionado", icon: "👤", desc: "Quando um novo contato é adicionado" },
  { value: "contact_low_score", label: "Contato em risco", icon: "⚠️", desc: "Quando um contato cai abaixo do score mínimo" },
  { value: "finance_transaction", label: "Transação financeira", icon: "💰", desc: "Quando uma nova transação é registrada" },
  { value: "habit_incomplete", label: "Hábito não completado", icon: "🔔", desc: "Quando um hábito não é feito até certo horário" },
  { value: "note_created", label: "Nota criada", icon: "📝", desc: "Quando uma nova nota é salva" },
  { value: "scheduled", label: "Agendamento", icon: "⏰", desc: "Executa em intervalo regular (ex: diário)" },
  { value: "whatsapp_received", label: "WhatsApp recebido", icon: "💬", desc: "Quando uma mensagem WhatsApp chega" },
  { value: "social_post_published", label: "Post publicado", icon: "📱", desc: "Quando um post social é publicado" },
  { value: "social_post_failed", label: "Post falhou", icon: "❌", desc: "Quando um post social falha na publicação" },
  { value: "follower_milestone", label: "Marco de seguidores", icon: "🎯", desc: "Quando uma conta atinge X seguidores" },
] as const;

export const ACTION_TYPES = [
  { value: "create_task", label: "Criar tarefa", icon: "📋", desc: "Cria uma nova tarefa automaticamente" },
  { value: "send_notification", label: "Enviar notificação", icon: "🔔", desc: "Envia uma notificação push" },
  { value: "add_tag", label: "Adicionar tag", icon: "🏷️", desc: "Adiciona tag a um contato" },
  { value: "create_note", label: "Criar nota", icon: "📝", desc: "Cria uma nota automaticamente" },
  { value: "create_event", label: "Criar evento", icon: "📅", desc: "Cria um evento no calendário" },
  { value: "send_whatsapp", label: "Enviar WhatsApp", icon: "💬", desc: "Envia mensagem via WhatsApp" },
  { value: "pandora_whatsapp", label: "Pandora → WhatsApp", icon: "🤖", desc: "Pandora processa um prompt com IA e envia via WhatsApp" },
  { value: "create_social_post", label: "Criar post social", icon: "📱", desc: "Cria e agenda um post nas redes sociais" },
  { value: "schedule_post", label: "Agendar post", icon: "📅", desc: "Agenda um post para publicação futura" },
] as const;

export const TEMPLATES = [
  // ── CRM & Contatos ──
  {
    name: "🔥 Contato esfriando → Follow-up urgente",
    trigger_type: "contact_low_score",
    trigger_config: { score_threshold: 25 },
    action_type: "create_task",
    action_config: { title: "🔥 Reativar: {{contact_name}}", description: "Score {{score}} — sem interação há {{days_since}} dias. Envie uma mensagem ou agende reunião.", priority: "high", days_until_due: 2 },
    category: "crm",
  },
  {
    name: "👋 Novo contato → Tag de boas-vindas",
    trigger_type: "contact_added",
    trigger_config: {},
    action_type: "add_tag",
    action_config: { tag: "novo" },
    category: "crm",
  },
  {
    name: "🤝 Novo contato → Tarefa de apresentação",
    trigger_type: "contact_added",
    trigger_config: {},
    action_type: "create_task",
    action_config: { title: "📞 Ligar para {{contact_name}}", description: "Novo contato adicionado — agendar uma apresentação ou primeiro contato.", priority: "medium", days_until_due: 3 },
    category: "crm",
  },
  // ── Produtividade ──
  {
    name: "🚨 Tarefa atrasada 2+ dias → Alerta crítico",
    trigger_type: "task_overdue",
    trigger_config: { days_overdue: 2 },
    action_type: "send_notification",
    action_config: { title: "🚨 Atenção: tarefa atrasada", body: "\"{{title}}\" venceu há {{days_overdue}} dia(s) — reagende ou conclua agora" },
    category: "produtividade",
  },
  {
    name: "✅ Tarefa concluída → Nota de registro",
    trigger_type: "task_completed",
    trigger_config: {},
    action_type: "create_note",
    action_config: { title: "✅ Concluído: {{title}}", content: "Tarefa finalizada em {{date}}. Registrar resultados ou próximos passos." },
    category: "produtividade",
  },
  // ── Email ──
  {
    name: "📧 Email urgente → Tarefa imediata",
    trigger_type: "email_keyword",
    trigger_config: { keywords: "urgente,asap,critical,deadline,importante", match_in: "subject" },
    action_type: "create_task",
    action_config: { title: "📧 URGENTE: {{subject}}", priority: "urgent", days_until_due: 1 },
    category: "email",
  },
  {
    name: "💳 Email com fatura → Tarefa financeira",
    trigger_type: "email_keyword",
    trigger_config: { keywords: "fatura,invoice,pagamento,boleto,cobrança,nf-e,pix", match_in: "subject" },
    action_type: "create_task",
    action_config: { title: "💰 Fatura: {{subject}}", description: "De: {{sender}}", priority: "high", days_until_due: 3 },
    category: "email",
  },
  // ── Finanças ──
  {
    name: "⚠️ Gasto alto → Alerta instantâneo",
    trigger_type: "finance_transaction",
    trigger_config: { min_amount: 500 },
    action_type: "send_notification",
    action_config: { title: "⚠️ Gasto elevado detectado", body: "{{description}}: R$ {{amount}} — verifique se está dentro do orçamento" },
    category: "financas",
  },
  {
    name: "📊 Receita recebida → Nota de registro",
    trigger_type: "finance_transaction",
    trigger_config: { min_amount: 1000 },
    action_type: "create_note",
    action_config: { title: "💵 Receita registrada — {{date}}", content: "{{description}}: R$ {{amount}}. Considere alocar para metas financeiras." },
    category: "financas",
  },
  // ── Hábitos & Rotina ──
  {
    name: "⏰ Hábito pendente → Lembrete noturno",
    trigger_type: "habit_incomplete",
    trigger_config: { check_hour: 20, habit_name: "" },
    action_type: "send_notification",
    action_config: { title: "⏰ Hábito pendente", body: "\"{{habit_name}}\" ainda não foi feito hoje — não quebre seu streak!" },
    category: "habitos",
  },
  {
    name: "💪 Exercício pendente às 19h → Push motivacional",
    trigger_type: "habit_incomplete",
    trigger_config: { check_hour: 19, habit_name: "Exercício" },
    action_type: "send_notification",
    action_config: { title: "💪 Bora treinar!", body: "Seu hábito de exercício está pendente — 30min fazem diferença" },
    category: "habitos",
  },
  // ── Rotina Programada ──
  {
    name: "📋 Review semanal → Tarefa de planejamento",
    trigger_type: "scheduled",
    trigger_config: { schedule_mode: "weekly", days_of_week: [1], hour: 9, minute: 0 },
    action_type: "create_task",
    action_config: { title: "📋 Review semanal — {{date}}", description: "Revise tarefas pendentes, contatos frios e metas financeiras", priority: "medium", days_until_due: 1 },
    category: "rotina",
  },
  {
    name: "📊 Resumo diário → Nota automática",
    trigger_type: "scheduled",
    trigger_config: { schedule_mode: "daily", hour: 22, minute: 0 },
    action_type: "create_note",
    action_config: { title: "📊 Resumo — {{date}}", content: "Registre as principais conquistas e pendências do dia." },
    category: "rotina",
  },
  // ── Pandora IA ──
  {
    name: "🤖 Resumo diário da Pandora",
    trigger_type: "scheduled",
    trigger_config: { schedule_mode: "daily", hour: 7, minute: 30 },
    action_type: "pandora_whatsapp",
    action_config: { prompt: "Faça um resumo completo do meu dia: minhas tarefas pendentes com prioridades, eventos de hoje, hábitos que ainda não fiz e um resumo financeiro do mês. Termine com uma frase motivacional personalizada.", to: "" },
    category: "pandora",
  },
  {
    name: "💪 Coach de hábitos da Pandora",
    trigger_type: "scheduled",
    trigger_config: { schedule_mode: "daily", hour: 20, minute: 0 },
    action_type: "pandora_whatsapp",
    action_config: { prompt: "Analise meus hábitos pendentes de hoje e me dê uma mensagem motivacional personalizada para completá-los. Se já completei todos, me parabenize e sugira novos desafios.", to: "" },
    category: "pandora",
  },
  {
    name: "📊 Relatório semanal da Pandora",
    trigger_type: "scheduled",
    trigger_config: { schedule_mode: "weekly", days_of_week: [5], hour: 18, minute: 0 },
    action_type: "pandora_whatsapp",
    action_config: { prompt: "Faça um relatório semanal completo: quantas tarefas completei, eventos que tive, progresso nos hábitos e resumo financeiro. Dê insights sobre minha produtividade e sugestões de melhoria para a próxima semana.", to: "" },
    category: "pandora",
  },
  // ── WhatsApp ──
  {
    name: "💬 WhatsApp recebido → Tarefa de responder",
    trigger_type: "whatsapp_received",
    trigger_config: {},
    action_type: "create_task",
    action_config: { title: "💬 Responder: {{contact_name}}", description: "Mensagem recebida: \"{{message}}\"", priority: "medium", days_until_due: 1 },
    category: "whatsapp",
  },
  // ── Redes Sociais ──
  {
    name: "📱 Post publicado → Nota de registro",
    trigger_type: "social_post_published",
    trigger_config: {},
    action_type: "create_note",
    action_config: { title: "📱 Post publicado — {{date}}", content: "Post publicado com sucesso nas plataformas: {{platforms}}" },
    category: "social",
  },
  {
    name: "❌ Post falhou → Tarefa urgente",
    trigger_type: "social_post_failed",
    trigger_config: {},
    action_type: "create_task",
    action_config: { title: "❌ Repostar: falha na publicação", description: "O post \"{{content_preview}}\" falhou. Verifique e tente novamente.", priority: "high", days_until_due: 1 },
    category: "social",
  },
  {
    name: "🎯 Marco de seguidores → Notificação",
    trigger_type: "follower_milestone",
    trigger_config: { milestone: 1000 },
    action_type: "send_notification",
    action_config: { title: "🎯 Parabéns!", body: "Sua conta {{platform}} atingiu {{followers}} seguidores!" },
    category: "social",
  },
];

/** Export rules as a JSON blob for backup/sharing */
export function exportRulesAsJson(rules: AutomationRule[]): string {
  const exportable = rules.map(r => ({
    name: r.name,
    enabled: r.enabled,
    trigger_type: r.trigger_type,
    trigger_config: r.trigger_config,
    action_type: r.action_type,
    action_config: r.action_config,
  }));
  return JSON.stringify({ version: 1, rules: exportable }, null, 2);
}

/** Parse an imported JSON and return rules to create */
export function parseImportedRules(json: string): Array<{
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  action_type: string;
  action_config: Record<string, any>;
}> {
  const parsed = JSON.parse(json);
  if (!parsed?.rules || !Array.isArray(parsed.rules)) throw new Error("Formato inválido");
  return parsed.rules.map((r: any) => ({
    name: r.name || "Automação importada",
    enabled: r.enabled ?? false,
    trigger_type: r.trigger_type || "scheduled",
    trigger_config: r.trigger_config || {},
    action_type: r.action_type || "send_notification",
    action_config: r.action_config || {},
  }));
}

type RuleCreateInput = Omit<
  AutomationRule,
  "id" | "user_id" | "execution_count" | "last_executed_at" | "created_at" | "updated_at"
>;

export function useAutomations() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const key = ["automation_rules", activeWorkspaceId];
  const logsKey = ["automation_logs", activeWorkspaceId];

  const { data: rules = [], isLoading } = useQuery({
    queryKey: key,
    staleTime: 10 * 60_000,
    enabled: !!user && !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      const res = await apiFetch<{ rules: AutomationRule[] }>(
        `/workspaces/${activeWorkspaceId}/automation-rules`,
      );
      return res.rules ?? [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: logsKey,
    enabled: !!user && !!activeWorkspaceId,
    queryFn: async () => {
      if (!activeWorkspaceId) return [];
      const res = await apiFetch<{ logs: AutomationLog[] }>(
        `/workspaces/${activeWorkspaceId}/automation-logs`,
      );
      return res.logs ?? [];
    },
  });

  const createRule = useMutation({
    mutationFn: async (rule: RuleCreateInput) => {
      if (!activeWorkspaceId) throw new Error("Selecione um workspace antes de criar automações");
      const res = await apiFetch<{ rule: AutomationRule }>(
        `/workspaces/${activeWorkspaceId}/automation-rules`,
        { method: "POST", body: JSON.stringify(rule) },
      );
      return res.rule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "✅ Automação criada" });
    },
    onError: (err: any) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const createMultipleRules = useMutation({
    mutationFn: async (newRules: RuleCreateInput[]) => {
      if (!activeWorkspaceId) throw new Error("Selecione um workspace antes de importar");
      // No bulk endpoint in Wave A — fan out client-side. Promise.all so
      // failures don't cascade past the first; we report partial success.
      const results = await Promise.allSettled(
        newRules.map((r) =>
          apiFetch<{ rule: AutomationRule }>(
            `/workspaces/${activeWorkspaceId}/automation-rules`,
            { method: "POST", body: JSON.stringify(r) },
          ),
        ),
      );
      return results
        .filter((r): r is PromiseFulfilledResult<{ rule: AutomationRule }> => r.status === "fulfilled")
        .map((r) => r.value.rule);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: `✅ ${data?.length || 0} automação(ões) importada(s)` });
    },
    onError: (err: any) =>
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" }),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomationRule> & { id: string }) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      // Strip server-managed fields; the apps/api PATCH only accepts the
      // mutable subset and 400s on extras.
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        user_id: _u,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        execution_count: _e,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        last_executed_at: _l,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        created_at: _c,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        updated_at: _t,
        ...patch
      } = updates;
      await apiFetch(`/workspaces/${activeWorkspaceId}/automation-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Automação atualizada" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      await apiFetch(`/workspaces/${activeWorkspaceId}/automation-rules/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Automação removida" });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      await apiFetch(`/workspaces/${activeWorkspaceId}/automation-rules/${id}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
    },
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AutomationRule[]>(key);
      if (prev) {
        qc.setQueryData<AutomationRule[]>(
          key,
          prev.map((r) => (r.id === variables.id ? { ...r, enabled: variables.enabled } : r)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const duplicateRule = useMutation({
    mutationFn: async (rule: AutomationRule) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      const res = await apiFetch<{ rule: AutomationRule }>(
        `/workspaces/${activeWorkspaceId}/automation-rules/${rule.id}/duplicate`,
        { method: "POST" },
      );
      return res.rule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: "Automação duplicada" });
    },
  });

  // New in Wave A: manual run from the SPA test button. Doesn't throw on
  // action-level failure — server returns {status: "success"|"error",
  // actionResult} so the UI can render the outcome inline.
  const runRule = useMutation({
    mutationFn: async ({
      id,
      triggerData,
    }: {
      id: string;
      triggerData?: Record<string, unknown>;
    }) => {
      if (!activeWorkspaceId) throw new Error("no_workspace");
      return apiFetch<{
        status: "success" | "error";
        actionResult: Record<string, unknown>;
      }>(`/workspaces/${activeWorkspaceId}/automation-rules/${id}/run`, {
        method: "POST",
        body: JSON.stringify({ triggerData: triggerData ?? {} }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: logsKey });
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return {
    rules,
    logs,
    isLoading,
    createRule,
    createMultipleRules,
    updateRule,
    deleteRule,
    toggleRule,
    duplicateRule,
    runRule,
  };
}
