import { useState, useRef, useEffect, useCallback } from "react";
import { FileText, Loader2, Send, X, ChevronDown, ChevronUp, Sparkles, Wand2 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { useSmartCommands } from "@/hooks/ui/useSmartCommands";
import SmartCommandPopup from "@/components/ui/SmartCommandPopup";
import { useUndoable } from "@/hooks/common/useUndoable";
import KeyboardShortcutsIndicator, { EMAIL_SHORTCUTS } from "@/components/ui/KeyboardShortcutsIndicator";

interface ComposePanelProps {
  composeTo: string;
  setComposeTo: (v: string) => void;
  composeCc?: string;
  setComposeCc?: (v: string) => void;
  composeBcc?: string;
  setComposeBcc?: (v: string) => void;
  composeSubject: string;
  setComposeSubject: (v: string) => void;
  composeBody: string;
  setComposeBody: (v: string) => void;
  onSend: () => void;
  onSaveDraft: () => void;
  onClose: () => void;
  isSending: boolean;
  gmailSending: boolean;
  gmailConnected: boolean;
  // AI compose
  onComposeAi?: (body: string, to: string) => Promise<string | null>;
  aiLoading?: string | null;
}

const ComposePanel = ({
  composeTo, setComposeTo, composeCc, setComposeCc, composeBcc, setComposeBcc,
  composeSubject, setComposeSubject, composeBody, setComposeBody,
  onSend, onSaveDraft, onClose, isSending, gmailSending, gmailConnected,
  onComposeAi, aiLoading,
}: ComposePanelProps) => {
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const undoable = useUndoable(composeBody);

  // Sync undoable → parent state (use ref to avoid infinite loop)
  const composeBodyRef = useRef(composeBody);
  composeBodyRef.current = composeBody;
  useEffect(() => {
    if (undoable.value !== composeBodyRef.current) setComposeBody(undoable.value);
  }, [undoable.value, setComposeBody]);

  const smartCommands = useSmartCommands({
    inputRef: bodyRef,
    value: composeBody,
    onChange: (v: string) => undoable.set(v),
    enabledTriggers: ["@", "/", "#"],
    context: "email",
  });

  // Wrap selected text with formatting tags
  const wrapSelection = useCallback((openTag: string, closeTag: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = composeBody;
    const selected = text.slice(start, end);
    const newText = text.slice(0, start) + openTag + selected + closeTag + text.slice(end);
    undoable.set(newText);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = selected ? start + openTag.length + selected.length + closeTag.length : start + openTag.length;
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }, [composeBody, undoable]);

  // Keyboard shortcuts for the compose panel
  const handleComposeKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey;
    // Ctrl+Enter → Send
    if (isMod && e.key === "Enter") { e.preventDefault(); onSend(); return; }
    // Ctrl+S → Save draft
    if (isMod && e.key === "s") { e.preventDefault(); if (gmailConnected) onSaveDraft(); return; }
    // Ctrl+B → Bold
    if (isMod && e.key === "b") { e.preventDefault(); wrapSelection("<b>", "</b>"); return; }
    // Ctrl+I → Italic
    if (isMod && e.key === "i") { e.preventDefault(); wrapSelection("<i>", "</i>"); return; }
    // Ctrl+U → Underline
    if (isMod && e.key === "u") { e.preventDefault(); wrapSelection("<u>", "</u>"); return; }
    // Ctrl+Z → Undo
    if (isMod && !e.shiftKey && e.key === "z") { e.preventDefault(); undoable.undo(); return; }
    // Ctrl+Shift+Z / Ctrl+Y → Redo
    if (isMod && e.shiftKey && e.key === "z") { e.preventDefault(); undoable.redo(); return; }
    if (isMod && e.key === "y") { e.preventDefault(); undoable.redo(); return; }
    // Escape → Close
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
  }, [onSend, onSaveDraft, onClose, gmailConnected, undoable, wrapSelection]);

  const handleAiCompose = async () => {
    if (!onComposeAi) return;
    const result = await onComposeAi(aiPrompt || composeBody, composeTo);
    if (result) {
      undoable.set(result);
      setShowAiPrompt(false);
      setAiPrompt("");
    }
  };

  return (
    <AnimatedItem index={0}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Nova mensagem</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="Para:"
              className="flex-1 bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
            <button onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors flex items-center gap-1">
              Cc/Bcc {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {showCcBcc && (
            <>
              <input value={composeCc || ""} onChange={e => setComposeCc?.(e.target.value)} placeholder="Cc:"
                className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              <input value={composeBcc || ""} onChange={e => setComposeBcc?.(e.target.value)} placeholder="Bcc:"
                className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </>
          )}
          <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Assunto:"
            className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
          <div className="relative" onKeyDown={handleComposeKeyDown}>
            <textarea
              ref={bodyRef}
              value={composeBody}
              onChange={e => smartCommands.handleChange(e.target.value, e.target.selectionStart)}
              onKeyDown={smartCommands.handleKeyDown}
              placeholder="Escreva sua mensagem... (use @ para menções, / para comandos, Ctrl+Enter enviar)"
              rows={typeof window !== "undefined" && window.innerWidth < 768 ? 5 : 8}
              className="w-full bg-foreground/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
            />
            <SmartCommandPopup
              open={smartCommands.popup.open}
              items={smartCommands.popup.items}
              selectedIndex={smartCommands.popup.selectedIndex}
              trigger={smartCommands.popup.trigger}
              position={smartCommands.popup.position}
              onSelect={smartCommands.selectItem}
              onClose={smartCommands.closePopup}
            />
            {/* Character & word counter */}
            {composeBody.length > 0 && (
              <div className="absolute bottom-2 right-2 flex items-center gap-2 text-[10px] text-muted-foreground/60 select-none pointer-events-none">
                <span>{composeBody.split(/\s+/).filter(Boolean).length} palavras</span>
                <span className="w-px h-3 bg-foreground/10" />
                <span className={composeBody.length > 10000 ? "text-destructive" : ""}>{composeBody.length.toLocaleString("pt-BR")} chars</span>
              </div>
            )}
          </div>

          {/* AI Compose */}
          {showAiPrompt && onComposeAi && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Compor com IA</span>
                <button onClick={() => setShowAiPrompt(false)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
              </div>
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex: Escreva um e-mail formal agradecendo..."
                onKeyDown={e => { if (e.key === "Enter") handleAiCompose(); }}
                className="w-full bg-background/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-foreground/10" />
              <button onClick={handleAiCompose} disabled={aiLoading === "compose_ai"}
                className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-lg py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                {aiLoading === "compose_ai" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Gerar com IA
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {onComposeAi && (
              <button onClick={() => setShowAiPrompt(!showAiPrompt)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border border-foreground/10 min-h-[44px] sm:min-h-0 ${
                  showAiPrompt ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}>
                <Sparkles className="w-3.5 h-3.5" /> IA
              </button>
            )}
            <div className="hidden md:block">
              <KeyboardShortcutsIndicator shortcuts={EMAIL_SHORTCUTS} />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            {gmailConnected && (
              <button onClick={onSaveDraft} disabled={gmailSending || !composeBody.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-40 border border-foreground/10 min-h-[44px] sm:min-h-0">
                {gmailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} <span className="hidden sm:inline">Rascunho</span>
              </button>
            )}
            <button onClick={onSend} disabled={isSending || gmailSending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[44px] sm:min-h-0">
              {isSending || gmailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          </div>
        </div>
      </div>
    </AnimatedItem>
  );
};

export default ComposePanel;
