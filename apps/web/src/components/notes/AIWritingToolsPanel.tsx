import { useState } from "react";
import {
  Sparkles, CheckCircle, RefreshCw, Smile, Briefcase, Scissors,
  FileText, ListOrdered, Table, PenLine, Loader2, Wand2, Languages,
  Tag, ListTree
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type AIWritingAction =
  | "proofread" | "rewrite"
  | "change_tone" | "summarize"
  | "key_points" | "to_list" | "to_table"
  | "compose" | "expand" | "continue_writing"
  | "translate" | "suggest_tags" | "generate_from_title" | "generate_outline";

interface AIWritingToolsPanelProps {
  onAction: (action: string, extra?: Record<string, string>) => void;
  loading: string | null;
  hasContent: boolean;
  hasSelection: boolean;
}

const toneActions = [
  { tone: "casual",       label: "Amigável",     icon: <Smile className="w-4 h-4" /> },
  { tone: "formal",       label: "Profissional",  icon: <Briefcase className="w-4 h-4" /> },
  { tone: "concise",      label: "Conciso",       icon: <Scissors className="w-4 h-4" /> },
];

const transformActions = [
  { action: "summarize",   label: "Resumo",             icon: <FileText className="w-4 h-4" /> },
  { action: "key_points",  label: "Pontos Principais",  icon: <ListOrdered className="w-4 h-4" /> },
  { action: "to_list",     label: "Converter em Lista",  icon: <ListOrdered className="w-4 h-4" /> },
  { action: "to_table",    label: "Converter em Tabela", icon: <Table className="w-4 h-4" /> },
];

const moreActions = [
  { action: "expand",             label: "Expandir",          icon: <Wand2 className="w-4 h-4" /> },
  { action: "translate",          label: "Traduzir PT↔EN",    icon: <Languages className="w-4 h-4" /> },
  { action: "generate_outline",   label: "Gerar outline",     icon: <ListTree className="w-4 h-4" /> },
  { action: "suggest_tags",       label: "Sugerir tags",      icon: <Tag className="w-4 h-4" /> },
];

export function AIWritingToolsPanel({ onAction, loading, hasContent, hasSelection }: AIWritingToolsPanelProps) {
  const [composePrompt, setComposePrompt] = useState("");
  const disabled = !!loading;
  const contentAvailable = hasContent || hasSelection;

  const handleCompose = () => {
    if (!composePrompt.trim()) return;
    onAction("compose", { prompt: composePrompt });
    setComposePrompt("");
  };

  return (
    <div className="w-72 p-1">
      {/* Free prompt input */}
      <div className="p-2">
        <Textarea
          value={composePrompt}
          onChange={e => setComposePrompt(e.target.value)}
          placeholder="Descreva sua alteração..."
          className="min-h-[60px] text-xs rounded-xl resize-none border-border/30 bg-foreground/5"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCompose(); } }}
        />
        <Button
          size="sm"
          onClick={handleCompose}
          disabled={disabled || !composePrompt.trim()}
          className="w-full mt-1.5 rounded-xl gap-1.5 text-xs"
        >
          {loading === "compose" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Aplicar com IA
        </Button>
      </div>

      <div className="h-px bg-border/30 my-1" />

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-1 p-1">
        <ActionButton
          icon={<CheckCircle className="w-4 h-4" />}
          label="Revisar"
          onClick={() => onAction("proofread")}
          disabled={disabled || !contentAvailable}
          loading={loading === "proofread"}
        />
        <ActionButton
          icon={<RefreshCw className="w-4 h-4" />}
          label="Reescrever"
          onClick={() => onAction("rewrite")}
          disabled={disabled || !contentAvailable}
          loading={loading === "rewrite"}
        />
      </div>

      <div className="h-px bg-border/30 my-1" />

      {/* Tone options */}
      <p className="text-xs text-muted-foreground px-3 py-1 font-medium">Tom</p>
      <div className="space-y-0.5 px-1">
        {toneActions.map(t => (
          <ActionButton
            key={t.tone}
            icon={t.icon}
            label={t.label}
            onClick={() => onAction("change_tone", { tone: t.tone })}
            disabled={disabled || !contentAvailable}
            loading={loading === "change_tone"}
            fullWidth
          />
        ))}
      </div>

      <div className="h-px bg-border/30 my-1" />

      {/* Transform options */}
      <p className="text-xs text-muted-foreground px-3 py-1 font-medium">Transformar</p>
      <div className="space-y-0.5 px-1">
        {transformActions.map(t => (
          <ActionButton
            key={t.action}
            icon={t.icon}
            label={t.label}
            onClick={() => onAction(t.action)}
            disabled={disabled || !contentAvailable}
            loading={loading === t.action}
            fullWidth
          />
        ))}
      </div>

      <div className="h-px bg-border/30 my-1" />

      {/* More actions */}
      <p className="text-xs text-muted-foreground px-3 py-1 font-medium">Mais</p>
      <div className="space-y-0.5 px-1">
        {moreActions.map(t => (
          <ActionButton
            key={t.action}
            icon={t.icon}
            label={t.label}
            onClick={() => onAction(t.action)}
            disabled={disabled || !contentAvailable}
            loading={loading === t.action}
            fullWidth
          />
        ))}
      </div>

      <div className="h-px bg-border/30 my-1" />

      {/* Continue writing */}
      <div className="px-1 pb-1">
        <ActionButton
          icon={<PenLine className="w-4 h-4" />}
          label="Continuar escrita"
          onClick={() => onAction("continue_writing")}
          disabled={disabled || !contentAvailable}
          loading={loading === "continue_writing"}
          fullWidth
        />
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled, loading, fullWidth }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors text-foreground/80 hover:bg-muted/70 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
