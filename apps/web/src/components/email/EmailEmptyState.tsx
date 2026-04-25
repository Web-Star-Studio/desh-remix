import { memo } from "react";
import { Mail, Inbox, Send, FileText, Trash2, FolderArchive, MailX, SearchX } from "lucide-react";
import { motion } from "framer-motion";
import type { EmailFolder } from "./types";

interface EmailEmptyStateProps {
  folder: EmailFolder;
  hasActiveFilter: boolean;
  onClearFilters?: () => void;
  searchQuery?: string;
}

const FOLDER_EMPTY: Record<string, { icon: typeof Mail; title: string; description: string }> = {
  inbox: { icon: Inbox, title: "Caixa de entrada vazia", description: "Parabéns! Nenhum e-mail para processar." },
  sent: { icon: Send, title: "Nenhum enviado", description: "Seus e-mails enviados aparecerão aqui." },
  drafts: { icon: FileText, title: "Nenhum rascunho", description: "Rascunhos salvos aparecerão aqui." },
  trash: { icon: Trash2, title: "Lixeira vazia", description: "Nenhum e-mail na lixeira." },
  archive: { icon: FolderArchive, title: "Arquivo vazio", description: "E-mails arquivados aparecerão aqui." },
  spam: { icon: MailX, title: "Sem spam", description: "Nenhum spam detectado." },
};

const EmailEmptyState = memo(({ folder, hasActiveFilter, onClearFilters, searchQuery }: EmailEmptyStateProps) => {
  if (searchQuery) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 px-4">
        <SearchX className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground/70 mb-1">Nenhum resultado para "{searchQuery}"</p>
        <p className="text-xs text-muted-foreground mb-3">Tente termos diferentes ou use a busca inteligente com IA.</p>
        {onClearFilters && (
          <button onClick={onClearFilters} className="text-xs text-primary hover:text-primary/80 transition-colors">
            Limpar busca e filtros
          </button>
        )}
      </motion.div>
    );
  }

  if (hasActiveFilter) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 px-4">
        <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground/70 mb-1">Nenhum e-mail com os filtros ativos</p>
        <p className="text-xs text-muted-foreground mb-3">Ajuste ou limpe os filtros para ver mais resultados.</p>
        <button onClick={onClearFilters} className="text-xs text-primary hover:text-primary/80 transition-colors">
          Limpar filtros ativos
        </button>
      </motion.div>
    );
  }

  const config = FOLDER_EMPTY[folder] || FOLDER_EMPTY.inbox;
  const Icon = config.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 px-4">
      <div className="relative mx-auto w-16 h-16 mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/5" />
        <Icon className="w-8 h-8 text-muted-foreground/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <p className="text-sm font-medium text-foreground/70 mb-1">{config.title}</p>
      <p className="text-xs text-muted-foreground">{config.description}</p>
    </motion.div>
  );
});

EmailEmptyState.displayName = "EmailEmptyState";
export default EmailEmptyState;
