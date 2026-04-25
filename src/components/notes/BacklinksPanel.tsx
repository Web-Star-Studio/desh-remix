import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link2, StickyNote, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface BacklinkItem {
  id: string;
  title: string;
  snippet: string;
}

interface BacklinksPanelProps {
  currentNoteId: string;
  onNavigateToNote: (noteId: string) => void;
}

export function BacklinksPanel({ currentNoteId, onNavigateToNote }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!currentNoteId) return;
    let cancelled = false;

    const fetchBacklinks = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("user_data")
          .select("id, data")
          .eq("data_type", "note")
          .neq("id", currentNoteId)
          .limit(200);

        if (cancelled || !data) { if (!cancelled) setBacklinks([]); return; }

        const links: BacklinkItem[] = [];
        for (const note of data) {
          const noteData = note.data as any;
          const content: string = noteData?.content || "";
          if (content.includes(currentNoteId)) {
            const title = noteData?.title || "Sem título";
            const plainText = content.replace(/<[^>]+>/g, "").slice(0, 100);
            links.push({ id: note.id, title, snippet: plainText });
          }
        }
        if (!cancelled) setBacklinks(links);
      } catch {
        if (!cancelled) setBacklinks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBacklinks();
    return () => { cancelled = true; };
  }, [currentNoteId]);

  // Always show the section header, but with empty state when no backlinks
  return (
    <div className="px-4 py-3 border-t border-border/20 flex-shrink-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Link2 className="w-3 h-3 text-primary/60" />
        <span>Backlinks</span>
        {!loading && (
          <span className="text-[10px] font-normal text-muted-foreground/50 bg-foreground/8 px-1.5 py-0.5 rounded-full ml-1">
            {backlinks.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40" />
            </div>
          ) : backlinks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/40 px-3 py-2">
              Nenhuma nota referencia esta nota ainda.
            </p>
          ) : (
            backlinks.map(bl => (
              <button
                key={bl.id}
                onClick={() => onNavigateToNote(bl.id)}
                className="w-full flex items-start gap-2 px-3 py-2 rounded-xl text-left text-sm hover:bg-muted/40 transition-colors group"
              >
                <StickyNote className="w-3.5 h-3.5 text-pink-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground/90 truncate group-hover:text-foreground text-xs">{bl.title}</p>
                  <p className="text-[11px] text-muted-foreground/60 truncate">{bl.snippet}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
