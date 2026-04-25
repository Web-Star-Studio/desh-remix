import { useMemo } from "react";
import { BarChart3, MessageSquare, Wrench, Brain, TrendingUp, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import type { AIConversation } from "@/hooks/ai/useAIConversations";

interface AIStatsPanelProps {
  conversations: AIConversation[];
  memories: Array<{ id: string; content: string; category: string }>;
}

/** Map tool function names to human-readable categories */
const TOOL_CATEGORY_MAP: Record<string, string> = {
  add_task: "Tarefas", complete_task: "Tarefas", delete_task: "Tarefas", edit_task: "Tarefas", get_tasks: "Tarefas",
  add_subtask: "Tarefas", complete_subtask: "Tarefas", delete_subtask: "Tarefas", get_subtasks: "Tarefas",
  add_note: "Notas", edit_note: "Notas", delete_note: "Notas", favorite_note: "Notas", set_note_tags: "Notas", get_notes: "Notas",
  add_calendar_event: "Calendário", edit_calendar_event: "Calendário", delete_calendar_event: "Calendário", set_event_category: "Calendário", get_calendar_events: "Calendário",
  add_contact: "Contatos", edit_contact: "Contatos", delete_contact: "Contatos", search_contacts: "Contatos", get_contacts: "Contatos",
  add_finance_transaction: "Finanças", get_finance_summary: "Finanças", add_finance_goal: "Finanças", update_finance_goal: "Finanças", get_finance_goals: "Finanças",
  add_finance_recurring: "Finanças", delete_finance_recurring: "Finanças", toggle_finance_recurring: "Finanças", get_finance_recurring: "Finanças",
  get_habits: "Hábitos", add_habit: "Hábitos", complete_habit: "Hábitos", delete_habit: "Hábitos",
  navigate_to: "Navegação", set_theme: "Tema", set_wallpaper: "Tema", update_profile: "Perfil",
  save_memory: "Memórias", get_memories: "Memórias", delete_memory: "Memórias",
  web_search: "Busca Web",
  add_knowledge: "Conhecimento", search_knowledge: "Conhecimento", get_knowledge: "Conhecimento", delete_knowledge: "Conhecimento",
  get_automations: "Automações", create_automation: "Automações", toggle_automation: "Automações", delete_automation: "Automações",
  get_emails: "E-mails", search_emails: "E-mails", get_email_stats: "E-mails",
  get_files: "Arquivos", search_files: "Arquivos", delete_file: "Arquivos",
  
  suggest_replies: "Sistema",
  get_dashboard_summary: "Sistema", get_current_time: "Sistema",
  get_connections: "Sistema", get_workspaces: "Sistema", switch_workspace: "Sistema",
  get_whatsapp_status: "WhatsApp",
};

/** Detect tool calls from assistant message content using action result markers */
function extractToolsFromContent(content: string): string[] {
  const tools: string[] = [];
  // Match patterns like "✅ Tarefa criada" or "[tool_name]" or "Resultados das ações"
  const actionMarkers = [
    { pattern: /tarefa\s+(criada|concluída|excluída|editada)/gi, tool: "Tarefas" },
    { pattern: /nota\s+(criada|excluída|editada|favoritada)/gi, tool: "Notas" },
    { pattern: /evento\s+(criado|excluído|editado|adicionado)/gi, tool: "Calendário" },
    { pattern: /contato\s+(criado|excluído|editado|adicionado)/gi, tool: "Contatos" },
    { pattern: /transação\s+(registrada|criada|adicionada)/gi, tool: "Finanças" },
    { pattern: /meta\s+(criada|atualizada)/gi, tool: "Finanças" },
    { pattern: /hábito\s+(criado|completado|excluído)/gi, tool: "Hábitos" },
    { pattern: /memória\s+(salva|excluída)/gi, tool: "Memórias" },
    { pattern: /busca.*web|resultado.*busca/gi, tool: "Busca Web" },
    { pattern: /automação\s+(criada|ativada|desativada|excluída)/gi, tool: "Automações" },
    { pattern: /tema\s+(alterado|mudado)/gi, tool: "Tema" },
    { pattern: /wallpaper\s+(alterado|mudado)/gi, tool: "Tema" },
    { pattern: /navegando|abrindo\s+página/gi, tool: "Navegação" },
  ];

  for (const marker of actionMarkers) {
    if (marker.pattern.test(content)) {
      tools.push(marker.tool);
    }
  }
  return tools;
}

const AIStatsPanel = ({ conversations, memories }: AIStatsPanelProps) => {
  const stats = useMemo(() => {
    let totalMessages = 0;
    let userMessages = 0;
    let assistantMessages = 0;
    let toolMentions = 0;
    const toolNames = new Map<string, number>();
    const dailyMap = new Map<string, number>();
    const memoryCategories = new Map<string, number>();

    for (const conv of conversations) {
      for (const msg of conv.messages) {
        totalMessages++;
        if (msg.role === "user") userMessages++;
        else {
          assistantMessages++;
          const content = typeof msg.content === "string" ? msg.content : "";
          const detectedTools = extractToolsFromContent(content);
          toolMentions += detectedTools.length;
          for (const tool of detectedTools) {
            toolNames.set(tool, (toolNames.get(tool) || 0) + 1);
          }
        }
      }

      // Daily activity
      const day = conv.updated_at.split("T")[0];
      dailyMap.set(day, (dailyMap.get(day) || 0) + conv.messages.length);
    }

    // Memory categories
    for (const m of memories) {
      memoryCategories.set(m.category, (memoryCategories.get(m.category) || 0) + 1);
    }

    // Recent 7 days activity
    const today = new Date();
    const recentDays: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      recentDays.push({ label: dayLabel, count: dailyMap.get(key) || 0 });
    }

    const topTools = Array.from(toolNames.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topCategories = Array.from(memoryCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Avg messages per conversation
    const avgMsgsPerConv = conversations.length > 0 ? Math.round(totalMessages / conversations.length) : 0;

    return {
      totalConversations: conversations.length,
      totalMessages,
      userMessages,
      assistantMessages,
      toolMentions,
      memoriesCount: memories.length,
      topTools,
      topCategories,
      recentDays,
      avgMsgsPerConv,
    };
  }, [conversations, memories]);

  const maxDayCount = Math.max(...stats.recentDays.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" /> Estatísticas de Uso
      </h3>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: MessageSquare, label: "Conversas", value: stats.totalConversations, sub: `~${stats.avgMsgsPerConv} msgs/conv` },
          { icon: TrendingUp, label: "Mensagens", value: stats.totalMessages },
          { icon: Wrench, label: "Ações IA", value: stats.toolMentions },
          { icon: Brain, label: "Memórias", value: stats.memoriesCount },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="p-2.5 rounded-xl bg-muted/50 border border-border/30"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className="w-3 h-3 text-primary/60" />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-sm font-bold">{stat.value}</p>
            {stat.sub && <p className="text-[10px] text-muted-foreground/50">{stat.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Activity chart - last 7 days */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Atividade (7 dias)</span>
        </div>
        <div className="flex items-end gap-1 h-12">
          {stats.recentDays.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm bg-primary/30 hover:bg-primary/50 transition-colors min-h-[2px]"
                style={{ height: `${Math.max((day.count / maxDayCount) * 100, 4)}%` }}
                title={`${day.label}: ${day.count} mensagens`}
              />
              <span className="text-xs text-muted-foreground">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top tools */}
      {stats.topTools.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wrench className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Top Ferramentas</span>
          </div>
          <div className="space-y-1">
            {stats.topTools.map(([name, count]) => {
              const maxCount = stats.topTools[0][1];
              return (
                <div key={name} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/70">{name}</span>
                    <span className="text-muted-foreground font-mono">{count}</span>
                  </div>
                  <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Memory categories */}
      {stats.topCategories.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Memórias por Categoria</span>
          </div>
          <div className="space-y-1">
            {stats.topCategories.map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="text-foreground/70 capitalize">{cat}</span>
                <span className="text-muted-foreground font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages breakdown */}
      <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border/30">
        <div className="flex justify-between">
          <span>Suas mensagens</span>
          <span className="font-mono">{stats.userMessages}</span>
        </div>
        <div className="flex justify-between">
          <span>Respostas da IA</span>
          <span className="font-mono">{stats.assistantMessages}</span>
        </div>
      </div>
    </div>
  );
};

export default AIStatsPanel;
