/**
 * MessagesEmptyState — Contextual empty states for Messages module.
 * Shows different content based on connection status and current view.
 */
import { MessageSquare, Wifi, WifiOff, Search, Archive, Inbox, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface MessagesEmptyStateProps {
  variant: "no-selection" | "no-conversations" | "no-results" | "no-archived" | "disconnected";
  onConnect?: () => void;
  searchQuery?: string;
}

export function MessagesEmptyState({ variant, onConnect, searchQuery }: MessagesEmptyStateProps) {
  const config = {
    "no-selection": {
      icon: <MessageSquare className="w-8 h-8 text-muted-foreground/40" />,
      title: "Selecione uma conversa",
      description: "Escolha uma conversa na lista ao lado para começar a trocar mensagens.",
      tips: [
        "⌨️ Use ↑↓ para navegar entre conversas",
        "🔍 Ctrl+F para buscar mensagens no chat",
        "📌 Clique direito para fixar ou arquivar",
      ],
    },
    "no-conversations": {
      icon: <Inbox className="w-8 h-8 text-muted-foreground/40" />,
      title: "Nenhuma conversa ainda",
      description: "Conecte o WhatsApp ou inicie uma nova conversa para começar.",
      tips: [
        "💬 Clique em + para iniciar uma nova conversa",
        "🔄 Sincronize o histórico para importar conversas antigas",
        "📱 Conecte redes sociais para unificar DMs",
      ],
    },
    "no-results": {
      icon: <Search className="w-8 h-8 text-muted-foreground/40" />,
      title: "Nenhum resultado",
      description: searchQuery ? `Nenhuma conversa encontrada para "${searchQuery}"` : "Tente buscar com outros termos.",
      tips: [
        "💡 Busque pelo nome do contato ou conteúdo da mensagem",
        "🔄 Verifique os filtros de plataforma ativos",
      ],
    },
    "no-archived": {
      icon: <Archive className="w-8 h-8 text-muted-foreground/40" />,
      title: "Nenhuma conversa arquivada",
      description: "Conversas que você arquivar aparecerão aqui.",
      tips: [],
    },
    "disconnected": {
      icon: <WifiOff className="w-8 h-8 text-muted-foreground/40" />,
      title: "WhatsApp desconectado",
      description: "Reconecte seu WhatsApp para enviar e receber mensagens.",
      tips: [
        "📱 Escaneie o QR code nas configurações",
        "🔄 A reconexão automática é tentada a cada 55s",
      ],
    },
  };

  const c = config[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center h-full px-6 py-12"
    >
      <div className="w-16 h-16 rounded-2xl bg-foreground/5 flex items-center justify-center mb-4">
        {c.icon}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{c.title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">{c.description}</p>

      {c.tips.length > 0 && (
        <div className="space-y-1.5 max-w-xs">
          {c.tips.map((tip, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className="text-xs text-muted-foreground/70 flex items-start gap-1.5"
            >
              {tip}
            </motion.p>
          ))}
        </div>
      )}

      {variant === "disconnected" && onConnect && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={onConnect}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Wifi className="w-4 h-4" />
          Reconectar WhatsApp
        </motion.button>
      )}
    </motion.div>
  );
}
