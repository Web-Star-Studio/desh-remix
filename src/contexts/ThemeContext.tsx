import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ThemeConfig, ThemeMode, ThemeColor } from "@/hooks/ui/useTheme";
import { useWallpaper, type WallpaperId } from "@/hooks/ui/useWallpaper";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { useAuth } from "@/contexts/AuthContext";

interface ThemeContextValue {
  theme: ThemeConfig;
  setMode: (mode: ThemeMode) => void;
  setColor: (color: ThemeColor) => void;
  toggleMode: () => void;
  wallpaperId: WallpaperId;
  wallpaperSrc: string;
  wallpaperStyle: React.CSSProperties;
  setWallpaper: (id: WallpaperId) => void;
  wallpaperBrightness: number;
  setWallpaperBrightness: (value: number) => void;
  wallpaperBlur: number;
  setWallpaperBlur: (value: number) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "dashfy-theme";
const VALID_COLORS = ["brown","black","graphite","light-gray","purple","blue","green","red","orange","yellow","pink","lilac"];

function getInitialTheme(): ThemeConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.color === "amber") parsed.color = "brown";
      if (VALID_COLORS.includes(parsed.color)) {
        return { mode: parsed.mode === "dark" ? "dark" : "light", color: parsed.color };
      }
    }
  } catch {}
  return { mode: "light", color: "graphite" };
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeConfig>(getInitialTheme);
  const { user } = useAuth();
  const { wallpaperId, wallpaperSrc, wallpaperStyle, wallpaperBgStyle, setWallpaper, brightness: wallpaperBrightness, setBrightness: setWallpaperBrightness, blur: wallpaperBlur, setBlur: setWallpaperBlur } = useWallpaper();

  // Sync theme to DB
  const { data: dbTheme, save: saveThemeToDb } = usePersistedWidget<ThemeConfig>({
    key: "theme",
    defaultValue: { mode: "light", color: "graphite" },
    debounceMs: 500,
  });

  // When DB data loads, apply it (DB is source of truth for cross-device)
  const hasAppliedDbTheme = useRef(false);
  // Reset ref when user changes so DB theme is re-applied
  useEffect(() => { hasAppliedDbTheme.current = false; }, [user?.id]);

  useEffect(() => {
    if (!hasAppliedDbTheme.current && dbTheme && dbTheme.mode && dbTheme.color && VALID_COLORS.includes(dbTheme.color)) {
      hasAppliedDbTheme.current = true;
      setTheme(dbTheme);
    }
  }, [dbTheme]);

  const setMode = useCallback((mode: ThemeMode) => {
    setTheme(prev => {
      const next = { ...prev, mode };
      saveThemeToDb(next);
      return next;
    });
  }, [saveThemeToDb]);

  const setColor = useCallback((color: ThemeColor) => {
    setTheme(prev => {
      const next = { ...prev, color };
      saveThemeToDb(next);
      return next;
    });
  }, [saveThemeToDb]);

  const toggleMode = useCallback(() => {
    setTheme(prev => {
      const next = { ...prev, mode: prev.mode === "light" ? "dark" : "light" as ThemeMode };
      saveThemeToDb(next);
      return next;
    });
  }, [saveThemeToDb]);

  useEffect(() => {
    const { applyThemeFromConfig } = getThemeApplier();
    applyThemeFromConfig(theme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme, setMode, setColor, toggleMode, wallpaperId, wallpaperSrc, wallpaperStyle, setWallpaper, wallpaperBrightness, setWallpaperBrightness, wallpaperBlur, setWallpaperBlur,
  }), [theme, setMode, setColor, toggleMode, wallpaperId, wallpaperSrc, wallpaperStyle, setWallpaper, wallpaperBrightness, setWallpaperBrightness, wallpaperBlur, setWallpaperBlur]);

  return (
    <ThemeContext.Provider value={value}>
      <div
        className="fixed inset-0 bg-cover bg-center bg-fixed pointer-events-none"
        style={{ ...wallpaperBgStyle, zIndex: -1 }}
        aria-hidden="true"
      />
      {children}
    </ThemeContext.Provider>
  );
};

function getThemeApplier() {
  const lightBase: Record<string, string> = {
    background: "30 15% 93%", foreground: "30 10% 15%",
    card: "0 0% 100% / 0.75", "card-foreground": "30 10% 10%",
    popover: "30 12% 95%", "popover-foreground": "30 10% 15%",
    "primary-foreground": "0 0% 100%", secondary: "30 8% 86%",
    "secondary-foreground": "30 10% 20%", muted: "30 6% 89%",
    "muted-foreground": "30 6% 35%", "accent-foreground": "0 0% 100%",
    destructive: "0 72% 51%", "destructive-foreground": "0 0% 100%",
    border: "30 10% 82%", input: "30 10% 84%",
  };
  const darkBase: Record<string, string> = {
    background: "225 15% 12%", foreground: "210 20% 92%",
    card: "0 0% 100% / 0.75", "card-foreground": "210 20% 95%",
    popover: "225 15% 15%", "popover-foreground": "210 20% 92%",
    "primary-foreground": "0 0% 100%", secondary: "225 10% 20%",
    "secondary-foreground": "210 15% 80%", muted: "225 10% 18%",
    "muted-foreground": "215 10% 65%", "accent-foreground": "0 0% 100%",
    destructive: "0 72% 51%", "destructive-foreground": "0 0% 100%",
    border: "225 10% 22%", input: "225 10% 24%",
  };
  const colorVars: Record<string, { primary: string; accent: string; ring: string }> = {
    brown:      { primary: "30 25% 42%",  accent: "30 20% 48%",  ring: "30 25% 42%" },
    black:      { primary: "0 0% 15%",    accent: "0 0% 25%",    ring: "0 0% 15%" },
    graphite:   { primary: "220 10% 35%", accent: "220 10% 45%", ring: "220 10% 35%" },
    "light-gray": { primary: "220 10% 65%", accent: "220 10% 70%", ring: "220 10% 65%" },
    purple:     { primary: "270 70% 55%", accent: "270 60% 60%", ring: "270 70% 55%" },
    blue:       { primary: "215 80% 55%", accent: "215 70% 60%", ring: "215 80% 55%" },
    green:      { primary: "150 60% 42%", accent: "150 50% 48%", ring: "150 60% 42%" },
    red:        { primary: "0 72% 51%",   accent: "0 62% 56%",   ring: "0 72% 51%" },
    orange:     { primary: "25 90% 55%",  accent: "25 80% 60%",  ring: "25 90% 55%" },
    yellow:     { primary: "45 90% 50%",  accent: "45 80% 55%",  ring: "45 90% 50%" },
    pink:       { primary: "340 75% 55%", accent: "340 65% 60%", ring: "340 75% 55%" },
    lilac:      { primary: "280 50% 70%", accent: "280 45% 75%", ring: "280 50% 70%" },
  };

  return {
    applyThemeFromConfig(config: ThemeConfig) {
      const root = document.documentElement;
      const base = config.mode === "dark" ? darkBase : lightBase;
      const colors = colorVars[config.color] || colorVars["graphite"];

      Object.entries(base).forEach(([key, value]) => root.style.setProperty(`--${key}`, value));
      root.style.setProperty("--primary", colors.primary);
      root.style.setProperty("--accent", colors.accent);
      root.style.setProperty("--ring", colors.ring);

      if (config.mode === "dark") {
        root.style.setProperty("--glass-bg", "0 0% 15% / 0.75");
        root.style.setProperty("--glass-border", "0 0% 100% / 0.1");
        root.style.setProperty("--glass-shadow", "0 8px 32px 0 rgba(0, 0, 0, 0.3)");
        root.style.setProperty("--overlay-text", "0 0% 100%");
      } else {
        root.style.setProperty("--glass-bg", "0 0% 100% / 0.75");
        root.style.setProperty("--glass-border", "0 0% 100% / 0.3");
        root.style.setProperty("--glass-shadow", "0 8px 32px 0 rgba(31, 38, 35, 0.12)");
        root.style.setProperty("--overlay-text", "30 10% 15%");
      }

      if (["light-gray", "yellow", "brown"].includes(config.color)) {
        root.style.setProperty("--primary-foreground", "0 0% 10%");
        root.style.setProperty("--accent-foreground", "0 0% 10%");
      } else {
        root.style.setProperty("--primary-foreground", "0 0% 100%");
        root.style.setProperty("--accent-foreground", "0 0% 100%");
      }
    }
  };
}

const defaultThemeContextValue: ThemeContextValue = {
  theme: { mode: "light", color: "graphite" },
  setMode: () => {},
  setColor: () => {},
  toggleMode: () => {},
  wallpaperId: "none" as WallpaperId,
  wallpaperSrc: "",
  wallpaperStyle: {},
  setWallpaper: () => {},
  wallpaperBrightness: 100,
  setWallpaperBrightness: () => {},
  wallpaperBlur: 0,
  setWallpaperBlur: () => {},
};

export const useThemeContext = () => {
  const ctx = useContext(ThemeContext);
  return ctx ?? defaultThemeContextValue;
};
