import { useState, useRef, useCallback, useEffect, useMemo } from "react";

function getSpeechRecognitionAPI() {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  /** Elapsed seconds from recording start when this segment began */
  timestamp: number;
}

export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", label: "Português (BR)" },
  { code: "en-US", label: "English (US)" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "de-DE", label: "Deutsch" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "zh-CN", label: "中文" },
] as const;

export function useRealtimeTranscription() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState("Participante 1");
  const [speakerCount, setSpeakerCount] = useState(1);
  const [language, setLanguage] = useState("pt-BR");
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const currentSpeakerRef = useRef("Participante 1");
  const languageRef = useRef("pt-BR");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const restartingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const supported = useMemo(() => !!getSpeechRecognitionAPI(), []);

  useEffect(() => { currentSpeakerRef.current = currentSpeaker; }, [currentSpeaker]);
  useEffect(() => { languageRef.current = language; }, [language]);

  const transcript = useMemo(() => {
    return segments.map(s => `[${s.speaker}] (${formatTs(s.timestamp)}): ${s.text}`).join("\n");
  }, [segments]);

  const getElapsed = useCallback(() => {
    if (!startTimeRef.current) return 0;
    return Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000));
    }, 500);
  }, [stopTimer]);

  // Audio analyser for waveform
  const startAudioAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(avg / 128, 1)); // normalize 0-1
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // microphone denied or unavailable
    }
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setAudioLevel(0);
  }, []);

  const changeSpeaker = useCallback((speaker: string) => {
    setCurrentSpeaker(speaker);
  }, []);

  const addSpeaker = useCallback(() => {
    const next = speakerCount + 1;
    setSpeakerCount(next);
    const name = `Participante ${next}`;
    setCurrentSpeaker(name);
    return name;
  }, [speakerCount]);

  const renameSpeaker = useCallback((oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    setSpeakerNames(prev => ({ ...prev, [oldName]: newName }));
    // Update existing segments
    segmentsRef.current = segmentsRef.current.map(s =>
      s.speaker === oldName ? { ...s, speaker: newName } : s
    );
    setSegments([...segmentsRef.current]);
    if (currentSpeakerRef.current === oldName) {
      setCurrentSpeaker(newName);
    }
  }, []);

  const initRecognition = useCallback(() => {
    const SpeechAPI = getSpeechRecognitionAPI();
    if (!SpeechAPI) return null;

    const recognition = new SpeechAPI();
    recognition.lang = languageRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalText) {
        const speaker = currentSpeakerRef.current;
        const lastSeg = segmentsRef.current[segmentsRef.current.length - 1];
        if (lastSeg && lastSeg.speaker === speaker) {
          lastSeg.text += finalText;
          segmentsRef.current = [...segmentsRef.current];
        } else {
          const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000);
          segmentsRef.current = [...segmentsRef.current, { speaker, text: finalText, timestamp: elapsed }];
        }
        setSegments([...segmentsRef.current]);
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "network") {
        if (restartingRef.current) return;
        restartingRef.current = true;
        setTimeout(() => {
          restartingRef.current = false;
          if (recognitionRef.current && isRecording && !isPaused) {
            try { recognitionRef.current.start(); } catch {}
          }
        }, 300);
        return;
      }
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      if (isRecording && !isPaused && !restartingRef.current) {
        restartingRef.current = true;
        setTimeout(() => {
          restartingRef.current = false;
          try { recognitionRef.current?.start(); } catch {}
        }, 200);
      }
    };

    return recognition;
  }, [isRecording, isPaused]);

  const start = useCallback(() => {
    const recognition = initRecognition();
    if (!recognition) return;

    segmentsRef.current = [];
    setSegments([]);
    setInterimText("");
    setDuration(0);
    setSpeakerCount(1);
    setSpeakerNames({});
    setCurrentSpeaker("Participante 1");
    currentSpeakerRef.current = "Participante 1";
    pausedDurationRef.current = 0;
    startTimeRef.current = Date.now();

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setIsPaused(false);
    startTimer();
    startAudioAnalyser();
  }, [initRecognition, startTimer, startAudioAnalyser]);

  const pause = useCallback(() => {
    if (!recognitionRef.current || !isRecording) return;
    recognitionRef.current.stop();
    setIsPaused(true);
    setInterimText("");
    stopTimer();
    pausedDurationRef.current += Date.now() - startTimeRef.current - pausedDurationRef.current - (duration * 1000);
  }, [isRecording, duration, stopTimer]);

  const resume = useCallback(() => {
    if (!isRecording || !isPaused) return;
    const recognition = initRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.start();
    setIsPaused(false);
    startTimer();
  }, [isRecording, isPaused, initRecognition, startTimer]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    setInterimText("");
    stopTimer();
    stopAudioAnalyser();
    return segmentsRef.current;
  }, [stopTimer, stopAudioAnalyser]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopTimer();
      stopAudioAnalyser();
    };
  }, [stopTimer, stopAudioAnalyser]);

  return {
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
  };
}

function formatTs(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
