import { useState, useCallback, useRef, useEffect } from "react";

export function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => {
    try { return localStorage.getItem("dashfy-tts-voice"); } catch { return null; }
  });
  const [rate, setRateState] = useState(1);
  const [pitch, setPitchState] = useState(1);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const savedRate = localStorage.getItem("dashfy-tts-rate");
      if (savedRate) setRateState(parseFloat(savedRate) || 1);
      const savedPitch = localStorage.getItem("dashfy-tts-pitch");
      if (savedPitch) setPitchState(parseFloat(savedPitch) || 1);
    } catch {}
  }, []);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported = typeof speechSynthesis !== "undefined";

  // Load available voices
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const all = speechSynthesis.getVoices();
      setVoices(all);
      // If no voice selected yet, pick a pt-BR default
      if (!selectedVoiceURI) {
        const br = all.find((v) => v.lang === "pt-BR") || all.find((v) => v.lang.startsWith("pt"));
        if (br) {
          setSelectedVoiceURI(br.voiceURI);
          try { localStorage.setItem("dashfy-tts-voice", br.voiceURI); } catch {}
        }
      }
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const setVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try { localStorage.setItem("dashfy-tts-voice", voiceURI); } catch {}
  }, []);

  const setRate = useCallback((v: number) => {
    setRateState(v);
    try { localStorage.setItem("dashfy-tts-rate", String(v)); } catch {}
  }, []);

  const setPitch = useCallback((v: number) => {
    setPitchState(v);
    try { localStorage.setItem("dashfy-tts-pitch", String(v)); } catch {}
  }, []);

  const getSelectedVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!selectedVoiceURI) return null;
    return voices.find((v) => v.voiceURI === selectedVoiceURI) || null;
  }, [voices, selectedVoiceURI]);

  const speak = useCallback((text: string, id: number) => {
    if (!supported) return;

    if (speakingId === id) {
      speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    speechSynthesis.cancel();

    const clean = text
      .replace(/[*_~`#>\[\]()!]/g, "")
      .replace(/\n+/g, ". ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "pt-BR";
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    utteranceRef.current = utterance;
    setSpeakingId(id);
    speechSynthesis.speak(utterance);
  }, [speakingId, supported, getSelectedVoice]);

  const preview = useCallback((voiceURI: string) => {
    if (!supported) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Olá, esta é uma amostra da minha voz.");
    utterance.lang = "pt-BR";
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    speechSynthesis.speak(utterance);
  }, [supported, voices, rate, pitch]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  return { speakingId, speak, stop, supported, voices, selectedVoiceURI, setVoice, preview, rate, setRate, pitch, setPitch };
}
