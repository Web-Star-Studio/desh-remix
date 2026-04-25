import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeColor =
  | "brown"
  | "black"
  | "graphite"
  | "light-gray"
  | "purple"
  | "blue"
  | "green"
  | "red"
  | "orange"
  | "yellow"
  | "pink"
  | "lilac";

export interface ThemeConfig {
  mode: ThemeMode;
  color: ThemeColor;
}

export const themeColors: { id: ThemeColor; label: string; preview: string }[] = [
  { id: "brown", label: "Marrom", preview: "30 25% 42%" },
  { id: "black", label: "Preto", preview: "0 0% 15%" },
  { id: "graphite", label: "Grafite", preview: "220 10% 35%" },
  { id: "light-gray", label: "Cinza Claro", preview: "220 10% 65%" },
  { id: "purple", label: "Roxo", preview: "270 70% 55%" },
  { id: "blue", label: "Azul", preview: "215 80% 55%" },
  { id: "green", label: "Verde", preview: "150 60% 42%" },
  { id: "red", label: "Vermelho", preview: "0 72% 51%" },
  { id: "orange", label: "Laranja", preview: "25 90% 55%" },
  { id: "yellow", label: "Amarelo", preview: "45 90% 50%" },
  { id: "pink", label: "Rosa", preview: "340 75% 55%" },
  { id: "lilac", label: "Lilás", preview: "280 50% 70%" },
];

const colorVars: Record<ThemeColor, { primary: string; accent: string; ring: string }> = {
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

const lightModeBase = {
  background: "30 15% 93%",
  foreground: "30 10% 15%",
  card: "0 0% 100% / 0.15",
  "card-foreground": "30 10% 15%",
  popover: "30 12% 95%",
  "popover-foreground": "30 10% 15%",
  "primary-foreground": "0 0% 100%",
  secondary: "30 8% 86%",
  "secondary-foreground": "30 10% 25%",
  muted: "30 6% 89%",
  "muted-foreground": "30 6% 45%",
  "accent-foreground": "0 0% 100%",
  destructive: "0 72% 51%",
  "destructive-foreground": "0 0% 100%",
  border: "30 10% 82%",
  input: "30 10% 84%",
};

const darkModeBase = {
  background: "225 15% 12%",
  foreground: "210 20% 92%",
  card: "0 0% 100% / 0.08",
  "card-foreground": "210 20% 92%",
  popover: "225 15% 15%",
  "popover-foreground": "210 20% 92%",
  "primary-foreground": "0 0% 100%",
  secondary: "225 10% 20%",
  "secondary-foreground": "210 15% 80%",
  muted: "225 10% 18%",
  "muted-foreground": "215 10% 55%",
  "accent-foreground": "0 0% 100%",
  destructive: "0 72% 51%",
  "destructive-foreground": "0 0% 100%",
  border: "225 10% 22%",
  input: "225 10% 24%",
};

function applyTheme(config: ThemeConfig) {
  const root = document.documentElement;
  const base = config.mode === "dark" ? darkModeBase : lightModeBase;
  const colors = colorVars[config.color] || colorVars["graphite"];

  Object.entries(base).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--ring", colors.ring);

  // Glass adjustments for dark mode
  if (config.mode === "dark") {
    root.style.setProperty("--glass-bg", "0 0% 0% / 0.55");
    root.style.setProperty("--glass-border", "0 0% 100% / 0.1");
    root.style.setProperty("--glass-shadow", "0 8px 32px 0 rgba(0, 0, 0, 0.3)");
  } else {
    root.style.setProperty("--glass-bg", "0 0% 100% / 0.65");
    root.style.setProperty("--glass-border", "0 0% 100% / 0.3");
    root.style.setProperty("--glass-shadow", "0 8px 32px 0 rgba(31, 38, 35, 0.12)");
  }

  // Special case: light-gray and yellow need dark foreground on primary
  if (["light-gray", "yellow", "brown"].includes(config.color)) {
    root.style.setProperty("--primary-foreground", "0 0% 10%");
    root.style.setProperty("--accent-foreground", "0 0% 10%");
  } else {
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--accent-foreground", "0 0% 100%");
  }
}

const STORAGE_KEY = "dashfy-theme";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old "amber" to "brown"
        if (parsed.color === "amber") parsed.color = "brown";
        // Validate color exists
        if (colorVars[parsed.color as ThemeColor]) return parsed;
      }
    } catch {}
    return { mode: "light", color: "graphite" };
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  const setMode = useCallback((mode: ThemeMode) => {
    setTheme(prev => ({ ...prev, mode }));
  }, []);

  const setColor = useCallback((color: ThemeColor) => {
    setTheme(prev => ({ ...prev, color }));
  }, []);

  const toggleMode = useCallback(() => {
    setTheme(prev => ({ ...prev, mode: prev.mode === "light" ? "dark" : "light" }));
  }, []);

  return { theme, setMode, setColor, toggleMode };
}
