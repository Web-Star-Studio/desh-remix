import { useState, useRef, useCallback, memo } from "react";
import { Mic, Send, X } from "lucide-react";

interface AudioRecorderProps {
  onSend: (base64: string, mimetype: string) => void;
  onCancel: () => void;
}

export const AudioRecorder = memo(function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    } catch {
      onCancel();
    }
  }, [onCancel]);

  const stopAndSend = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        onSend(base64, "audio/webm");
      };
      reader.readAsDataURL(blob);
      mr.stream.getTracks().forEach(t => t.stop());
    };
    mr.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, [onSend]);

  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = () => { mr.stream.getTracks().forEach(t => t.stop()); };
      mr.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    onCancel();
  }, [onCancel]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // Idle state: just a mic button
  if (!recording) {
    return (
      <button onClick={startRecording} className="p-2 rounded-full hover:bg-foreground/10 text-muted-foreground" title="Gravar áudio">
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  // Recording state
  return (
    <div className="flex items-center gap-2 p-2 bg-destructive/5 rounded-lg border border-destructive/10">
      <button onClick={cancel} className="p-1.5 rounded-full hover:bg-foreground/10 text-destructive">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm font-mono text-foreground">{formatTime(elapsed)}</span>
        <span className="text-xs text-muted-foreground">Gravando...</span>
      </div>
      <button onClick={stopAndSend} className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
});
