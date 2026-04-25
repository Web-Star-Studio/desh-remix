import { useMemo, memo, useState } from "react";
import { Note } from "@/contexts/DashboardContext";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { getSnippet } from "@/lib/notesPageUtils";

interface RelatedNotesProps {
  currentNote: Note;
  allNotes: Note[];
  onOpenNote: (note: Note) => void;
}

function computeRelevance(current: Note, candidate: Note): number {
  let score = 0;
  // Same notebook
  if (current.notebook && candidate.notebook === current.notebook) score += 3;
  // Shared tags
  const currentTags = current.tags || [];
  const candidateTags = candidate.tags || [];
  const shared = currentTags.filter(t => candidateTags.includes(t)).length;
  score += shared * 2;
  // Title word overlap
  const currentWords = new Set(current.title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const candidateWords = candidate.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (const w of candidateWords) {
    if (currentWords.has(w)) score += 1;
  }
  return score;
}

const RelatedNotes = memo(({ currentNote, allNotes, onOpenNote }: RelatedNotesProps) => {
  const [expanded, setExpanded] = useState(false);

  const related = useMemo(() => {
    return allNotes
      .filter(n => n.id !== currentNote.id && !n.deleted_at)
      .map(n => ({ note: n, score: computeRelevance(currentNote, n) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(r => r.note);
  }, [currentNote, allNotes]);

  if (related.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-border/20 flex-shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Lightbulb className="w-3 h-3 text-yellow-500" />
        <span className="font-medium">Notas relacionadas ({related.length})</span>
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1">
              {related.map(note => (
                <button
                  key={note.id}
                  onClick={() => onOpenNote(note)}
                  className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{note.title}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{getSnippet(note.content).slice(0, 60)}</p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

RelatedNotes.displayName = "RelatedNotes";
export default RelatedNotes;
