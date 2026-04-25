import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTodo, CalendarDays, Mail, MessageCircle, Check, ChevronRight,
  Square, CheckSquare, Timer, Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import InboxQuickReplies from "./InboxQuickReplies";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { QuickReply } from "@/hooks/common/useInboxAI";

export interface InboxItem {
  id: string;
  type: "task" | "event" | "email" | "whatsapp";
  title: string;
  subtitle?: string;
  priority: number;
  timestamp: string;
  overdue?: boolean;
  navigateTo?: string;
  onAction?: () => void;
  actionLabel?: string;
}

interface SnoozeOption {
  label: string;
  minutes: number;
}

const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "15 min", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "3h", minutes: 180 },
  { label: "Amanhã", minutes: 1440 },
];

const formatTime = (d: string) => {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); }
  catch { return d; }
};

const typeIcon = (type: InboxItem["type"]) => {
  switch (type) {
    case "task":     return <ListTodo className="w-4 h-4 text-primary" />;
    case "event":    return <CalendarDays className="w-4 h-4 text-emerald-500" />;
    case "email":    return <Mail className="w-4 h-4 text-sky-500" />;
    case "whatsapp": return <MessageCircle className="w-4 h-4 text-green-500" />;
  }
};

export const priorityBadge = (p: number, overdue?: boolean) => {
  if (overdue) return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/20 text-destructive flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Atrasado</span>;
  if (p === 0) return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-destructive/20 text-destructive">Crítico</span>;
  if (p === 1) return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-500">Alta</span>;
  if (p === 2) return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary">Média</span>;
  return null;
};

const typeLabel = (type: InboxItem["type"]) => {
  switch (type) {
    case "task": return "Tarefa";
    case "event": return "Evento";
    case "email": return "E-mail";
    case "whatsapp": return "WhatsApp";
  }
};

interface InboxItemCardProps {
  item: InboxItem;
  index: number;
  isFocused: boolean;
  isSelected: boolean;
  triageLabel?: { label: string; color: string } | null;
  showSnoozeMenu: boolean;
  showQuickReplies: boolean;
  quickReplies: QuickReply[];
  quickReplyLoading: boolean;
  onItemClick: (item: InboxItem) => void;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSnoozeToggle: (id: string) => void;
  onSnooze: (id: string, title: string, minutes: number) => void;
  onQuickReplySelect: (text: string) => void;
  onQuickReplyGenerate: (item: InboxItem) => void;
}

const triageColorMap: Record<string, string> = {
  red: "bg-red-500/10 text-red-500",
  blue: "bg-sky-500/10 text-sky-500",
  green: "bg-emerald-500/10 text-emerald-500",
  yellow: "bg-amber-500/10 text-amber-500",
  purple: "bg-purple-500/10 text-purple-500",
};

const InboxItemCard = memo(({
  item, index, isFocused, isSelected, triageLabel,
  showSnoozeMenu, showQuickReplies, quickReplies, quickReplyLoading,
  onItemClick, onToggleSelect, onSnoozeToggle, onSnooze,
  onQuickReplySelect, onQuickReplyGenerate,
}: InboxItemCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ delay: index * 0.03 }}
      className={`glass-card p-3 sm:p-4 rounded-xl flex items-start gap-3 group cursor-pointer transition-colors ${
        item.overdue ? "border border-destructive/20" : ""
      } ${isFocused ? "ring-2 ring-primary/40" : ""} ${
        isSelected ? "bg-primary/5 border-primary/30" : "hover:bg-foreground/5"
      }`}
      onClick={() => onItemClick(item)}
    >
      {/* Checkbox: always visible on mobile, hover on desktop */}
      <button
        onClick={(e) => onToggleSelect(item.id, e)}
        className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {isSelected
          ? <CheckSquare className="w-4 h-4 text-primary" />
          : <Square className="w-4 h-4 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
        }
      </button>
      <div className="mt-0.5 flex-shrink-0">{typeIcon(item.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium truncate ${item.overdue ? "text-destructive" : "text-foreground"}`}>
            {item.title}
          </span>
          {priorityBadge(item.priority, item.overdue)}
          {triageLabel && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${triageColorMap[triageLabel.color] || triageColorMap.blue}`}>
              {triageLabel.label}
            </span>
          )}
        </div>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-foreground/5 text-muted-foreground/70 font-medium">{typeLabel(item.type)}</span>
          <p className="text-[10px] text-muted-foreground/50">{formatTime(item.timestamp)}</p>
        </div>

        {showQuickReplies && (
          <InboxQuickReplies
            replies={quickReplies}
            loading={quickReplyLoading}
            onSelect={onQuickReplySelect}
            onGenerate={() => onQuickReplyGenerate(item)}
          />
        )}
        {!showQuickReplies && (item.type === "email" || item.type === "whatsapp") && quickReplies.length === 0 && !quickReplyLoading && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickReplyGenerate(item); }}
            className="mt-1.5 text-[10px] text-primary/70 hover:text-primary font-medium transition-colors"
          >
            💬 Gerar respostas rápidas
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Popover open={showSnoozeMenu} onOpenChange={(open) => { if (!open) onSnoozeToggle(item.id); }}>
          <PopoverTrigger asChild>
            <button
              onClick={e => { e.stopPropagation(); onSnoozeToggle(item.id); }}
              className="p-1.5 rounded-lg hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors sm:opacity-0 sm:group-hover:opacity-100"
              title="Adiar"
            >
              <Timer className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={4}
            className="w-auto min-w-[110px] p-1.5 rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {SNOOZE_OPTIONS.map(opt => (
              <button
                key={opt.minutes}
                onClick={() => onSnooze(item.id, item.title, opt.minutes)}
                className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {item.onAction && (
          <button
            onClick={e => { e.stopPropagation(); item.onAction!(); }}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors sm:opacity-0 sm:group-hover:opacity-100"
            title={item.actionLabel || "Ação"}
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );
});

InboxItemCard.displayName = "InboxItemCard";

export default InboxItemCard;
