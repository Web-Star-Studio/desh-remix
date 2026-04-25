/**
 * Centralized localStorage key constants.
 * Avoids magic strings scattered across the codebase.
 */
export const STORAGE_KEYS = {
  INTRO_DISABLED: "desh-intro-disabled",
  SELECTED_AGENT_ID: "desh-selected-agent-id",
  NOTIFICATION_PREFS: "dashfy-notifs",
  GOOGLE_NOTIF_PREFS: "desh-google-notif-prefs",
  MAP_STYLE: "desh-map-style",
  THEME_COLOR: "desh-theme-color",
  THEME_MODE: "desh-theme-mode",
  WALLPAPER: "desh-wallpaper",
} as const;
