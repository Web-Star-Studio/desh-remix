import type { ThemeMode } from "@/hooks/ui/useTheme";
import type { WallpaperId } from "@/hooks/ui/useWallpaper";

export interface SharedTheme {
  id: string;
  user_id: string;
  name: string;
  description: string;
  mode: string;
  primary_hsl: string;
  accent_hsl: string;
  background_hsl: string | null;
  foreground_hsl: string | null;
  wallpaper_id: string | null;
  tags: string[];
  likes: number;
  downloads: number;
  is_public: boolean;
  created_at: string;
}

export function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const parts = hsl.trim().split(/\s+/);
  return {
    h: parseInt(parts[0]) || 0,
    s: parseInt(parts[1]) || 0,
    l: parseInt(parts[2]) || 50,
  };
}

export function toHSLString(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

export function hslToCSS(hsl: string): string {
  return `hsl(${hsl})`;
}

export const SEASONAL_THEMES = [
  { name: "🌸 Primavera", mode: "light" as ThemeMode, primary: "340 75% 55%", accent: "340 65% 60%", wallpaper: "lavender" as WallpaperId },
  { name: "☀️ Verão", mode: "light" as ThemeMode, primary: "25 90% 55%", accent: "25 80% 60%", wallpaper: "beach" as WallpaperId },
  { name: "🍂 Outono", mode: "dark" as ThemeMode, primary: "30 25% 42%", accent: "30 20% 48%", wallpaper: "forest" as WallpaperId },
  { name: "❄️ Inverno", mode: "dark" as ThemeMode, primary: "215 80% 55%", accent: "215 70% 60%", wallpaper: "mountain" as WallpaperId },
];
