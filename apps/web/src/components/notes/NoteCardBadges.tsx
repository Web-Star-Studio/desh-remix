/**
 * NoteCard — Rich card component for grid/list note views.
 * Shows freshness indicator, progress bar for task notes, and smart badges.
 */
import { memo, useMemo } from "react";
import { Note } from "@/contexts/DashboardContext";
import { Clock, Pin, Star, BookOpen, CheckSquare, Mic, PenTool, AlignLeft } from "lucide-react";
import { getTextStats, getSnippet } from "@/lib/notesPageUtils";

interface NoteCardProps {
  note: Note;
  isGrid: boolean;
}

function getRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}sem`;
  return `${Math.floor(days / 30)}m`;
}

function getFreshnessBadge(dateStr: string | undefined): { label: string; class: string } | null {
  if (!dateStr) return null;
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 5) return { label: "agora", class: "bg-green-500/15 text-green-500" };
  if (mins < 60) return { label: `${mins}min`, class: "bg-primary/15 text-primary" };
  return null;
}

/** Count completed/total task items in HTML content */
function getTaskProgress(content: string): { done: number; total: number } | null {
  if (!content.includes("data-type=\"taskItem\"") && !content.includes("data-checked")) return null;
  const total = (content.match(/data-type="taskItem"/g) || []).length;
  if (total === 0) return null;
  const done = (content.match(/data-checked="true"/g) || []).length;
  return { done, total };
}

function getNoteType(note: Note): { icon: typeof Pin; label: string } | null {
  if (note.tags?.includes("transcrição")) return { icon: Mic, label: "Transcrição" };
  if (note.content?.includes("data-drawing=\"true\"")) return { icon: PenTool, label: "Desenho" };
  if (note.content?.includes("data-type=\"taskItem\"")) return { icon: CheckSquare, label: "Tarefas" };
  return null;
}

export const NoteCardBadges = memo(function NoteCardBadges({ note }: { note: Note }) {
  const freshness = getFreshnessBadge(note.updated_at);
  const noteType = getNoteType(note);
  const taskProgress = useMemo(() => getTaskProgress(note.content), [note.content]);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {note.pinned && <Pin className="w-3 h-3 text-primary fill-primary flex-shrink-0" />}
      {note.favorited && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
      {freshness && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${freshness.class}`}>
          {freshness.label}
        </span>
      )}
      {noteType && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/70 text-muted-foreground font-medium flex items-center gap-0.5">
          <noteType.icon className="w-2.5 h-2.5" />
          {noteType.label}
        </span>
      )}
      {taskProgress && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          taskProgress.done === taskProgress.total ? "bg-green-500/15 text-green-500" : "bg-muted/70 text-muted-foreground"
        }`}>
          {taskProgress.done}/{taskProgress.total}
        </span>
      )}
    </div>
  );
});

export const NoteRelativeTime = memo(function NoteRelativeTime({ dateStr }: { dateStr: string | undefined }) {
  const relative = getRelativeTime(dateStr);
  if (!relative) return null;
  return (
    <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5">
      <Clock className="w-2.5 h-2.5" />
      {relative}
    </span>
  );
});

/** Task progress mini bar for note cards */
export const TaskProgressBar = memo(function TaskProgressBar({ content }: { content: string }) {
  const progress = useMemo(() => getTaskProgress(content), [content]);
  if (!progress || progress.total === 0) return null;
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct === 100 ? "bg-green-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/50 tabular-nums">{pct}%</span>
    </div>
  );
});
