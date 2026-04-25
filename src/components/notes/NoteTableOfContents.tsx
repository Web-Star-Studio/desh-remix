import { useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { List, X, ChevronRight } from "lucide-react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface NoteTableOfContentsProps {
  content: string;
}

function extractHeadings(html: string): Heading[] {
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings: Heading[] = [];
  doc.querySelectorAll("h1, h2, h3, h4").forEach((el, i) => {
    const text = el.textContent?.trim();
    if (text) {
      headings.push({
        id: `heading-${i}`,
        text,
        level: parseInt(el.tagName[1]),
      });
    }
  });
  return headings;
}

const NoteTableOfContents = memo(({ content }: NoteTableOfContentsProps) => {
  const [open, setOpen] = useState(false);
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length < 2) return null;

  const scrollToHeading = (heading: Heading) => {
    // Find the heading in the editor by matching text
    const editor = document.querySelector(".ProseMirror");
    if (!editor) return;
    const els = editor.querySelectorAll("h1, h2, h3, h4");
    for (const el of els) {
      if (el.textContent?.trim() === heading.text) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Brief highlight
        el.classList.add("bg-primary/10");
        setTimeout(() => el.classList.remove("bg-primary/10"), 1500);
        break;
      }
    }
    setOpen(false);
  };

  const minLevel = Math.min(...headings.map(h => h.level));

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-xl transition-colors ${open ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        aria-label="Sumário"
        title={`Sumário (${headings.length} seções)`}
      >
        <List className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-border/20"
          >
            <div className="px-4 py-3 max-h-52 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <List className="w-3 h-3" /> Sumário
                </p>
                <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <nav className="space-y-0.5">
                {headings.map(h => (
                  <button
                    key={h.id}
                    onClick={() => scrollToHeading(h)}
                    className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs hover:bg-muted/50 transition-colors text-foreground/80 hover:text-foreground"
                    style={{ paddingLeft: `${(h.level - minLevel) * 12 + 8}px` }}
                  >
                    <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                    <span className="truncate">{h.text}</span>
                  </button>
                ))}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

NoteTableOfContents.displayName = "NoteTableOfContents";
export default NoteTableOfContents;
