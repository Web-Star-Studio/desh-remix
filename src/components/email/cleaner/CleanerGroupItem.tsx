import { useState, useEffect } from "react";
import { Loader2, Trash2, Archive, CheckSquare, Square, ChevronDown, ChevronRight, X, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CleanerGroup } from "../InboxCleanerPanel";

interface EmailPreview {
  id: string;
  subject: string;
  from: string;
  date: string;
}

interface CleanerGroupItemProps {
  group: CleanerGroup;
  selected: boolean;
  onToggle: () => void;
  onClean: () => void;
  deleting: boolean;
  /** Callback to remove specific email IDs from this group before cleaning */
  onRemoveEmailIds?: (emailIds: string[]) => void;
  /** Callback to change the action for this group */
  onActionChange?: (action: "trash" | "archive") => void;
}

const CleanerGroupItem = ({ group, selected, onToggle, onClean, deleting, onRemoveEmailIds, onActionChange }: CleanerGroupItemProps) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [emails, setEmails] = useState<EmailPreview[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const isTrash = group.action === "trash";

  useEffect(() => {
    if (!expanded || emails.length > 0 || !user) return;
    (async () => {
      setLoadingEmails(true);
      try {
        const { data } = await supabase
          .from("gmail_messages_cache" as any)
          .select("gmail_id, subject, from_name, date")
          .eq("user_id", user.id)
          .in("gmail_id", group.emailIds)
          .order("date", { ascending: false });
        if (data) {
          setEmails(data.map((d: any) => ({
            id: d.gmail_id,
            subject: d.subject || "(sem assunto)",
            from: d.from_name || group.sender,
            date: d.date,
          })));
        }
      } catch { /* ignore */ }
      setLoadingEmails(false);
    })();
  }, [expanded, user, group.emailIds, group.sender, emails.length]);

  const toggleExclude = (emailId: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId); else next.add(emailId);
      // Notify parent about excluded IDs
      const newExcluded = Array.from(next);
      onRemoveEmailIds?.(newExcluded);
      return next;
    });
  };

  const visibleEmails = showAll ? emails : emails.slice(0, 5);
  const activeCount = group.count - excludedIds.size;

  return (
    <div className={`rounded-lg border transition-colors ${
      selected ? "bg-primary/5 border-primary/20" : "bg-foreground/5 border-foreground/10"
    } ${deleting ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Main row */}
      <div className="flex items-start gap-3 p-3">
        <button onClick={onToggle} className="mt-1 shrink-0" disabled={deleting}>
          {selected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
        </button>
        <span className="text-lg mt-0.5 shrink-0">{group.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">{group.sender}</span>
            <span className="text-xs bg-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded-full">
              {excludedIds.size > 0 ? `${activeCount}/${group.count}` : group.count} e-mails
            </span>
            {group.isNewsletter && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Newsletter</Badge>
            )}
            {group.estimatedSpace && (
              <span className="text-[10px] text-muted-foreground">~{group.estimatedSpace}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-1.5">{group.reason}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={isTrash ? "destructive" : "secondary"}
              className={`text-[10px] px-1.5 py-0 h-4 ${!isTrash ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : ""}`}
            >
              {isTrash ? "Excluir" : "Arquivar"}
            </Badge>
            <button
              onClick={() => onActionChange?.(isTrash ? "archive" : "trash")}
              disabled={deleting}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title={isTrash ? "Trocar para Arquivar" : "Trocar para Excluir"}
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span className="hidden sm:inline">{isTrash ? "Arquivar" : "Excluir"}</span>
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Ver e-mails
            </button>
          </div>
        </div>
        <button
          onClick={onClean}
          disabled={deleting || activeCount === 0}
          className={`shrink-0 flex items-center gap-1 sm:gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 min-w-[36px] sm:min-w-0 ${
            isTrash
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
          }`}
          title={group.suggestion}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 sm:w-3 sm:h-3 animate-spin" /> : isTrash ? <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" /> : <Archive className="w-3.5 h-3.5 sm:w-3 sm:h-3" />}
          <span className="hidden sm:inline">{group.suggestion}</span>
        </button>
      </div>

      {/* Expanded email list */}
      {expanded && (
        <div className="border-t border-foreground/10 px-3 py-2 space-y-1">
          {loadingEmails && (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[11px]">Carregando e-mails...</span>
            </div>
          )}
          {!loadingEmails && emails.length === 0 && (
            <p className="text-[11px] text-muted-foreground py-1">
              {group.emailIds.length} e-mail(s) — detalhes indisponíveis no cache.
            </p>
          )}
          {!loadingEmails && visibleEmails.map(email => {
            const isExcluded = excludedIds.has(email.id);
            return (
              <div
                key={email.id}
                className={`flex items-center gap-2 py-1 px-2 rounded text-[11px] transition-colors ${
                  isExcluded ? "opacity-40 line-through" : "hover:bg-foreground/5"
                }`}
              >
                <button
                  onClick={() => toggleExclude(email.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title={isExcluded ? "Incluir de volta" : "Remover da limpeza"}
                >
                  {isExcluded ? <X className="w-3 h-3 text-destructive" /> : <CheckSquare className="w-3 h-3 text-primary" />}
                </button>
                <span className="flex-1 truncate text-foreground">{email.subject}</span>
                <span className="shrink-0 text-muted-foreground/60 text-[10px]">
                  {new Date(email.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              </div>
            );
          })}
          {!loadingEmails && emails.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[10px] text-primary hover:underline pt-1"
            >
              {showAll ? "Mostrar menos" : `Ver todos (${emails.length})`}
            </button>
          )}
          {excludedIds.size > 0 && (
            <p className="text-[10px] text-amber-500 pt-1">
              {excludedIds.size} e-mail(s) removido(s) da limpeza
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CleanerGroupItem;
