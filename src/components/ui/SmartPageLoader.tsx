import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

const PAGE_TIPS: Record<string, string[]> = {
  dashboard: [
    "Arraste widgets para reorganizar seu painel",
    "Clique duas vezes em um widget para expandir",
    "Use ⌘K para abrir a paleta de comandos",
  ],
  calendar: [
    "Arraste eventos entre dias para reagendá-los",
    "Use a tecla T para voltar ao dia de hoje",
    "Clique em + para criar eventos rapidamente",
  ],
  email: [
    "Deslize para a direita para arquivar e-mails",
    "Use filtros inteligentes para priorizar mensagens",
    "O resumo diário da IA destaca o que importa",
  ],
  tasks: [
    "Arraste tarefas entre colunas para mudar o status",
    "Use ⌘+Enter para criar tarefas rapidamente",
    "O modo foco esconde distrações e mostra só a tarefa atual",
  ],
  finances: [
    "Conecte contas bancárias para importar transações",
    "Categorize gastos automaticamente com a IA",
    "Defina orçamentos mensais por categoria",
  ],
  contacts: [
    "Importe contatos do Google com um clique",
    "Adicione tags para organizar seus contatos",
    "Busque por nome, e-mail ou empresa",
  ],
  notes: [
    "Use /comando para inserir blocos especiais",
    "Grave notas de voz diretamente no editor",
    "Desenhe diagramas com a ferramenta de desenho",
  ],
  files: [
    "Arraste arquivos para fazer upload rápido",
    "Compartilhe arquivos com links públicos",
    "Organize em pastas para encontrar mais fácil",
  ],
  messages: [
    "Conecte o WhatsApp para mensagens unificadas",
    "Use respostas rápidas para agilizar conversas",
    "A IA pode sugerir respostas automáticas",
  ],
  automations: [
    "Crie regras para automatizar tarefas repetitivas",
    "Combine triggers e ações para fluxos complexos",
    "Use 'Executar agora' para testar suas automações",
  ],
  search: [
    "Use filtros especializados para resultados precisos",
    "A pesquisa profunda analisa múltiplas fontes",
    "Salve buscas frequentes para acesso rápido",
  ],
  settings: [
    "Personalize temas e papéis de parede",
    "Configure atalhos de teclado personalizados",
    "Gerencie notificações por categoria",
  ],
  ai: [
    "Crie agentes especializados para cada tarefa",
    "Use projetos para organizar conversas por tema",
    "A IA aprende suas preferências com o tempo",
  ],
  inbox: [
    "O inbox unifica todas as suas notificações",
    "Marque como lido com um clique",
    "Filtre por tipo para encontrar rapidamente",
  ],
  social: [
    "Gerencie todas as redes em um só lugar",
    "Agende posts para publicação automática",
    "Acompanhe métricas de engajamento",
  ],
};

function pickTip(page: string): string {
  const tips = PAGE_TIPS[page];
  if (!tips?.length) return "Carregando seus dados...";

  const key = `desh_tip_idx_${page}`;
  try {
    const prev = parseInt(sessionStorage.getItem(key) || "-1", 10);
    let next = Math.floor(Math.random() * tips.length);
    if (tips.length > 1 && next === prev) next = (next + 1) % tips.length;
    sessionStorage.setItem(key, String(next));
    return tips[next];
  } catch {
    return tips[0];
  }
}

interface SmartPageLoaderProps {
  page: string;
  children?: React.ReactNode;
}

const GenericSkeleton = () => (
  <div className="space-y-4 p-4">
    {[0, 1, 2].map(i => (
      <div key={i} className="rounded-xl border border-foreground/5 p-4 space-y-3 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
        <div className="h-3 w-24 rounded bg-foreground/8" />
        <div className="h-4 w-48 rounded bg-foreground/6" />
        <div className="h-2 w-full rounded bg-foreground/4" />
      </div>
    ))}
  </div>
);

const SmartPageLoader = React.memo(({ page, children }: SmartPageLoaderProps) => {
  const tip = useMemo(() => pickTip(page), [page]);

  return (
    <div className="relative min-h-[60vh] flex flex-col">
      <div className="flex-1">
        {children || <GenericSkeleton />}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
        className="sticky bottom-4 mx-4 mb-4"
      >
        <div className="flex items-center gap-2.5 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 backdrop-blur-sm max-w-lg mx-auto">
          <Lightbulb className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground leading-snug">{tip}</p>
        </div>
      </motion.div>
    </div>
  );
});

SmartPageLoader.displayName = "SmartPageLoader";
export default SmartPageLoader;
