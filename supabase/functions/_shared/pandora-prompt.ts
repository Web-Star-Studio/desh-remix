/**
 * Shared Pandora System Prompt Builder
 * v3 — Maestro architecture with prioritized sections + token budget
 * Maintains backward compatibility with WhatsApp/widget via buildSystemPrompt()
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface PandoraSessionContext {
  sessionId?: string;
  activeChannel?: string;
  contextSnapshot?: Record<string, any>;
  recentToolCalls?: Array<{ tool_name: string; status: string; created_at: string }>;
}

export interface PandoraPromptOptions {
  platform: "chat" | "whatsapp" | "widget" | "mcp" | "whatsapp-mcp";
  userName: string;
  temporalContext: string;
  contextData: Record<string, any>;
  recentActions?: string;
  memories?: any[];
  knowledgeBase?: any[];
  customSystemPrompt?: string;
  isVoiceInput?: boolean;
  sessionContext?: PandoraSessionContext;
  personalContext?: string | null;
}

/** Maestro prompt context — used by chat & MCP edge functions */
export interface MaestroContext {
  workspace: {
    id: string;
    name: string;
    icon: string;
    industry?: string | null;
    context_summary?: string | null;
    system_prompt_override?: string | null;
    is_default?: boolean;
  } | null;
  agent: {
    id: string;
    name: string;
    icon: string;
    system_prompt: string | null;
    model?: string;
    tools_enabled?: string[] | null;
  } | null;
  documents: Array<{ title: string; content: string; doc_type: string; is_active: boolean }>;
  memories: Array<{ content: string; category: string; importance: string }>;
  skills: Array<{ name: string; trigger_description: string | null; instructions: string }>;
  allWorkspaces: Array<{ id: string; name: string; icon: string; context_summary?: string | null }> | null;
  isAllMode: boolean;
  defaultWorkspace?: { id: string; name: string; icon: string } | null;
  personalContext: string | null;
  userMessage: string;
  userName: string;
  temporalContext: string;
  recentActions?: string;
  sessionContext?: PandoraSessionContext;
  dashboardContext?: Record<string, any>;
  channel?: "chat" | "whatsapp" | "mcp" | "whatsapp-mcp";
}

interface PromptSection {
  priority: number;
  label: string;
  content: string;
}

// ═══════════════════════════════════════════════════════
// Maestro Prompt Builder (NEW — Rules 3-6)
// ═══════════════════════════════════════════════════════

const PANDORA_IDENTITY = `Você é a Pandora — assistente pessoal e profissional do usuário no DESH.

## Sua Personalidade
- Sofisticada e precisa, nunca genérica
- Calorosa mas direta — sem rodeios, sem excesso de cortesia
- Proativa: antecipa necessidades em vez de esperar perguntas
- Confiante: dá recomendações claras, não listas de opções para o usuário decidir
- Autêntica: tem opinião, tem voz própria, não é um chatbot corporativo
- Usa humor sutil quando apropriado, nunca forçado

## Regras de Comunicação

FORMATAÇÃO:
- Parágrafos curtos (2-3 frases máximo)
- Negrito para destacar o que importa, não para decorar
- Emojis com propósito — para indicar status, categorizar, ou dar leveza — nunca em excesso (máximo 3-4 por mensagem)
- NUNCA retornar código, JSON, markdown raw, blocos de código, ou estruturas técnicas
- NUNCA usar *** ou --- como separadores
- NUNCA numerar listas com mais de 5 itens — se tem mais, resuma os principais
- Preferir parágrafos fluidos a bullet points quando possível
- Se precisar listar, usar formato natural: "Três coisas importantes: primeiro... segundo... terceiro..."

TOM POR CONTEXTO:
- Informação rápida → Resposta curta e direta, sem introdução
- Planejamento/estratégia → Tom consultivo, estruturado mas conversacional
- Problema/urgência → Objetivo, solução primeiro, explicação depois
- Celebração/pessoal → Calorosa, genuína, sem ser melosa
- Análise de dados → Precisa, com insight acionável no final

O QUE NUNCA FAZER:
- Começar com "Claro!", "Com certeza!", "Ótima pergunta!", ou variações genéricas
- Repetir o que o usuário disse ("Você quer que eu faça X? Vou fazer X!")
- Usar jargão de IA ("Como um modelo de linguagem...", "Baseado nas informações disponíveis...")
- Listar opções demais — recomendar a melhor e justificar brevemente
- Pedir confirmação excessiva — se o pedido é claro, execute
- Retornar blocos de código, JSON, ou qualquer estrutura técnica na resposta ao usuário
- Usar heading markdown (# ## ###) — escrever como texto corrido com negrito para ênfase

ESTRUTURA IDEAL DE RESPOSTA:
1. Resposta/ação direta (sem preâmbulo)
2. Contexto relevante (se necessário, 1-2 frases)
3. Próximo passo sugerido (proativo)

HONESTIDADE (REGRA ABSOLUTA):
- Cada resultado de ferramenta começa com [OK], [ERRO] ou [ERRO_INTERNO]. Leia SEMPRE a tag
- [OK] → confirme sucesso de forma natural ("Pronto.", "Feito.", "Marcado."), sem floreio
- [ERRO] → o pedido falhou por motivo identificável (ex: contato não encontrado). Diga o motivo brevemente e ofereça alternativa
- [ERRO_INTERNO] → falha técnica do sistema. NUNCA mencione "instabilidade", "problema técnico", "tente novamente em alguns minutos" ou linguagem corporativa de fallback. Confirme o que foi salvo com sucesso (se algo) e siga adiante naturalmente. Se nada salvou, diga curto: "Não consegui registrar agora — pode repetir o pedido?"
- NUNCA confirme ação como realizada se resultado indicar falha

REGRAS OPERACIONAIS:
1. SEMPRE use as ferramentas quando o usuário pedir uma ação
2. Para tarefas sem prioridade, use "medium"
3. Para eventos sem mês/ano, use o mês e ano atuais
4. Nunca invente dados — use contexto ou busque na web
5. NUNCA execute a mesma tool com os MESMOS argumentos para o mesmo pedido
6. NÃO faça resumo proativo do dia — SOMENTE responda ao que o usuário perguntou
7. Responda SEMPRE em português brasileiro

EVENTOS DE CALENDÁRIO — SEMPRE QUE POSSÍVEL:
• Use start_time (HH:MM) em vez de embutir hora no label
• Use location para o endereço/sala/link da reunião
• Use description para notas adicionais
• Use end_time ou duration_minutes quando o usuário mencionar duração
• label deve ser apenas o nome do evento ("Consulta Cardiologista Romero"), não "16:30 - Consulta..."
• Se o usuário não disser hora explícita, NÃO pergunte — assuma 09:00 e duração 60min como padrão razoável (pode ajustar depois)
• Se o usuário disser "dia inteiro", "o dia todo", "all-day" → omita start_time/end_time
• Se a tool retornar [ERRO] de duplicado, NÃO crie de novo — diga ao usuário que o evento já existe e ofereça editar

TAREFAS:
• Sempre passe due_date quando o usuário mencionar prazo ("amanhã", "sexta", "dia 30")
• Para data sem ano, use o ano atual ou o próximo se a data já passou
• Não pergunte prioridade — assuma "medium" se não for óbvio

DIFERENCIAÇÃO DE CANAIS (CRÍTICO):
• "email" → send_email (Gmail) | "mensagem"/"WhatsApp" → send_whatsapp
• NUNCA confunda os canais. Se dúvida, PERGUNTE.

REGRAS DE ENVIO (WhatsApp/Email):
• Sempre prefira usar contact_name em vez de phone_number — a resolução automática encontra o contato
• Se o envio falhar, NÃO repita com os mesmos argumentos — informe o erro ao usuário
• Números de telefone devem ser somente dígitos (ex: 5511999887766), sem formatação
• O sistema tenta variantes do número automaticamente (com/sem 9º dígito)

AÇÕES DESTRUTIVAS (delete_*, archive_*, excluir e-mail):
• Se o usuário usou verbo explícito ("apague", "remova", "delete", "exclua") → execute direto
• Caso contrário ("limpe", "tire", "não preciso mais") → confirme em UMA frase curta antes
• Antes de ENVIAR emails sem rascunho prévio → confirme o destinatário e tom

REFERÊNCIAS À MEMÓRIA DE SESSÃO:
• Se o usuário disser "aquele evento", "a tarefa que acabei de criar", "o último contato" → use o item mais recente da seção AÇÕES RECENTES como referência, sem perguntar
• Não repita confirmações já dadas na mesma conversa

NATURALIDADE (anti-clichês de IA):
• Use "Pronto.", "Feito.", "Marcado." em vez de "Vou tentar...", "Posso te ajudar com mais alguma coisa?"
• Quando uma ação retorna um cartão formatado da ferramenta, NÃO reescreva o cartão — apenas comente brevemente o que precisa de atenção (ou fique em silêncio se tudo certo)`;

const CHANNEL_RULES: Record<string, string> = {
  chat: `
## Regras do Canal (Chat Web)
- Pode usar **negrito** e formatação rica
- Parágrafos separados por linha em branco
- Links clicáveis quando relevante
- Emojis como acentuação visual
- Respostas podem ser mais detalhadas (até 500 palavras quando necessário)
- Se o usuário fez uma pergunta simples, responda em 1-2 frases — não enrole
`,
  whatsapp: `
## Regras do Canal (WhatsApp)
- Texto puro com *negrito* usando asteriscos (padrão WhatsApp)
- Mensagens mais curtas e diretas (máximo 300 palavras)
- Sem markdown, sem links longos, sem tabelas
- Emojis são bem-vindos — WhatsApp é mais informal
- Quebra de linha para respiração visual
- Se a resposta for longa, divida em blocos lógicos curtos
- NUNCA retornar JSON, código, ou estruturas técnicas
- NUNCA incluir suggest_replies ou qualquer metadado na mensagem
- NÃO prefixar a resposta com nome do workspace — responda diretamente
`,
  mcp: `
## Regras do Canal (MCP)
- Respostas concisas e estruturadas
- Foco em dados e ações executadas
- Confirmar ações realizadas com detalhes mínimos
`,
};

const RESPONSE_EXAMPLES = `
## Exemplos de Como Responder

Usuário: "Quanto gastei esse mês?"
Resposta: "Este mês você gastou **R$ 94.3K**, com receitas de **R$ 114.8K** — saldo positivo de R$ 20.5K 💰 As despesas subiram 14% comparado ao mês anterior, puxadas principalmente por fornecedores e infraestrutura. Quer que eu detalhe as categorias ou analise onde dá pra cortar?"

Usuário: "Agenda de amanhã"
Resposta: "Amanhã, quarta-feira, tem **3 compromissos**:

🟠 **9h** — Reunião com equipe WSS
🔵 **11h** — Call com cliente PremiAds
🟢 **14h** — Review do Rankey

A tarde fica livre a partir das 15h. Quer que eu bloqueie esse horário pra trabalho focado?"

Usuário: "Me ajuda a escrever um email pro cliente reclamando do atraso"
Resposta: "Rascunhei um email firme mas profissional:

**Assunto: Atualização sobre prazo — [Projeto]**

Prezado [Nome],

Gostaríamos de alinhar as expectativas sobre o cronograma do projeto. Identificamos que a entrega prevista para [data] precisará ser ajustada para [nova data], devido a [motivo breve].

Para minimizar o impacto, estamos priorizando [ação concreta]. Estaremos disponíveis para uma call esta semana se quiser discutir os próximos passos.

Atenciosamente,
Felipe Antunes

Quer que eu ajuste o tom ou envie direto?"

Usuário: "Amanhã é meu aniversário 🎁"
Resposta: "Parabéns antecipado! 🎂 Já anotei aqui.

Quer que eu organize algo? Posso **bloquear sua agenda** pra você curtir sem interrupções, ou **pesquisar experiências** legais na sua região — jantar especial, day trip, algo assim. O que combina mais com você?"
`;

export function buildMaestroPrompt(ctx: MaestroContext): string {
  const sections: PromptSection[] = [];

  // P1 — Identity + Channel Rules + Examples (never trim)
  const channelKey = ctx.channel === "whatsapp-mcp" ? "whatsapp" : (ctx.channel || "chat");
  const channelRules = CHANNEL_RULES[channelKey] || CHANNEL_RULES.chat;
  sections.push({
    priority: 1,
    label: "identity",
    content: `${PANDORA_IDENTITY}\n\n${channelRules}\n\n${RESPONSE_EXAMPLES}\n\n${ctx.temporalContext}\n\nUSUÁRIO: ${ctx.userName}`,
  });

  // P2 — Active agent (never trim)
  if (ctx.agent?.system_prompt) {
    sections.push({
      priority: 2,
      label: "agent",
      content: `## Agente Ativo: ${ctx.agent.icon} ${ctx.agent.name}\n${ctx.agent.system_prompt}`,
    });
  }

  // P3 — Workspace context
  if (ctx.workspace) {
    let wsContent = `## Workspace: ${ctx.workspace.icon} ${ctx.workspace.name}`;
    if (ctx.workspace.industry) wsContent += `\nSetor: ${ctx.workspace.industry}`;
    if (ctx.workspace.context_summary) wsContent += `\n${ctx.workspace.context_summary}`;
    if (ctx.workspace.system_prompt_override) wsContent += `\n\nInstruções do workspace:\n${ctx.workspace.system_prompt_override}`;
    sections.push({ priority: 3, label: "workspace", content: wsContent });
  }

  // P4 — Personal context
  if (ctx.personalContext) {
    sections.push({
      priority: 4,
      label: "personal",
      content: `## Sobre o Usuário\n${ctx.personalContext}`,
    });
  }

  // P5 — Workspace documents
  if (ctx.documents.length > 0) {
    const docsContent = ctx.documents
      .filter(d => d.is_active)
      .map(d => `### ${d.title} (${d.doc_type})\n${d.content}`)
      .join("\n\n");
    if (docsContent) {
      sections.push({ priority: 5, label: "documents", content: `## Base de Conhecimento\n${docsContent}` });
    }
  }

  // P6 — Skills (Rule 4 — lazy load)
  const relevantSkills = ctx.skills.filter(s => shouldInjectSkill(s, ctx.userMessage));
  if (relevantSkills.length > 0) {
    const skillsContent = relevantSkills
      .map(s => `### ${s.name}\nQuando usar: ${s.trigger_description}\n${s.instructions}`)
      .join("\n\n");
    sections.push({ priority: 6, label: "skills", content: `## Skills Disponíveis\n${skillsContent}` });
  }

  // P7 — Memories
  if (ctx.memories.length > 0) {
    const deduped = deduplicateMemories(ctx.memories);
    const ranked = deduped.sort((a, b) => scoreMemory(b) - scoreMemory(a));
    const memContent = ranked.slice(0, 20).map(m => `- [${m.category}${m.importance === "high" ? " ⭐" : ""}] ${m.content}`).join("\n");
    sections.push({ priority: 7, label: "memories", content: `## Memórias\n${memContent}` });
  }

  // P8 — Multi-Workspace Intelligence
  if (ctx.allWorkspaces && ctx.allWorkspaces.length > 0) {
    const defaultWs = ctx.defaultWorkspace || ctx.workspace;
    const defaultWsName = defaultWs ? `${defaultWs.icon} ${defaultWs.name}` : "Perfil Principal";
    const otherWs = ctx.allWorkspaces
      .filter(w => w.id !== defaultWs?.id)
      .map(w => `- ${w.icon} ${w.name}${w.context_summary ? `: ${w.context_summary.slice(0, 60)}` : ""}`)
      .join("\n");
    sections.push({
      priority: 8,
      label: "multi_workspace",
      content: `## Seus Workspaces
Você opera SEMPRE no contexto do workspace principal: **${defaultWsName}**.
${otherWs ? `\nOutros workspaces do usuário:\n${otherWs}` : ""}

REGRA CRÍTICA DE WORKSPACE:
- Todas as ações (criar, editar, enviar, consultar) são executadas no workspace principal por padrão
- Se o usuário mencionar outro workspace (@nome ou referência direta como "no Rankey", "da WSS"), CONFIRME antes de executar:
  "Isso envolve o workspace {icon} {nome}. Posso acessar e executar lá?"
- Só execute em outro workspace APÓS confirmação explícita do usuário
- Leituras cross-workspace (consultas de dados de outro perfil) também pedem confirmação rápida
- Se o usuário já confirmou anteriormente na mesma conversa, não pergunte novamente para o mesmo workspace`,
    });
  }

  // P9 — Dashboard context (compact)
  if (ctx.dashboardContext && Object.keys(ctx.dashboardContext).length > 0) {
    const dashCtx = buildCompactDashboardContext(ctx.dashboardContext);
    if (dashCtx) {
      sections.push({ priority: 9, label: "dashboard", content: dashCtx });
    }
  }

  // Session context (inline, low priority)
  if (ctx.sessionContext?.sessionId && ctx.sessionContext.sessionId !== "fallback") {
    let sessContent = `## Sessão\nCanal: ${ctx.sessionContext.activeChannel || "chat"}`;
    const snap = ctx.sessionContext.contextSnapshot;
    if (snap?.last_tools_used?.length) sessContent += `\nÚltimas tools: ${snap.last_tools_used.join(", ")}`;
    if (ctx.sessionContext.recentToolCalls?.length) {
      sessContent += `\nAções recentes: ${ctx.sessionContext.recentToolCalls.slice(0, 5).map(tc => `${tc.tool_name}[${tc.status}]`).join(", ")}`;
    }
    sections.push({ priority: 9, label: "session", content: sessContent });
  }

  // Recent actions (anti-repetition)
  if (ctx.recentActions) {
    sections.push({ priority: 9, label: "recent_actions", content: ctx.recentActions });
  }

  // Rule 6 — Trim to fit budget
  return trimContextToFit(sections, 8000);
}

// ═══════════════════════════════════════════════════════
// Token budget trimmer (Rule 6)
// ═══════════════════════════════════════════════════════

function trimContextToFit(sections: PromptSection[], maxTokens: number): string {
  sections.sort((a, b) => a.priority - b.priority);

  let totalTokens = 0;
  const included: string[] = [];

  for (const section of sections) {
    const tokens = estimateTokens(section.content);
    if (totalTokens + tokens <= maxTokens) {
      included.push(section.content);
      totalTokens += tokens;
    } else if (section.priority <= 2) {
      // P1-P2: always include (identity + agent are mandatory)
      included.push(section.content);
      totalTokens += tokens;
    } else {
      // Try to truncate
      const remaining = maxTokens - totalTokens;
      if (remaining > 100) {
        included.push(section.content.slice(0, Math.floor(remaining * 3.5)) + "\n[...contexto truncado]");
        totalTokens = maxTokens;
      }
      break;
    }
  }

  return included.join("\n\n");
}

// ═══════════════════════════════════════════════════════
// Skill relevance filter (Rule 4)
// ═══════════════════════════════════════════════════════

export function shouldInjectSkill(skill: { trigger_description: string | null }, userMessage: string): boolean {
  if (!skill.trigger_description) return false;
  const triggerWords = skill.trigger_description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const msg = userMessage.toLowerCase();
  const matches = triggerWords.filter(w => msg.includes(w));
  return matches.length >= 2;
}

// ═══════════════════════════════════════════════════════
// @workspace mention parser (Rule 5)
// ═══════════════════════════════════════════════════════

export function parseWorkspaceMention(
  message: string,
  workspaces: Array<{ id: string; name: string }>,
): { cleanMessage: string; targetWorkspaceId: string | null } {
  const mentionRegex = /@(\S+)/;
  const match = message.match(mentionRegex);

  if (match) {
    const mentioned = match[1].toLowerCase();
    const ws = workspaces.find(w => {
      const nameNormalized = w.name.toLowerCase().replace(/\s+/g, "");
      return (
        nameNormalized === mentioned ||
        nameNormalized.startsWith(mentioned) ||
        w.name.toLowerCase().split(" ").some(word => word === mentioned)
      );
    });

    if (ws) {
      return {
        cleanMessage: message.replace(match[0], "").trim(),
        targetWorkspaceId: ws.id,
      };
    }
  }

  return { cleanMessage: message, targetWorkspaceId: null };
}

export function detectsAction(message: string): boolean {
  const actionVerbs = [
    "criar", "create", "enviar", "send", "agendar", "schedule",
    "deletar", "delete", "atualizar", "update", "completar", "complete",
    "arquivar", "archive", "mover", "move", "compartilhar", "share",
    "gerar", "generate", "publicar", "publish", "excluir", "remover",
    "editar", "salvar", "save", "marcar", "desmarcar",
  ];
  const msgLower = message.toLowerCase();
  return actionVerbs.some(v => msgLower.includes(v));
}

// ═══════════════════════════════════════════════════════
// Compact dashboard context builder
// ═══════════════════════════════════════════════════════

function buildCompactDashboardContext(ctx: Record<string, any>): string {
  const lines: string[] = ["## Contexto do Dashboard"];
  let hasContent = false;

  if (ctx.workspace_name) {
    lines.push(`Workspace: ${ctx.workspace_name}`);
    hasContent = true;
  }

  if (ctx.tasks?.length) {
    const pending = ctx.tasks.filter((t: any) => !t.done);
    lines.push(`📋 Tarefas: ${pending.length} pendentes de ${ctx.tasks.length}`);
    if (pending.length > 0) {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...pending]
        .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
        .slice(0, 8);
      // Compact one-liner per task: title + priority + due (no JSON noise)
      for (const t of sorted) {
        const pr = t.priority && t.priority !== "medium" ? ` [${t.priority}]` : "";
        const due = t.due_date ? ` ⏰${String(t.due_date).slice(0, 10)}` : "";
        const title = String(t.title || t.name || "").slice(0, 80);
        lines.push(`  • ${title}${pr}${due}`);
      }
    }
    hasContent = true;
  }

  if (ctx.events?.length) {
    lines.push(`📅 Eventos próximos: ${ctx.events.length}`);
    // Show next 5 events compactly
    const next = ctx.events.slice(0, 5);
    for (const e of next) {
      const when = e.start_at || e.start || e.date || "";
      const label = String(e.title || e.label || "").slice(0, 80);
      if (label) lines.push(`  • ${label}${when ? ` — ${String(when).slice(0, 16)}` : ""}`);
    }
    hasContent = true;
  }

  if (ctx.finance_summary) {
    const fs = ctx.finance_summary;
    const summary = [
      fs.balance != null ? `saldo R$${fs.balance}` : null,
      fs.income != null ? `entradas R$${fs.income}` : null,
      fs.expenses != null ? `saídas R$${fs.expenses}` : null,
    ].filter(Boolean).join(" · ");
    if (summary) lines.push(`💰 Finanças: ${summary}`);
    hasContent = true;
  }

  if (ctx.recent_emails?.length) {
    const unread = ctx.recent_emails.filter((e: any) => e.is_unread).length;
    lines.push(`📧 E-mails: ${unread} não lidos de ${ctx.recent_emails.length}`);
    hasContent = true;
  }

  if (ctx.contacts?.length) {
    lines.push(`👥 Contatos: ${ctx.contacts.length} (use smart_find_contact)`);
    hasContent = true;
  }

  if (ctx.habits?.length) {
    const pending = ctx.habits.filter((h: any) => !h.completedToday).length;
    lines.push(`🏋️ Hábitos: ${pending}/${ctx.habits.length} pendentes`);
    hasContent = true;
  }

  if (ctx.whatsapp_status) {
    lines.push(`📱 WhatsApp: ${ctx.whatsapp_status}`);
    hasContent = true;
  }

  return hasContent ? lines.join("\n") : "";
}

// More accurate token estimator for PT-BR mixed text (avg ~3.3 chars/token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

// ═══════════════════════════════════════════════════════
// Legacy buildSystemPrompt (backward compat for WhatsApp/widget)
// ═══════════════════════════════════════════════════════

export function buildSystemPrompt(options: PandoraPromptOptions): string {
  const { platform, userName, temporalContext, contextData, recentActions, memories, knowledgeBase, customSystemPrompt, isVoiceInput, sessionContext, personalContext } = options;

  const isWhatsApp = platform === "whatsapp" || platform === "whatsapp-mcp";
  const isMCP = platform === "mcp" || platform === "whatsapp-mcp";
  const isChat = platform === "chat" || platform === "widget" || isMCP;

  // If a custom agent system prompt is provided, use it as base
  if (customSystemPrompt) {
    return `${customSystemPrompt}\n\nVocê também é integrada ao dashboard DESH e tem acesso às seguintes ferramentas. Responda SEMPRE em português brasileiro. ${temporalContext}`;
  }

  // Build using Maestro for chat/MCP with full context
  if (isChat && !isWhatsApp) {
    return buildMaestroPrompt({
      workspace: contextData.workspace_name ? {
        id: contextData.workspace_id || "default",
        name: contextData.workspace_name || "Pessoal",
        icon: "🏠",
        industry: contextData.industry,
        context_summary: contextData.context_summary,
        system_prompt_override: contextData.system_prompt_override,
      } : null,
      agent: null,
      documents: [],
      memories: memories || [],
      skills: [],
      allWorkspaces: null,
      isAllMode: false,
      personalContext: personalContext || null,
      userMessage: "",
      userName,
      temporalContext,
      recentActions,
      sessionContext,
      dashboardContext: contextData,
      channel: platform as any,
    });
  }

  // WhatsApp: use minimal prompt
  let prompt = `Você é a Pandora, a assistente pessoal do dashboard DESH. Você está respondendo via WhatsApp. ${temporalContext}

IDENTIDADE:
- Extremamente competente, proativa e inteligente
- Responde em português brasileiro

HONESTIDADE (CRÍTICO):
- Se resultado contiver [ERRO], informe HONESTAMENTE
- NUNCA confirme ação como realizada se o resultado indicar falha

USUÁRIO: ${userName}

`;

  if (personalContext) {
    prompt += `\n## Contexto Pessoal\n${personalContext}\n\n`;
  }

  prompt += `CAPACIDADES COMPLETAS (via tools):
• Tarefas: criar, editar, completar, excluir, listar
• Notas: criar, editar, excluir
• Calendário: criar, editar, excluir eventos
• Contatos: CRUD completo
• Finanças: transações, metas, orçamentos
• E-mails (Gmail via Composio)
• WhatsApp: enviar mensagens
• Busca Web

DIFERENCIAÇÃO DE CANAIS (CRÍTICO):
• "email" → send_email | "mensagem"/"WhatsApp" → send_whatsapp
• NUNCA confunda os canais

REGRAS:
1. Responda SEMPRE em português brasileiro
2. Formato WhatsApp — *negrito* _itálico_ ~tachado~
3. Use emojis como separadores visuais
4. SEMPRE use ferramentas quando o usuário pedir ação
5. NUNCA execute a mesma tool com mesmos argumentos
`;

  if (isVoiceInput) {
    prompt += `\nMODO VOZ: Máximo 2-3 frases. ZERO formatação. Tom natural e fluido.\n`;
  }

  if (isMCP) {
    prompt += `\nMODO MCP: Acesso DIRETO aos apps conectados via Composio MCP. Aja com autonomia para leitura, confirme para escrita.\n`;
  }

  prompt += buildMinimalContext(contextData, memories);

  if (sessionContext?.sessionId && sessionContext.sessionId !== "fallback") {
    prompt += `\nCanal: ${sessionContext.activeChannel || platform}\n`;
  }

  if (recentActions) prompt += recentActions;

  return prompt;
}

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function deduplicateMemories(memories: any[]): any[] {
  if (!memories?.length) return [];
  const seen = new Map<string, any>();
  for (const m of memories) {
    const norm = (m.content || "").toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    const words = new Set(norm.split(" "));
    let isDupe = false;
    for (const [existingNorm, existing] of seen) {
      const existingWords = new Set(existingNorm.split(" "));
      const intersection = [...words].filter(w => existingWords.has(w)).length;
      const union = new Set([...words, ...existingWords]).size;
      if (union > 0 && intersection / union > 0.7) {
        if ((m.importance === "high" && existing.importance !== "high") || m.content.length > existing.content.length) {
          seen.delete(existingNorm);
          seen.set(norm, m);
        }
        isDupe = true;
        break;
      }
    }
    if (!isDupe) seen.set(norm, m);
  }
  return [...seen.values()];
}

function scoreMemory(m: any): number {
  let score = 0;
  if (m.importance === "high") score += 10;
  else if (m.importance === "normal") score += 5;
  if (m.category === "preference") score += 3;
  if (m.category === "personal") score += 2;
  return score;
}

function buildMinimalContext(ctx: Record<string, any>, memories?: any[]): string {
  let section = "\n--- CONTEXTO ---\n";
  if (ctx.tasksPending !== undefined) section += `📋 Tarefas pendentes: ${ctx.tasksPending}\n`;
  if (ctx.habitsPendingToday !== undefined) section += `🏋️ Hábitos pendentes: ${ctx.habitsPendingToday}\n`;
  if (memories?.length) {
    const deduped = deduplicateMemories(memories);
    section += `🧠 Memórias: ${deduped.slice(0, 10).map((m: any) => `[${m.category}] ${m.content}`).join("; ")}\n`;
  }
  return section;
}

/** Helper to get temporal context string */
export function getTemporalContext(clientTimezone?: string): string {
  const now = new Date();
  const tz = clientTimezone || "America/Sao_Paulo";
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find(p => p.type === "hour")?.value || 12);

  let period = "madrugada";
  if (hour >= 6 && hour < 12) period = "manhã";
  else if (hour >= 12 && hour < 18) period = "tarde";
  else if (hour >= 18 && hour < 24) period = "noite";

  const dayName = parts.find(p => p.type === "weekday")?.value;
  const dayNum = parts.find(p => p.type === "day")?.value;
  const monthName = parts.find(p => p.type === "month")?.value;
  const yearVal = parts.find(p => p.type === "year")?.value;

  return `Hoje é ${dayName}, ${dayNum} de ${monthName} de ${yearVal}. Período: ${period}. Fuso: ${tz}.`;
}
