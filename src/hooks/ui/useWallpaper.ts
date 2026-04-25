import wallpaperBeach from "@/assets/wallpaper-beach.jpg";
import wallpaperMountain from "@/assets/wallpaper-mountain.jpg";
import wallpaperForest from "@/assets/wallpaper-forest.jpg";
import wallpaperDesert from "@/assets/wallpaper-desert.jpg";
import wallpaperCityNight from "@/assets/wallpaper-city-night.jpg";
import wallpaperAurora from "@/assets/wallpaper-aurora.jpg";
import wallpaperLavender from "@/assets/wallpaper-lavender.jpg";
import dashboardBg from "@/assets/dashboard-bg.jpg";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { useAuth } from "@/contexts/AuthContext";

export type WallpaperId =
  | "hills" | "beach" | "mountain" | "forest" | "desert" | "city-night" | "aurora" | "lavender"
  | "abstract-blue" | "abstract-purple" | "abstract-orange" | "abstract-green"
  | "abstract-pink" | "abstract-dark" | "abstract-sunset" | "abstract-mint"
  | "anim-aurora" | "anim-ocean" | "anim-lava" | "anim-nebula" | "anim-rainbow" | "anim-twilight";

export type WallpaperCategory = "paisagem" | "abstrato" | "animado";

export interface WallpaperOption {
  id: WallpaperId;
  label: string;
  src?: string;
  gradient?: string;
  animation?: { backgroundSize: string; animation: string };
  category: WallpaperCategory;
}

export const wallpaperOptions: WallpaperOption[] = [
  // Paisagens
  { id: "hills", label: "Colinas", src: dashboardBg, category: "paisagem" },
  { id: "beach", label: "Praia", src: wallpaperBeach, category: "paisagem" },
  { id: "mountain", label: "Montanha", src: wallpaperMountain, category: "paisagem" },
  { id: "forest", label: "Floresta", src: wallpaperForest, category: "paisagem" },
  { id: "desert", label: "Deserto", src: wallpaperDesert, category: "paisagem" },
  { id: "city-night", label: "Cidade", src: wallpaperCityNight, category: "paisagem" },
  { id: "aurora", label: "Aurora Boreal", src: wallpaperAurora, category: "paisagem" },
  { id: "lavender", label: "Lavanda", src: wallpaperLavender, category: "paisagem" },
  // Abstratos
  { id: "abstract-blue", label: "Azul Oceano", gradient: "linear-gradient(135deg, #0c2340 0%, #1a5276 25%, #2e86c1 50%, #5dade2 75%, #85c1e9 100%)", category: "abstrato" },
  { id: "abstract-purple", label: "Roxo Cósmico", gradient: "linear-gradient(135deg, #2c003e 0%, #5b2c6f 25%, #8e44ad 50%, #a569bd 75%, #d2b4de 100%)", category: "abstrato" },
  { id: "abstract-orange", label: "Laranja Solar", gradient: "linear-gradient(135deg, #784212 0%, #b9770e 25%, #f39c12 50%, #f5b041 75%, #fad7a0 100%)", category: "abstrato" },
  { id: "abstract-green", label: "Verde Esmeralda", gradient: "linear-gradient(135deg, #0b3d2e 0%, #1a7a5a 25%, #27ae60 50%, #52d68c 75%, #a9dfbf 100%)", category: "abstrato" },
  { id: "abstract-pink", label: "Rosa Quartzo", gradient: "linear-gradient(135deg, #6c1d45 0%, #a93574 25%, #d4558e 50%, #e8a0bf 75%, #f5d5e0 100%)", category: "abstrato" },
  { id: "abstract-dark", label: "Grafite Noturno", gradient: "linear-gradient(135deg, #0d0d1a 0%, #1a1a3e 25%, #2c2c54 50%, #3d3d6b 75%, #515180 100%)", category: "abstrato" },
  { id: "abstract-sunset", label: "Pôr do Sol", gradient: "linear-gradient(135deg, #4a1942 0%, #c2185b 20%, #e65100 40%, #f57c00 60%, #ffb300 80%, #fff176 100%)", category: "abstrato" },
  { id: "abstract-mint", label: "Menta Fresca", gradient: "linear-gradient(135deg, #0d4f4f 0%, #16a085 25%, #1abc9c 50%, #76d7c4 75%, #d1f2eb 100%)", category: "abstrato" },
  // Animados
  { id: "anim-aurora", label: "Aurora Viva", gradient: "linear-gradient(135deg, #0f2027, #2c5364, #1b4332, #2d6a4f, #40916c, #2c5364, #0f2027)", animation: { backgroundSize: "400% 400%", animation: "wp-drift 12s ease infinite" }, category: "animado" },
  { id: "anim-ocean", label: "Oceano Profundo", gradient: "linear-gradient(135deg, #0a1628, #1a3a5c, #1e6091, #2980b9, #1a5276, #0e3d5c, #0a1628)", animation: { backgroundSize: "400% 400%", animation: "wp-drift 15s ease infinite" }, category: "animado" },
  { id: "anim-lava", label: "Lava", gradient: "linear-gradient(135deg, #1a0000, #4a0e0e, #8b1a1a, #c0392b, #e74c3c, #8b1a1a, #4a0e0e, #1a0000)", animation: { backgroundSize: "400% 400%", animation: "wp-drift 10s ease infinite" }, category: "animado" },
  { id: "anim-nebula", label: "Nebulosa", gradient: "linear-gradient(135deg, #0d0221, #261447, #4a1a6b, #6c3483, #a569bd, #7d3c98, #4a1a6b, #0d0221)", animation: { backgroundSize: "400% 400%", animation: "wp-rotate 20s ease infinite" }, category: "animado" },
  { id: "anim-rainbow", label: "Arco-Íris", gradient: "linear-gradient(135deg, #c0392b, #e67e22, #f1c40f, #27ae60, #2980b9, #8e44ad, #c0392b)", animation: { backgroundSize: "400% 400%", animation: "wp-drift 18s ease infinite" }, category: "animado" },
  { id: "anim-twilight", label: "Crepúsculo", gradient: "linear-gradient(135deg, #0c0c1d, #1a1a4e, #2d2b55, #4834d4, #686de0, #be2edd, #4834d4, #0c0c1d)", animation: { backgroundSize: "400% 400%", animation: "wp-drift 14s ease infinite" }, category: "animado" },
];

const STORAGE_KEY = "dashfy-wallpaper";
const BRIGHTNESS_KEY = "dashfy-wallpaper-brightness";
const BLUR_KEY = "dashfy-wallpaper-blur";

interface WallpaperDbState {
  wallpaperId: WallpaperId;
  brightness: number;
  blur: number;
}

export function useWallpaper() {
  const { user } = useAuth();
  const [wallpaperId, setWallpaperIdState] = useState<WallpaperId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && wallpaperOptions.some(w => w.id === saved)) return saved as WallpaperId;
    } catch {}
    return "hills";
  });

  const [brightness, setBrightnessState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BRIGHTNESS_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 0 && val <= 200) return val;
      }
    } catch {}
    return 100;
  });

  const [blur, setBlurState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(BLUR_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (val >= 0 && val <= 40) return val;
      }
    } catch {}
    return 0;
  });

  // Sync wallpaper settings to DB
  const { data: dbWallpaper, save: saveWallpaperToDb } = usePersistedWidget<WallpaperDbState>({
    key: "wallpaper",
    defaultValue: { wallpaperId: "hills", brightness: 100, blur: 0 },
    debounceMs: 500,
  });

  const hasAppliedDb = useRef(false);
  // Reset ref when user changes so DB wallpaper is re-applied
  useEffect(() => { hasAppliedDb.current = false; }, [user?.id]);

  useEffect(() => {
    if (!hasAppliedDb.current && dbWallpaper && dbWallpaper.wallpaperId && wallpaperOptions.some(w => w.id === dbWallpaper.wallpaperId)) {
      hasAppliedDb.current = true;
      setWallpaperIdState(dbWallpaper.wallpaperId);
      setBrightnessState(dbWallpaper.brightness ?? 100);
      setBlurState(dbWallpaper.blur ?? 0);
    }
  }, [dbWallpaper]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, wallpaperId); }, [wallpaperId]);
  useEffect(() => { localStorage.setItem(BRIGHTNESS_KEY, String(brightness)); }, [brightness]);
  useEffect(() => { localStorage.setItem(BLUR_KEY, String(blur)); }, [blur]);

  const setWallpaper = useCallback((id: WallpaperId) => {
    setWallpaperIdState(id);
    saveWallpaperToDb({ wallpaperId: id, brightness, blur });
  }, [brightness, blur, saveWallpaperToDb]);

  const setBrightness = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(200, value));
    setBrightnessState(clamped);
    saveWallpaperToDb({ wallpaperId, brightness: clamped, blur });
  }, [wallpaperId, blur, saveWallpaperToDb]);

  const setBlur = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(40, value));
    setBlurState(clamped);
    saveWallpaperToDb({ wallpaperId, brightness, blur: clamped });
  }, [wallpaperId, brightness, saveWallpaperToDb]);

  const currentWallpaper = wallpaperOptions.find(w => w.id === wallpaperId) || wallpaperOptions[0];

  const wallpaperBgStyle = useMemo<React.CSSProperties>(() => {
    const overlay = brightness < 100
      ? `rgba(0,0,0,${(100 - brightness) / 100})`
      : brightness > 100
        ? `rgba(255,255,255,${(brightness - 100) / 100})`
        : null;

    const base: React.CSSProperties = {};

    if (currentWallpaper.gradient) {
      base.background = overlay
        ? `linear-gradient(${overlay}, ${overlay}), ${currentWallpaper.gradient}`
        : currentWallpaper.gradient;
    } else {
      base.backgroundImage = overlay
        ? `linear-gradient(${overlay}, ${overlay}), url(${currentWallpaper.src})`
        : `url(${currentWallpaper.src})`;
    }

    if (currentWallpaper.animation) {
      base.backgroundSize = currentWallpaper.animation.backgroundSize;
      base.animation = currentWallpaper.animation.animation;
    }

    if (blur > 0) {
      base.filter = `blur(${blur}px)`;
      base.transform = "scale(1.05)";
    }

    return base;
  }, [currentWallpaper, brightness, blur]);

  return {
    wallpaperId,
    wallpaperSrc: currentWallpaper.src || "",
    wallpaperStyle: {} as React.CSSProperties,
    wallpaperBgStyle,
    setWallpaper,
    brightness, setBrightness,
    blur, setBlur,
  };
}
