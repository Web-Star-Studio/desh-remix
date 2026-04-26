import { useEffect, useRef, useState } from "react";
import { Loader2, Save, X, Sparkles, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import pandoraAvatar from "@/assets/pandora-avatar.png";
import { useAgentProfiles, useUpdateAgentProfile } from "@/hooks/api/useAgentProfiles";

export interface PersonaModalProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

const PersonaModal = ({ workspaceId, open, onClose }: PersonaModalProps) => {
  const { data: profiles, isLoading } = useAgentProfiles(open ? workspaceId : null);
  const updateMut = useUpdateAgentProfile(workspaceId);
  const profile = profiles?.[0] ?? null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [extension, setExtension] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Hydrate textarea from the profile's extension when the modal opens.
  useEffect(() => {
    if (!open) return;
    setExtension(profile?.systemPrompt ?? "");
    setSavedAt(null);
    setSaveError(null);
  }, [open, profile?.id, profile?.systemPrompt]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = async () => {
    if (!profile) return;
    setSaveError(null);
    try {
      await updateMut.mutateAsync({
        profileId: profile.id,
        patch: { systemPrompt: extension.trim() ? extension : null },
      });
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao salvar");
    }
  };

  const handleClear = () => {
    setExtension("");
    textareaRef.current?.focus();
  };

  const charCount = extension.length;
  const tokenEstimate = Math.ceil(charCount / 4);
  const hasContent = extension.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header — mirrors PageHeader: avatar + title block + close */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0 pandora-glow">
                  <img
                    src={pandoraAvatar}
                    alt="Pandora"
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20 relative z-10"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Contexto deste workspace
                  </h2>
                  <p className="text-[11px] text-muted-foreground/80 truncate">
                    A identidade da Pandora é fixa — aqui você só adiciona contexto.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-4 sm:px-6 py-4 min-h-0 flex flex-col gap-3">
              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : !profile ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground italic">
                  Nenhum agent profile encontrado para este workspace.
                </div>
              ) : (
                <>
                  {/* Inline preface — explicit framing about what this is and what
                      isn't. Mirrors the SOUL.md priority rule that the backend
                      composes at gateway-spawn time. */}
                  <div className="rounded-xl bg-muted/30 border border-border/20 px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="text-foreground/80 font-medium">Como funciona:</span> a
                    Pandora carrega <em>todas as suas regras de identidade, tom, comunicação e
                    operação</em> automaticamente — você não precisa (e não pode) editar isso.
                    O que você escreve aqui vira <em>contexto adicional</em> sobre este workspace:
                    o domínio em que a Pandora atua, fatos sobre o negócio, preferências
                    específicas. Em qualquer conflito, as regras Pandora prevalecem.
                  </div>

                  {/* The textarea echoes the assistant message bubble: same dark
                      surface + white text. Reinforces the metaphor: you're writing
                      into Pandora's "ear", not rewriting her. */}
                  <textarea
                    ref={textareaRef}
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    placeholder={`Ex:
Este workspace é da agência Web Star Studio. Atendemos clientes B2B de tecnologia.

Termos importantes:
- "Squad" = time interno alocado em um cliente
- "Sprint" = ciclo quinzenal de entrega

Preferências:
- Prefiro respostas em formato de bullets curtos
- Sempre sugira próximo passo ao final`}
                    className="flex-1 min-h-[36vh] resize-none rounded-2xl bg-neutral-900 text-white border border-border/30 px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-white/30"
                    spellCheck={false}
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-border/20 flex flex-wrap items-center gap-3 justify-between">
              {/* Stats — mono, matches chat header */}
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 tabular-nums">
                {charCount.toLocaleString("pt-BR")} chars · ~{tokenEstimate.toLocaleString("pt-BR")} tokens
                {profile?.modelId && (
                  <>
                    <span className="opacity-50 mx-1.5">·</span>
                    <span className="normal-case tracking-normal">{profile.modelId}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {saveError && (
                  <span className="text-[11px] text-destructive">{saveError}</span>
                )}
                {savedAt && !updateMut.isPending && (
                  <span className="text-[11px] text-emerald-500/90 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> gateway reiniciado
                  </span>
                )}
                {hasContent && (
                  <button
                    onClick={handleClear}
                    disabled={updateMut.isPending}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 transition-colors disabled:opacity-40"
                    title="Limpar contexto adicional"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpar
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!profile || updateMut.isPending}
                  className="px-3 py-1.5 rounded-xl text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
                >
                  {updateMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Salvar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PersonaModal;
