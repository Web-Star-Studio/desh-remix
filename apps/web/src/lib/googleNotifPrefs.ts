import { STORAGE_KEYS } from "@/constants/storage-keys";

export interface GoogleNotifSettings {
  gmail: boolean;
  calendar: boolean;
  tasks: boolean;
  people: boolean;
  drive: boolean;
}

export const defaultGoogleNotifs: GoogleNotifSettings = {
  gmail: true,
  calendar: true,
  tasks: true,
  people: true,
  drive: true,
};

export function getGoogleNotifPrefs(): GoogleNotifSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GOOGLE_NOTIF_PREFS);
    return raw ? { ...defaultGoogleNotifs, ...JSON.parse(raw) } : defaultGoogleNotifs;
  } catch {
    return defaultGoogleNotifs;
  }
}
