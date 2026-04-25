/**
 * @module google-connection-check
 * @description Shared helper to detect if a user has an active Google connection
 * (Gmail / Calendar / Tasks / Drive) for use in tool gating.
 *
 * Tries the canonical `composio_user_emails` mapping first and falls back to
 * the `connections` table so legacy users (who connected before the email
 * mapping was added) still pass the check.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.95.3";

type Toolkit = "gmail" | "google_calendar" | "google_tasks" | "google_drive" | string;

const TOOLKIT_VARIANTS: Record<string, string[]> = {
  gmail: ["gmail"],
  google_calendar: ["google_calendar", "googlecalendar"],
  google_tasks: ["google_tasks", "googletasks"],
  google_drive: ["google_drive", "googledrive"],
};

const PLATFORM_VARIANTS: Record<string, string[]> = {
  gmail: ["gmail", "google"],
  google_calendar: ["google_calendar", "googlecalendar", "google", "calendar"],
  google_tasks: ["google_tasks", "googletasks", "google"],
  google_drive: ["google_drive", "googledrive", "google"],
};

export async function hasGoogleConnection(
  supabase: SupabaseClient,
  userId: string,
  toolkit: Toolkit,
): Promise<boolean> {
  const toolkitList = TOOLKIT_VARIANTS[toolkit] ?? [toolkit];
  const platformList = PLATFORM_VARIANTS[toolkit] ?? [toolkit];

  // Primary: canonical mapping
  const { data: composio } = await supabase
    .from("composio_user_emails")
    .select("id")
    .eq("user_id", userId)
    .in("toolkit", toolkitList)
    .limit(1)
    .maybeSingle();
  if (composio) return true;

  // Fallback: legacy `connections` rows
  const { data: conn } = await supabase
    .from("connections")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("platform", platformList)
    .limit(1)
    .maybeSingle();
  return !!conn;
}
