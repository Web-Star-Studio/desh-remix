import { useState, useEffect, useRef, useCallback } from "react";
import {
  useRealtimeTranscription,
  TranscriptSegment,
  SUPPORTED_LANGUAGES,
} from "@/hooks/audio/useRealtimeTranscription";
import { toast } from "@/hooks/use-toast";
import { notifyAiShortcutPending } from "@/lib/aiShortcuts";
import {
  Mic,
  Pause,
  Play,
  Square,
  Loader2,
  AlertTriangle,
  UserPlus,
  User,
  Pencil,
  Check,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";

type TranscriptionState = "idle" | "recording" | "paused" | "processing" | "done";

interface TranscriptionPanelProps {
  onComplete: (data: {
    title: string;
    summary: string;
    transcript: string;
    segments: TranscriptSegment[];
  }) => void;
  onCancel: () => void;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const SPEAKER_COLORS = [
  "text-blue-400",
  "text-emerald-400",
  "text-amber-400",
  "text-purple-400",
  "text-rose-400",
  "text-cyan-400",
  "text-orange-400",
  "text-teal-400",
];

function speakerColor(index: number) {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

function speakerIndex(name: string) {
  const num = parseInt(name.replace(/\D/g, "") || "1");
  return Math.max(0, num - 1);
}

// ── Waveform bars component ────────────────────────────────────────────
function AudioWaveform({ level, active }: { level: number; active: boolean }) {
  const bars = 5;
  return (
    <div className="flex items-center gap-[2px] h-4">
      {Array.from({ length: bars }).map((_, i) => {
        const barLevel = active ? Math.max(0.15, level * (0.5 + Math.random() * 0.5)) : 0.15;
        return (
          <motion.div
            key={i}
            className="w-[3px] rounded-full bg-destructive"
            animate={{ height: `${Math.max(4, barLevel * 16)}px` }}
            transition={{ duration: 0.1 }}
          />
        );
      })}
    </div>
  );
}

// ── Editable speaker name ────────────────────────────────────────────
function EditableSpeakerButton({
  name,
  index,
  isActive,
  onSelect,
  onRename,
}: {
  name: string;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setValue(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(name);
              setEditing(false);
            }
          }}
          className="h-7 text-xs w-28 px-2 rounded-lg"
        />
        <button onClick={commit} className="p-0.5 rounded text-primary hover:bg-primary/10">
          <Check className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button
        size="sm"
        variant={isActive ? "default" : "outline"}
        onClick={onSelect}
        className="rounded-xl gap-1.5 h-7 text-xs px-2.5"
      >
        <User className={`w-3 h-3 ${speakerColor(index)}`} />
        {name}
      </Button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        title="Renomear participante"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────
export function TranscriptionPanel({ onComplete, onCancel }: TranscriptionPanelProps) {
  const {
    transcript,
    segments,
    interimText,
    isRecording,
    isPaused,
    duration,
    currentSpeaker,
    speakerCount,
    language,
    audioLevel,
    start,
    pause,
    resume,
    stop,
    changeSpeaker,
    addSpeaker,
    renameSpeaker,
    setLanguage,
    supported,
  } = useRealtimeTranscription();

  const [panelState, setPanelState] = useState<TranscriptionState>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segments, interimText]);

  useEffect(() => {
    if (isRecording && !isPaused) setPanelState("recording");
    else if (isRecording && isPaused) setPanelState("paused");
  }, [isRecording, isPaused]);

  const handleStart = () => {
    start();
    setPanelState("recording");
  };

  const handleStop = async () => {
    const finalSegments = stop();
    const fullTranscript =
      finalSegments
        ?.map((s) => `[${s.speaker}] (${formatDuration(s.timestamp)}): ${s.text.trim()}`)
        .join("\n") || "";

    if (!fullTranscript.trim()) {
      toast({
        title: "Nenhuma transcrição capturada",
        description: "Fale algo e tente novamente.",
        variant: "destructive",
      });
      setPanelState("idle");
      return;
    }

    setPanelState("processing");
    notifyAiShortcutPending("Resumo de transcrição indisponível");
    onComplete({
      title: `Transcrição — ${new Date().toLocaleDateString("pt-BR")}`,
      summary: "",
      transcript: fullTranscript,
      segments: finalSegments || [],
    });
    setPanelState("done");
  };

  const speakerList = Array.from({ length: speakerCount }, (_, i) => `Participante ${i + 1}`);
  // Resolve renamed speakers for display
  const resolvedSpeakers = useCallback(
    (list: string[]) => {
      // Since renaming updates segments directly, speakerList may not match. Deduce from segments.
      const seen = new Set<string>();
      for (const s of segments) seen.add(s.speaker);
      for (const s of list) seen.add(s);
      if (currentSpeaker) seen.add(currentSpeaker);
      return Array.from(seen);
    },
    [segments, currentSpeaker],
  );

  const activeSpeakers = resolvedSpeakers(speakerList);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Navegador não suportado</p>
          <p className="text-xs text-muted-foreground">
            A transcrição em tempo real requer Chrome, Edge ou Safari.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="ml-auto">
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-primary/30 bg-card/90 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-foreground/5 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {panelState === "recording" && <AudioWaveform level={audioLevel} active={!isPaused} />}
          {panelState === "paused" && <span className="h-3 w-3 rounded-full bg-accent shrink-0" />}
          {panelState === "idle" && <Mic className="w-4 h-4 text-muted-foreground shrink-0" />}
          {panelState === "processing" && (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          )}

          <span className="text-sm font-medium text-foreground truncate">
            {panelState === "idle" && "Transcritor de Reunião"}
            {panelState === "recording" && "Gravando..."}
            {panelState === "paused" && "Pausado"}
            {panelState === "processing" && "Gerando resumo com IA..."}
          </span>

          {(panelState === "recording" || panelState === "paused") && (
            <span className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-lg shrink-0">
              {formatDuration(duration)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Language selector — only in idle state */}
          {panelState === "idle" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-8 text-xs">
                  <Globe className="w-3.5 h-3.5" />
                  {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label || language}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={language === l.code ? "bg-primary/10 text-primary" : ""}
                  >
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {panelState === "idle" && (
            <>
              <Button size="sm" onClick={handleStart} className="rounded-xl gap-1.5">
                <Mic className="w-4 h-4" /> Começar
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-xl">
                Cancelar
              </Button>
            </>
          )}
          {panelState === "recording" && (
            <>
              <Button variant="outline" size="sm" onClick={pause} className="rounded-xl gap-1.5">
                <Pause className="w-3.5 h-3.5" /> Pausar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
                className="rounded-xl gap-1.5"
              >
                <Square className="w-3.5 h-3.5" /> Parar
              </Button>
            </>
          )}
          {panelState === "paused" && (
            <>
              <Button variant="outline" size="sm" onClick={resume} className="rounded-xl gap-1.5">
                <Play className="w-3.5 h-3.5" /> Retomar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
                className="rounded-xl gap-1.5"
              >
                <Square className="w-3.5 h-3.5" /> Parar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Speaker selector bar */}
      {(panelState === "recording" || panelState === "paused") && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/10 bg-foreground/5 overflow-x-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Falando:</span>
          {activeSpeakers.map((name, i) => (
            <EditableSpeakerButton
              key={name}
              name={name}
              index={i}
              isActive={currentSpeaker === name}
              onSelect={() => changeSpeaker(name)}
              onRename={(newName) => renameSpeaker(name, newName)}
            />
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={addSpeaker}
            className="rounded-xl gap-1 h-7 text-xs px-2 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <UserPlus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>
      )}

      {/* Transcript area */}
      {panelState !== "idle" && (
        <div
          ref={scrollRef}
          className="px-4 py-3 max-h-56 overflow-y-auto text-sm leading-relaxed space-y-1.5"
        >
          {panelState === "processing" ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analisando transcrição e gerando resumo...</span>
            </div>
          ) : (
            <>
              {segments.map((seg, i) => (
                <div key={i} className="flex gap-2 group">
                  <span className="text-[10px] font-mono text-muted-foreground/50 mt-1 shrink-0 w-10 text-right">
                    {formatDuration(seg.timestamp)}
                  </span>
                  <span
                    className={`font-semibold text-xs whitespace-nowrap mt-0.5 shrink-0 ${speakerColor(speakerIndex(seg.speaker))}`}
                  >
                    [{seg.speaker}]
                  </span>
                  <span className="text-foreground/90">{seg.text.trim()}</span>
                </div>
              ))}
              {interimText && (
                <div className="flex gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground/50 mt-1 shrink-0 w-10 text-right">
                    {formatDuration(duration)}
                  </span>
                  <span
                    className={`font-semibold text-xs whitespace-nowrap mt-0.5 shrink-0 ${speakerColor(speakerIndex(currentSpeaker))}`}
                  >
                    [{currentSpeaker}]
                  </span>
                  <span className="text-muted-foreground/60 italic">{interimText}</span>
                </div>
              )}
              {segments.length === 0 && !interimText && (
                <p className="text-muted-foreground/50 text-center py-4">
                  {panelState === "paused" ? "Transcrição pausada..." : "Comece a falar..."}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
