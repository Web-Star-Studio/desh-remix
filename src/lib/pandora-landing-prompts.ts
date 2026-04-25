export interface PandoraReaction {
  delay: number;
  message: string;
  quickReplies: string[];
}

export const PANDORA_SCROLL_REACTIONS: Record<string, PandoraReaction> = {
  hero: {
    delay: 2500,
    message: "Oi! 👋 Eu sou a Pandora, assistente IA do DESH. Posso te mostrar como funciona enquanto você navega. Quer que eu te guie?",
    quickReplies: ["Sim, me guie", "Vou explorar sozinho"],
  },
  problem: {
    delay: 1500,
    message: "Reconhece essa situação? 😅 A maioria das pessoas usa em média 8 apps por dia. O problema não é falta de ferramenta — é excesso.",
    quickReplies: [],
  },
  solution: {
    delay: 2000,
    message: "Esse é o painel completo do DESH. Tudo que você precisa, em um só lugar. ✨",
    quickReplies: ["Me conta mais", "Quero testar"],
  },
  modules: {
    delay: 1000,
    message: "Qual módulo te interessou mais? Posso te dar mais detalhes sobre qualquer um. 🎯",
    quickReplies: ["Finanças", "Produtividade", "Comunicação"],
  },
  pandora: {
    delay: 1500,
    message: "Essa sou eu! 💜 Mas aqui na landing page eu tô em modo demonstração. Dentro do DESH, eu tenho acesso a todos os seus dados.",
    quickReplies: ["O que você pode fazer?", "Quero experimentar"],
  },
  pricing: {
    delay: 2000,
    message: "Você ganha 100 créditos de teste ao criar sua conta, sem cartão de crédito. Eles valem por 30 dias — tempo de sobra pra ver a mágica acontecer. 💎",
    quickReplies: ["Começar grátis", "Tenho dúvidas"],
  },
  faq: {
    delay: 1500,
    message: "Tem alguma dúvida que não está aqui? Pode me perguntar! Eu sei tudo sobre o DESH. 🧠",
    quickReplies: [],
  },
  final: {
    delay: 1000,
    message: "Se você chegou até aqui, já sabe que precisa disso. Eu te espero do outro lado. Vamos organizar sua vida juntos! 🚀",
    quickReplies: ["Criar conta", "Ainda tenho dúvidas"],
  },
};

export const PANDORA_DEMO_RESPONSES: Record<string, string> = {
  "resumo do dia": "Bom dia! 🌅 Você tem 3 reuniões hoje, 5 tarefas pendentes (2 urgentes), 12 emails não lidos e seu streak de hábitos está em 7 dias. Quer que eu priorize suas tarefas?",
  "emails urgentes": "📧 Você tem 3 emails urgentes:\n1. **Financeiro** — Fatura do cartão vence amanhã (R$1.247,80)\n2. **Trabalho** — Reunião remarcada para 15h\n3. **Banco** — TED recebida de R$3.500,00\n\nQuer que eu responda algum?",
  "finanças": "💰 Resumo financeiro do mês:\n- Receitas: R$8.500,00\n- Despesas: R$5.230,45\n- Saldo: R$3.269,55\n- Maior gasto: Alimentação (R$1.890)\n\nSeu score financeiro está em 78/100. Quer ver projeções?",
  "organizar arquivos": "📁 Analisei seu Drive e encontrei:\n- 23 arquivos duplicados (180MB)\n- 12 screenshots sem nome\n- 5 documentos antigos para arquivar\n\nQuer que eu organize automaticamente?",
  "planejar semana": "📅 Aqui vai seu plano semanal:\n- **Seg:** 2 reuniões, finalizar relatório\n- **Ter:** Dia leve — ideal para tarefas criativas\n- **Qua:** Revisão financeira mensal\n- **Qui:** 3 follow-ups de contatos pendentes\n- **Sex:** Sprint final do projeto Alpha",
};

export function findDemoResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, response] of Object.entries(PANDORA_DEMO_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  return "Boa pergunta! 🤔 Dentro do DESH eu teria acesso a todos os seus dados para responder isso com precisão. Ao criar sua conta você recebe 100 créditos de teste, válidos por 30 dias. Quer começar?";
}
