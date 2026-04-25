import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link as LinkIcon, X, ExternalLink, Unlink } from "lucide-react";

interface LinkInputPopoverProps {
  onSubmit: (url: string) => void;
  onRemove?: () => void;
  onClose: () => void;
  initialUrl?: string;
}

export function LinkInputPopover({ onSubmit, onRemove, onClose, initialUrl = "" }: LinkInputPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus with a small delay to ensure portal is mounted
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim();
    if (trimmed) {
      // Auto-prepend https:// if no protocol
      const finalUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      onSubmit(finalUrl);
    }
    onClose();
  }, [url, onSubmit, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }, [handleSubmit, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-80 rounded-2xl border border-border/50 bg-popover shadow-2xl shadow-black/30 animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
          <LinkIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {initialUrl ? "Editar link" : "Inserir link"}
          </span>
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://exemplo.com"
            className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!url.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all disabled:opacity-40"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {initialUrl ? "Atualizar" : "Inserir"}
            </button>
            {initialUrl && onRemove && (
              <button
                onClick={() => { onRemove(); onClose(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-[10px]">
              <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 text-[10px]">↵</kbd> inserir
            </span>
            <span className="text-[10px]">
              <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 text-[10px]">esc</kbd> cancelar
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
