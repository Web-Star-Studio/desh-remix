// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BRIEFING_CACHE_KEY = "desh-morning-briefing";
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const BRIEFING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widgets-proxy`;

interface BriefingCache {
  date: string;
  text: string;
  audioUrl?: string;
  playedAt?: number;
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getCache(): BriefingCache | null {
  try {
    const raw = localStorage.getItem(BRIEFING_CACHE_KEY);
    if (!raw) return null;
    const c: BriefingCache = JSON.parse(raw);
    if (c.date !== getTodayKey()) return null;
    return c;
  } catch { return null; }
}

function saveCache(c: BriefingCache) {
  try { localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(c)); } catch {}
}

function isMorning(): boolean {
  const h = new Date().getHours();
  return h >= 6 && h < 12;
}

export function useMorningBriefing() {
  const [status, setStatus] = useState<"idle" | "generating" | "playing" | "done">("idle");
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Check if briefing is available (morning + not played today)
  const cache = getCache();
  const alreadyPlayed = cache?.playedAt ? true : false;
  const shouldOffer = isMorning() && !alreadyPlayed;

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
    stopProgress();
    if (status === "playing") setStatus("done");
  }, [status, stopProgress]);

  const generateAndPlay = useCallback(async () => {
    if (status === "playing") { stop(); return; }

    setStatus("generating");
    setBriefingText(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Gather frontend context (weather, habits)
      const frontendContext: Record<string, any> = {};
      try {
        const weatherRaw = localStorage.getItem("dashfy-weather-cache");
        if (weatherRaw) {
          const w = JSON.parse(weatherRaw);
          if (w.temperature != null) {
            frontendContext.weather = {
              temp: w.temperature,
              condition: w.condition,
              city: w.city,
            };
          }
        }
      } catch {}

      try {
        const habitsRaw = localStorage.getItem("dashfy-habits");
        if (habitsRaw) {
          const h = JSON.parse(habitsRaw);
          const today = new Date().toDateString();
          if (h.date === today && h.habits) {
            frontendContext.habitsCompleted = h.habits.filter((x: any) => x.completedToday).length;
            frontendContext.habitsTotal = h.habits.length;
          }
        }
      } catch {}

      // Step 1: Generate briefing text
      let text = cache?.text;
      if (!text) {
        const briefingRes = await fetch(BRIEFING_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "morning-briefing", context: frontendContext }),
        });

        if (!briefingRes.ok) {
          const err = await briefingRes.json().catch(() => ({}));
          throw new Error(err.error || `Briefing failed: ${briefingRes.status}`);
        }

        const briefingData = await briefingRes.json();
        text = briefingData.briefing;
        if (!text) throw new Error("Empty briefing");
        saveCache({ date: getTodayKey(), text });
      }

      setBriefingText(text);

      // Step 2: Convert to audio via ElevenLabs TTS
      const voiceKey = "desh-elevenlabs-voice";
      const voiceId = (() => {
        try {
          const v = localStorage.getItem(voiceKey);
          return v ? JSON.parse(v) : "EXAVITQu4vr4xnSDxMaL";
        } catch { return "EXAVITQu4vr4xnSDxMaL"; }
      })();

      const ttsRes = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, voiceId, speed: 1.0 }),
      });

      if (!ttsRes.ok) {
        const err = await ttsRes.json().catch(() => ({}));
        throw new Error(err.error || `TTS failed: ${ttsRes.status}`);
      }

      const blob = await ttsRes.blob();
      const audioUrl = URL.createObjectURL(blob);
      blobUrlRef.current = audioUrl;

      // Play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setStatus("playing");

      audio.onended = () => {
        setStatus("done");
        stopProgress();
        saveCache({ date: getTodayKey(), text: text!, playedAt: Date.now() });
      };
      audio.onerror = () => {
        setStatus("done");
        stopProgress();
      };

      await audio.play();
      trackProgress(audio);
    } catch (error: any) {
      console.error("Morning briefing error:", error);
      setStatus("idle");
      const { toast } = await import("sonner");
      toast.error(error.message || "Erro ao gerar briefing matinal");
    }
  }, [status, stop, cache, stopProgress, trackProgress]);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return {
    status,
    briefingText,
    progress,
    shouldOffer,
    generateAndPlay,
    stop,
  };
}
