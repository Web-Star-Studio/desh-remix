import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { User, CheckSquare, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────

interface MentionItem {
  id: string;
  label: string;
  description?: string;
  category: "Contato" | "Tarefa" | "Nota";
  metadata?: Record<string, any>;
}

const CATEGORY_CONFIG = {
  Contato: { icon: User, color: "bg-blue-500/15 text-blue-400" },
  Tarefa: { icon: CheckSquare, color: "bg-amber-500/15 text-amber-400" },
  Nota: { icon: FileText, color: "bg-emerald-500/15 text-emerald-400" },
};

// ── Data fetching ──────────────────────────────────────────────

async function fetchMentionSuggestions(query: string): Promise<MentionItem[]> {
  const q = query.toLowerCase();
  const results: MentionItem[] = [];

  // Contacts
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, company")
    .ilike("name", `%${q}%`)
    .limit(5);

  if (contacts) {
    for (const c of contacts) {
      results.push({
        id: c.id,
        label: c.name,
        description: [c.email, c.company].filter(Boolean).join(" · "),
        category: "Contato",
        metadata: { type: "contact", ...c },
      });
    }
  }

  // Tasks
  const { data: tasks } = await supabase
    .from("tasks" as any)
    .select("id, title, status")
    .ilike("title", `%${q}%`)
    .limit(4);

  if (tasks) {
    for (const t of tasks as any[]) {
      results.push({
        id: t.id,
        label: t.title,
        description: t.status,
        category: "Tarefa",
        metadata: { type: "task", ...t },
      });
    }
  }

  // Notes
  const { data: notes } = await supabase
    .from("user_data")
    .select("id, data")
    .eq("data_type", "note")
    .limit(20);

  if (notes) {
    for (const n of notes) {
      const noteData = n.data as any;
      const title = noteData?.title || "Sem título";
      if (!title.toLowerCase().includes(q)) continue;
      results.push({
        id: n.id,
        label: title,
        description: "Nota",
        category: "Nota",
        metadata: { type: "note", id: n.id },
      });
      if (results.filter(r => r.category === "Nota").length >= 4) break;
    }
  }

  return results;
}

// ── Popup component ────────────────────────────────────────────

interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

export interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { setSelectedIndex(0); }, [items]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i - 1 + items.length) % Math.max(1, items.length));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % Math.max(1, items.length));
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) {
    return (
      <div className="w-[280px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl text-popover-foreground shadow-xl p-3">
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado para @menção</p>
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, MentionItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  let flatIndex = 0;

  return (
    <div className="w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl text-popover-foreground shadow-xl">
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Menções</p>
        </div>
      </div>

      {Object.entries(grouped).map(([category, mentionItems]) => {
        const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
        const Icon = config?.icon || User;

        return (
          <div key={category}>
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-3 py-1.5">{category}</p>
            {mentionItems.map(item => {
              const idx = flatIndex++;
              return (
                <button
                  key={item.id}
                  ref={el => { itemRefs.current[idx] = el; }}
                  onClick={() => command(item)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${config?.color || "bg-foreground/10 text-foreground/70"}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground/60">
        <span><kbd className="bg-foreground/5 rounded px-1 py-0.5 font-mono">↑↓</kbd> navegar</span>
        <span><kbd className="bg-foreground/5 rounded px-1 py-0.5 font-mono">↵</kbd> selecionar</span>
        <span><kbd className="bg-foreground/5 rounded px-1 py-0.5 font-mono">Esc</kbd> fechar</span>
      </div>
    </div>
  );
});

MentionList.displayName = "MentionList";

// ── TipTap Mention Extension configured with Supabase ──────────

export const DeshMention = Mention.configure({
  HTMLAttributes: {
    class: "mention",
  },
  suggestion: {
    char: "@",
    items: async ({ query }: { query: string }) => {
      return await fetchMentionSuggestions(query);
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },

        onUpdate(props: SuggestionProps) {
          component?.updateProps(props);
          if (!props.clientRect) return;
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  },
});
