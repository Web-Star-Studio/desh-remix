import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

import wallpaperBeach from "@/assets/wallpaper-beach.jpg";
import wallpaperMountain from "@/assets/wallpaper-mountain.jpg";
import wallpaperForest from "@/assets/wallpaper-forest.jpg";
import wallpaperDesert from "@/assets/wallpaper-desert.jpg";
import wallpaperCityNight from "@/assets/wallpaper-city-night.jpg";
import wallpaperAurora from "@/assets/wallpaper-aurora.jpg";
import wallpaperLavender from "@/assets/wallpaper-lavender.jpg";
import dashboardBg from "@/assets/dashboard-bg.jpg";

export type WelcomeTheme = {
  accent: string;
  accentSecondary: string;
  bg: string;
  text: string;
};

export type WelcomeWallpaper = {
  id: string;
  label: string;
  src: string;
};

export type WelcomeGradient = {
  id: string;
  label: string;
  gradient: string;
};

export const WELCOME_WALLPAPERS: WelcomeWallpaper[] = [
  { id: "hills", label: "Colinas", src: dashboardBg },
  { id: "beach", label: "Praia", src: wallpaperBeach },
  { id: "mountain", label: "Montanha", src: wallpaperMountain },
  { id: "forest", label: "Floresta", src: wallpaperForest },
  { id: "desert", label: "Deserto", src: wallpaperDesert },
  { id: "city-night", label: "Cidade", src: wallpaperCityNight },
  { id: "aurora", label: "Aurora", src: wallpaperAurora },
  { id: "lavender", label: "Lavanda", src: wallpaperLavender },
];

export const WELCOME_GRADIENTS: WelcomeGradient[] = [
  { id: "abstract-blue", label: "Oceano", gradient: "linear-gradient(135deg, #0c2340, #2e86c1, #85c1e9)" },
  { id: "abstract-purple", label: "Cósmico", gradient: "linear-gradient(135deg, #2c003e, #8e44ad, #d2b4de)" },
  { id: "abstract-sunset", label: "Pôr do Sol", gradient: "linear-gradient(135deg, #4a1942, #e65100, #ffb300)" },
  { id: "abstract-green", label: "Esmeralda", gradient: "linear-gradient(135deg, #0b3d2e, #27ae60, #a9dfbf)" },
];

const THEMES: WelcomeTheme[] = [
  { accent: "#8B6914", accentSecondary: "#C8956C", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#4D5566", accentSecondary: "#6B7280", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#9333EA", accentSecondary: "#A855F7", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#3B82F6", accentSecondary: "#60A5FA", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#22A55B", accentSecondary: "#4ADE80", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#EF4444", accentSecondary: "#F87171", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#F97316", accentSecondary: "#FB923C", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#EAB308", accentSecondary: "#FACC15", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#EC4899", accentSecondary: "#F472B6", bg: "#0A0A0F", text: "#F5F5F7" },
  { accent: "#C084FC", accentSecondary: "#D8B4FE", bg: "#0A0A0F", text: "#F5F5F7" },
];

type WelcomeBackgroundMode = "wallpaper" | "gradient";

type WelcomeThemeContextType = {
  theme: WelcomeTheme;
  themeIndex: number;
  setThemeIndex: (i: number) => void;
  themes: WelcomeTheme[];
  // Background state
  bgMode: WelcomeBackgroundMode;
  setBgMode: (mode: WelcomeBackgroundMode) => void;
  wallpaperIndex: number;
  setWallpaperIndex: (i: number) => void;
  gradientIndex: number;
  setGradientIndex: (i: number) => void;
  activeWallpaper: WelcomeWallpaper | null;
  activeGradient: WelcomeGradient | null;
};

const STORAGE_KEY = "desh-welcome-prefs";

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function savePrefs(prefs: { themeIndex: number; bgMode: WelcomeBackgroundMode; wallpaperIndex: number; gradientIndex: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

const WelcomeThemeContext = createContext<WelcomeThemeContextType>({
  theme: THEMES[3],
  themeIndex: 3,
  setThemeIndex: () => {},
  themes: THEMES,
  bgMode: "gradient",
  setBgMode: () => {},
  wallpaperIndex: 0,
  setWallpaperIndex: () => {},
  gradientIndex: 0,
  setGradientIndex: () => {},
  activeWallpaper: null,
  activeGradient: WELCOME_GRADIENTS[0],
});

export function WelcomeThemeProvider({ children }: { children: ReactNode }) {
  const saved = loadPrefs();
  // Default: gradient mode, abstract-blue (index 0), blue theme (index 3)
  const [themeIndex, setThemeIndex] = useState(saved?.themeIndex ?? 3);
  const [bgMode, setBgMode] = useState<WelcomeBackgroundMode>(saved?.bgMode ?? "gradient");
  const [wallpaperIndex, setWallpaperIndex] = useState(saved?.wallpaperIndex ?? 0);
  const [gradientIndex, setGradientIndex] = useState(saved?.gradientIndex ?? 0);

  // Persist on change
  useEffect(() => {
    savePrefs({ themeIndex, bgMode, wallpaperIndex, gradientIndex });
  }, [themeIndex, bgMode, wallpaperIndex, gradientIndex]);

  const theme = THEMES[themeIndex];
  const activeWallpaper = bgMode === "wallpaper" ? WELCOME_WALLPAPERS[wallpaperIndex] : null;
  const activeGradient = bgMode === "gradient" ? WELCOME_GRADIENTS[gradientIndex] : null;

  const handleSetTheme = useCallback((i: number) => setThemeIndex(i), []);
  const handleSetBgMode = useCallback((mode: WelcomeBackgroundMode) => setBgMode(mode), []);
  const handleSetWallpaper = useCallback((i: number) => setWallpaperIndex(i), []);
  const handleSetGradient = useCallback((i: number) => setGradientIndex(i), []);

  return (
    <WelcomeThemeContext.Provider value={{
      theme, themeIndex, setThemeIndex: handleSetTheme, themes: THEMES,
      bgMode, setBgMode: handleSetBgMode,
      wallpaperIndex, setWallpaperIndex: handleSetWallpaper,
      gradientIndex, setGradientIndex: handleSetGradient,
      activeWallpaper, activeGradient,
    }}>
      {children}
    </WelcomeThemeContext.Provider>
  );
}

export const useWelcomeTheme = () => useContext(WelcomeThemeContext);
