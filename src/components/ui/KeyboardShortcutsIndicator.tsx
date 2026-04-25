import { useState } from "react";
import { Keyboard } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";

interface Shortcut {
  keys: string;
  label: string;
}

interface KeyboardShortcutsIndicatorProps {
  shortcuts: Shortcut[];
  /** Compact inline text mode (no popover) */
  inline?: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "⌘" : "Ctrl";

export const formatKey = (keys: string) =>
  keys.replace(/Ctrl/g, mod).replace(/\+/g, isMac ? "" : "+");

const KeyboardShortcutsIndicator = ({ shortcuts, inline }: KeyboardShortcutsIndicatorProps) => {
  if (inline) {
    return (
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        {shortcuts.map((s, i) => (
          <span key={i}>
            {i > 0 && " • "}
            <kbd className="text-[10px] font-mono text-muted-foreground/80">{formatKey(s.keys)}</kbd>
            {" "}{s.label}
          </span>
        ))}
      </p>
    );
  }

  return (
    <DeshTooltip
      label={shortcuts.map(s => `${formatKey(s.keys)} → ${s.label}`).join("\n")}
      side="top"
    >
      <button
        type="button"
        className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        tabIndex={-1}
      >
        <Keyboard className="w-3.5 h-3.5" />
      </button>
    </DeshTooltip>
  );
};

export default KeyboardShortcutsIndicator;

// Pre-defined shortcut sets for each module
export const EMAIL_SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl+Enter", label: "enviar" },
  { keys: "Ctrl+S", label: "rascunho" },
  { keys: "Ctrl+B", label: "negrito" },
  { keys: "Ctrl+I", label: "itálico" },
  { keys: "Ctrl+U", label: "sublinhado" },
  { keys: "Ctrl+Z", label: "desfazer" },
  { keys: "Esc", label: "fechar" },
];

export const CHAT_SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl+Enter", label: "enviar" },
  { keys: "Ctrl+L", label: "limpar" },
  { keys: "Ctrl+F", label: "buscar" },
  { keys: "Esc", label: "parar/fechar" },
];

export const MESSAGES_SHORTCUTS: Shortcut[] = [
  { keys: "Enter", label: "enviar" },
  { keys: "Ctrl+Enter", label: "enviar" },
  { keys: "Esc", label: "cancelar reply" },
];

export const AUTOMATION_SHORTCUTS: Shortcut[] = [
  { keys: "Enter", label: "enviar" },
  { keys: "Ctrl+Enter", label: "enviar" },
  { keys: "Esc", label: "fechar" },
];
