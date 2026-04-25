import { useState, useRef, useCallback } from "react";
import { useAudioRecorder } from "@/hooks/audio/useAudioRecorder";
import { useSpeechRecognition } from "@/hooks/audio/useSpeechRecognition";
import { Mic, Square, Pause, Play, Type, Save, X, Volume2, Languages, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatAudioDuration } from "@/lib/noteAudioUtils";
import DeshTooltip from "@/components/ui/DeshTooltip";

interface VoiceRecordingBlockProps {
  onInsertText: (html: string) => void;
  onInsertAudio: (base64: string, durationSec: number) => void;
  onClose: () => void;
}

// Waveform bars component
function WaveformBars({ level, isActive }: { level: number; isActive: boolean }) {
  const bars = 20;
  return (
    <div className="flex items-center gap-[2px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const offset = Math.sin((Date.now() / 150 + i) * 0.8) * 0.3 + 0.5;
        const height = isActive ? Math.max(0.12, level * offset + Math.random() * 0.12) : 0.1;
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-primary transition-all duration-75"
            style={{ height: `${height * 100}%`, opacity: isActive ? 0.5 + level * 0.5 : 0.2 }}
          />
        );
      })}
    </div>
  );
}

export function VoiceRecordingBlock({ onInsertText, onInsertAudio, onClose }: VoiceRecordingBlockProps) {
  const recorder = useAudioRecorder();
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveTranscribing, setLiveTranscribing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const transcriptRef = useRef("");

  const handleTranscript = useCallback((text: string) => {
    transcriptRef.current += (transcriptRef.current ? " " : "") + text;
    setLiveTranscript(transcriptRef.current);
  }, []);

  const { startListening, stopListening, isListening, supported: speechSupported } = useSpeechRecognition(handleTranscript);

  const handleStart = async (withTranscription = false) => {
    transcriptRef.current = "";
    setLiveTranscript("");
    setLiveTranscribing(withTranscription);
    await recorder.startRecording();
    if (withTranscription && speechSupported) {
      startListening();
    }
  };

  const handleStop = () => {
    recorder.stopRecording();
    if (isListening) stopListening();
  };

  const handleTranscribe = () => {
    if (!speechSupported) {
      toast({ title: "Transcrição não suportada", description: "Seu navegador não suporta Web Speech API.", variant: "destructive" });
      return;
    }
    if (transcriptRef.current) {
      onInsertText(`<p>${transcriptRef.current}</p>`);
      toast({ title: "Transcrição inserida" });
      recorder.resetRecording();
      onClose();
      return;
    }
    setTranscribing(true);
    startListening();
    if (recorder.audioUrl) {
      const audio = new Audio(recorder.audioUrl);
      audio.onended = () => {
        stopListening();
        setTimeout(() => {
          if (transcriptRef.current) {
            onInsertText(`<p>${transcriptRef.current}</p>`);
            toast({ title: "Transcrição inserida" });
          } else {
            toast({ title: "Não foi possível transcrever", description: "Tente gravar novamente.", variant: "destructive" });
          }
          setTranscribing(false);
          recorder.resetRecording();
          onClose();
        }, 500);
      };
      audio.play();
    } else {
      setTranscribing(false);
    }
  };

  const handleSaveAudio = () => {
    if (recorder.audioBase64) {
      onInsertAudio(recorder.audioBase64, recorder.duration);
      toast({ title: "Áudio salvo na nota" });
      recorder.resetRecording();
      onClose();
    }
  };

  const handleSaveBoth = () => {
    if (transcriptRef.current) {
      onInsertText(`<p>${transcriptRef.current}</p>`);
    }
    if (recorder.audioBase64) {
      onInsertAudio(recorder.audioBase64, recorder.duration);
    }
    toast({ title: "Áudio e transcrição salvos" });
    recorder.resetRecording();
    onClose();
  };

  const resetAll = () => {
    recorder.resetRecording();
    setLiveTranscript("");
    transcriptRef.current = "";
    setLiveTranscribing(false);
  };

  // Not recording yet — show start options
  if (!recorder.isRecording && !recorder.audioUrl) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/30">
        <Button size="sm" onClick={() => handleStart(false)} className="gap-1.5 rounded-xl">
          <Mic className="w-4 h-4" /> Gravar
        </Button>
        {speechSupported && (
          <Button size="sm" variant="outline" onClick={() => handleStart(true)} className="gap-1.5 rounded-xl">
            <Languages className="w-4 h-4" /> Gravar + Transcrever
          </Button>
        )}
        <span className="text-xs text-muted-foreground hidden sm:inline">Grave um áudio inline na nota</span>
        <DeshTooltip label="Fechar">
          <button onClick={onClose} className="ml-auto p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </DeshTooltip>
      </div>
    );
  }

  // Recording in progress
  if (recorder.isRecording) {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse flex-shrink-0" />
          <WaveformBars level={recorder.audioLevel} isActive={!recorder.isPaused} />
          <span className="text-sm font-mono text-foreground min-w-[48px]">{formatAudioDuration(recorder.duration)}</span>
          {liveTranscribing && (
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <Languages className="w-3 h-3" /> Ao vivo
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {recorder.isPaused ? (
              <Button size="sm" variant="ghost" onClick={recorder.resumeRecording} className="rounded-xl gap-1">
                <Play className="w-4 h-4" /> Retomar
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={recorder.pauseRecording} className="rounded-xl gap-1">
                <Pause className="w-4 h-4" /> Pausar
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={handleStop} className="rounded-xl gap-1">
              <Square className="w-3.5 h-3.5" /> Parar
            </Button>
          </div>
        </div>
        {liveTranscribing && liveTranscript && (
          <div className="px-2 py-1.5 rounded-lg bg-background/50 border border-border/20 max-h-24 overflow-y-auto">
            <p className="text-xs text-foreground/70 leading-relaxed">{liveTranscript}</p>
          </div>
        )}
      </div>
    );
  }

  // Recording finished — show options
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/50 border border-border/30">
      <div className="flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm text-foreground font-medium">Áudio gravado — {formatAudioDuration(recorder.duration)}</span>
        {recorder.audioUrl && (
          <audio src={recorder.audioUrl} controls className="h-8 flex-1 max-w-xs" />
        )}
      </div>
      {liveTranscript && (
        <div className="px-2 py-1.5 rounded-lg bg-background/50 border border-border/20 max-h-32 overflow-y-auto">
          <p className="text-xs text-muted-foreground font-medium mb-0.5">Transcrição:</p>
          <p className="text-xs text-foreground/70 leading-relaxed">{liveTranscript}</p>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {liveTranscript ? (
          <>
            <Button size="sm" variant="outline" onClick={() => { onInsertText(`<p>${liveTranscript}</p>`); recorder.resetRecording(); onClose(); toast({ title: "Transcrição inserida" }); }} className="rounded-xl gap-1.5">
              <Type className="w-4 h-4" /> Inserir texto
            </Button>
            <Button size="sm" variant="outline" onClick={handleSaveBoth} className="rounded-xl gap-1.5">
              <Save className="w-4 h-4" /> Salvar ambos
            </Button>
          </>
        ) : (
          speechSupported && (
            <Button size="sm" variant="outline" onClick={handleTranscribe} disabled={transcribing} className="rounded-xl gap-1.5">
              <Type className="w-4 h-4" /> {transcribing ? "Transcrevendo..." : "Transcrever"}
            </Button>
          )
        )}
        <Button size="sm" onClick={handleSaveAudio} className="rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
          <Save className="w-4 h-4" /> Salvar áudio
        </Button>
        <DeshTooltip label="Regravar">
          <Button size="sm" variant="ghost" onClick={resetAll} className="rounded-xl gap-1.5">
            <Mic className="w-4 h-4" /> Regravar
          </Button>
        </DeshTooltip>
        <DeshTooltip label="Fechar">
          <button onClick={onClose} className="ml-auto p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </DeshTooltip>
      </div>
    </div>
  );
}

// Mini player for saved audio blocks rendered below the editor
export function AudioMiniPlayer({ src, duration, onDelete }: { src: string; duration?: number; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 border border-border/30 group">
      <Volume2 className="w-4 h-4 text-primary flex-shrink-0" />
      <audio src={src} controls className="h-8 flex-1 max-w-sm" />
      {duration != null && duration > 0 && (
        <span className="text-xs text-muted-foreground font-mono">{formatAudioDuration(duration)}</span>
      )}
      {onDelete && (
        <DeshTooltip label="Remover áudio">
          <button
            onClick={onDelete}
            className="p-1 rounded-lg text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </DeshTooltip>
      )}
    </div>
  );
}
