import { useState, useCallback, useRef, useEffect } from "react";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

function getToken(): string {
  return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

export interface ElevenLabsVoice {
  id: string;
  name: string;
  label: string;
  gender: "masculino" | "feminino";
}

export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", label: "Sarah", gender: "feminino" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", label: "Laura", gender: "feminino" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", label: "Lily", gender: "feminino" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", label: "Jessica", gender: "feminino" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", label: "Alice", gender: "feminino" },
];

const VOICE_KEY = "desh-elevenlabs-voice";
const SPEED_KEY = "desh-elevenlabs-speed";
const AUTOSPEAK_KEY = "desh-elevenlabs-autospeak";
const AUTOREPLY_KEY = "desh-elevenlabs-autoreplyvoice";

function getSaved<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function setSaved(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useElevenLabsTTS() {
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceIdState] = useState<string>(() => getSaved(VOICE_KEY, ELEVENLABS_VOICES[0].id));
  const [speed, setSpeedState] = useState<number>(() => getSaved(SPEED_KEY, 1.0));
  const [autoSpeak, setAutoSpeakState] = useState<boolean>(() => getSaved(AUTOSPEAK_KEY, false));
  const [autoReplyVoice, setAutoReplyVoiceState] = useState<boolean>(() => getSaved(AUTOREPLY_KEY, true));
  const [progress, setProgress] = useState(0); // 0-100
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const cacheOrderRef = useRef<string[]>([]);
  const progressRafRef = useRef<number | null>(null);
  const MAX_CACHE = 20;

  const setSelectedVoiceId = useCallback((voiceId: string) => {
    setSelectedVoiceIdState(voiceId);
    setSaved(VOICE_KEY, voiceId);
  }, []);

  const setSpeed = useCallback((s: number) => {
    const clamped = Math.max(0.7, Math.min(1.2, Math.round(s * 100) / 100));
    setSpeedState(clamped);
    setSaved(SPEED_KEY, clamped);
  }, []);

  const setAutoSpeak = useCallback((v: boolean) => {
    setAutoSpeakState(v);
    setSaved(AUTOSPEAK_KEY, v);
  }, []);

  const setAutoReplyVoice = useCallback((v: boolean) => {
    setAutoReplyVoiceState(v);
    setSaved(AUTOREPLY_KEY, v);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressRafRef.current) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
    setProgress(0);
  }, []);

  const trackProgress = useCallback((audio: HTMLAudioElement) => {
    const update = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(Math.round((audio.currentTime / audio.duration) * 100));
      }
      if (!audio.paused && !audio.ended) {
        progressRafRef.current = requestAnimationFrame(update);
      }
    };
    progressRafRef.current = requestAnimationFrame(update);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setSpeakingId(null);
    stopProgress();
  }, [stopProgress]);

  const addToCache = useCallback((key: string, url: string) => {
    // Evict oldest if at capacity
    while (cacheRef.current.size >= MAX_CACHE && cacheOrderRef.current.length > 0) {
      const oldest = cacheOrderRef.current.shift()!;
      const oldUrl = cacheRef.current.get(oldest);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      cacheRef.current.delete(oldest);
    }
    cacheRef.current.set(key, url);
    cacheOrderRef.current.push(key);
  }, []);

  const fetchAudio = useCallback(async (text: string, voiceId: string, spd: number): Promise<string> => {
    // Truncate text to 5000 chars to avoid API failures
    const safeText = text.length > 5000 ? text.slice(0, 5000) : text;

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || getToken();

    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: getToken(),
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: safeText, voiceId, speed: spd }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `TTS failed: ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }, []);

  const speak = useCallback(async (text: string, messageId: number) => {
    if (speakingId === messageId) { stop(); return; }
    stop();

    const voiceId = getSaved<string>(VOICE_KEY, ELEVENLABS_VOICES[0].id);
    const spd = getSaved<number>(SPEED_KEY, 1.0);
    const cacheKey = `${voiceId}:${spd}:${messageId}:${text.slice(0, 100)}`;

    let audioUrl = cacheRef.current.get(cacheKey);

    if (!audioUrl) {
      setIsLoading(true);
      try {
        audioUrl = await fetchAudio(text, voiceId, spd);
        addToCache(cacheKey, audioUrl);
      } catch (error: any) {
        console.error("ElevenLabs TTS error:", error);
        const { toast } = await import("sonner");
        toast.error(error.message || "Erro ao gerar áudio");
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setSpeakingId(messageId);

    audio.onended = () => { setSpeakingId(null); audioRef.current = null; stopProgress(); };
    audio.onerror = () => { setSpeakingId(null); audioRef.current = null; stopProgress(); };

    audio.play().then(() => trackProgress(audio)).catch(() => {
      setSpeakingId(null);
      audioRef.current = null;
    });
  }, [speakingId, stop, fetchAudio, addToCache, trackProgress, stopProgress]);

  const preview = useCallback(async (voiceId: string) => {
    stop();
    const previewText = "Olá, esta é uma amostra da minha voz. Posso ajudá-lo com qualquer coisa.";
    const spd = getSaved<number>(SPEED_KEY, 1.0);
    const cacheKey = `preview:${voiceId}:${spd}`;

    let audioUrl = cacheRef.current.get(cacheKey);

    if (!audioUrl) {
      setIsLoading(true);
      try {
        audioUrl = await fetchAudio(previewText, voiceId, spd);
        addToCache(cacheKey, audioUrl);
      } catch (error: any) {
        console.error("Preview error:", error);
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
      }
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; };
    audio.play().catch(() => {});
  }, [stop, fetchAudio, addToCache]);

  // Stop audio when component unmounts (user leaves page or closes chat)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (progressRafRef.current) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };
  }, []);

  return {
    speak,
    stop,
    speakingId,
    isLoading,
    progress,
    voices: ELEVENLABS_VOICES,
    selectedVoiceId,
    setSelectedVoiceId,
    speed,
    setSpeed,
    autoSpeak,
    setAutoSpeak,
    autoReplyVoice,
    setAutoReplyVoice,
    preview,
  };
}
