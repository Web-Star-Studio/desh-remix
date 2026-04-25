import { useCallback, useEffect, useRef, useState } from "react";

export type SoundType =
  | "calendar"
  | "email"
  | "task"
  | "habit"
  | "notification"
  | "warning"
  | "broadcast"
  | "message";

const STORAGE_KEY = "dashfy-sound-prefs";

function getPrefs(): { muted: boolean; volume: number } {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { muted: true, volume: 0.15 };
}

function savePrefs(p: { muted: boolean; volume: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// ── Note frequencies ──
const C4 = 261.63, C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880;

// ── Shared audio context (lazy) ──
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Sound generators ──

function playNote(ctx: AudioContext, freq: number, startTime: number, duration: number, vol: number, type: OscillatorType = "sine") {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}


function calendarSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Gentle ding-dong: E5 then C5
  playNote(ctx, E5, t, 0.4, vol);
  playNote(ctx, C5, t + 0.2, 0.5, vol);
}

function emailSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Crystal drop: A5 with pitch bend down
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(A5, t);
  osc.frequency.exponentialRampToValueAtTime(A5 * 0.6, t + 0.5);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  // Subtle "reverb" via delayed echo
  const delay = ctx.createDelay();
  const delayGain = ctx.createGain();
  delay.delayTime.value = 0.12;
  delayGain.gain.value = 0.3;
  osc.connect(gain).connect(ctx.destination);
  gain.connect(delay).connect(delayGain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.7);
}

function taskSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Positive chord: C5 + E5 simultaneous
  playNote(ctx, C5, t, 0.35, vol * 0.8);
  playNote(ctx, E5, t, 0.35, vol * 0.8);
  playNote(ctx, G5, t + 0.12, 0.3, vol * 0.6);
}

function habitSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Level-up sweep: C4 → C5 ramp
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(C4, t);
  osc.frequency.exponentialRampToValueAtTime(C5, t + 0.3);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.55);
}

function notificationSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Soft ping: G5 very short
  playNote(ctx, G5, t, 0.2, vol);
}

function warningSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Two descending tones: E5 → C5
  playNote(ctx, E5, t, 0.35, vol * 0.7);
  playNote(ctx, C5, t + 0.25, 0.45, vol * 0.7);
}

function broadcastSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Announcement fanfare: G5 → A5 → C5 ascending with triangle wave
  playNote(ctx, G5, t, 0.25, vol * 0.6, "triangle");
  playNote(ctx, A5, t + 0.12, 0.25, vol * 0.7, "triangle");
  playNote(ctx, C5 * 2, t + 0.24, 0.5, vol * 0.8, "triangle");
}

function messageSound(vol: number) {
  const ctx = getCtx();
  const t = ctx.currentTime;
  // Bubble pop: two quick ascending notes with soft attack
  playNote(ctx, 587.33, t, 0.15, vol * 0.7); // D5
  playNote(ctx, 783.99, t + 0.08, 0.25, vol * 0.8); // G5
}

const SOUND_MAP: Record<SoundType, (vol: number) => void> = {
  
  calendar: calendarSound,
  email: emailSound,
  task: taskSound,
  habit: habitSound,
  notification: notificationSound,
  warning: warningSound,
  broadcast: broadcastSound,
  message: messageSound,
};

// ── Hook ──

export function useSoundAlerts() {
  const [muted, setMuted] = useState(() => getPrefs().muted);
  const [volume, setVolume] = useState(() => getPrefs().volume);
  const prefsRef = useRef({ muted, volume });

  useEffect(() => {
    prefsRef.current = { muted, volume };
    savePrefs({ muted, volume });
  }, [muted, volume]);

  const playSound = useCallback((type: SoundType) => {
    const { muted: m, volume: v } = prefsRef.current;
    if (m) return;
    try {
      SOUND_MAP[type](v);
    } catch {}
  }, []);

  const toggleMute = useCallback(() => setMuted(m => !m), []);

  return { playSound, muted, toggleMute, volume, setVolume };
}
