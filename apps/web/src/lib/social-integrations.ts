/**
 * Social Media + Ads + Analytics Platform Catalog.
 *
 * All platforms here are reached through Zernio (apps/api `/zernio/*` typed
 * routes). Composio is no longer the substrate for /social — it stays for
 * Gmail/Calendar/Drive only. The `zernioPlatform` slug is what Zernio's
 * `/connect/<platform>` and platform-specific endpoints expect.
 *
 * Coverage matches Zernio's documented platform list (April 2026 snapshot):
 * Instagram, Facebook, X (Twitter), LinkedIn, YouTube, TikTok, Pinterest,
 * Threads, Reddit, Bluesky, Snapchat, Telegram, Google Business, Discord;
 * plus Ads platforms (Google, Meta/Facebook, LinkedIn, TikTok, X, Pinterest);
 * plus Google Analytics (analytics-only).
 */

export interface SocialPlatformConfig {
  id: string;
  name: string;
  icon: string; // lucide icon name
  category: "social" | "ads" | "analytics";
  /**
   * Zernio platform slug — used by `/zernio/social/connect/:platform` and
   * matched against `social_accounts.platform` rows synced from Zernio.
   */
  zernioPlatform: string;
  color: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  // ── Social Networks ──
  { id: "instagram", name: "Instagram", icon: "camera", category: "social", zernioPlatform: "instagram", color: "#E4405F" },
  { id: "facebook", name: "Facebook", icon: "thumbs-up", category: "social", zernioPlatform: "facebook", color: "#1877F2" },
  { id: "twitter", name: "X (Twitter)", icon: "at-sign", category: "social", zernioPlatform: "twitter", color: "#000000" },
  { id: "linkedin", name: "LinkedIn", icon: "briefcase", category: "social", zernioPlatform: "linkedin", color: "#0A66C2" },
  { id: "youtube", name: "YouTube", icon: "play", category: "social", zernioPlatform: "youtube", color: "#FF0000" },
  { id: "tiktok", name: "TikTok", icon: "music", category: "social", zernioPlatform: "tiktok", color: "#010101" },
  { id: "pinterest", name: "Pinterest", icon: "pin", category: "social", zernioPlatform: "pinterest", color: "#E60023" },
  { id: "threads", name: "Threads", icon: "hash", category: "social", zernioPlatform: "threads", color: "#000000" },
  { id: "reddit", name: "Reddit", icon: "message-square", category: "social", zernioPlatform: "reddit", color: "#FF4500" },
  { id: "bluesky", name: "Bluesky", icon: "cloud", category: "social", zernioPlatform: "bluesky", color: "#0085FF" },
  { id: "snapchat", name: "Snapchat", icon: "ghost", category: "social", zernioPlatform: "snapchat", color: "#FFFC00" },
  { id: "telegram", name: "Telegram", icon: "send", category: "social", zernioPlatform: "telegram", color: "#26A5E4" },
  { id: "google-business", name: "Google Business", icon: "store", category: "social", zernioPlatform: "googlebusiness", color: "#4285F4" },
  { id: "discord", name: "Discord", icon: "message-circle", category: "social", zernioPlatform: "discord", color: "#5865F2" },

  // ── Ads ──
  { id: "google-ads", name: "Google Ads", icon: "megaphone", category: "ads", zernioPlatform: "googleads", color: "#4285F4" },
  { id: "meta-ads", name: "Meta Ads", icon: "target", category: "ads", zernioPlatform: "metaads", color: "#1877F2" },
  { id: "linkedin-ads", name: "LinkedIn Ads", icon: "badge-dollar-sign", category: "ads", zernioPlatform: "linkedinads", color: "#0A66C2" },
  { id: "tiktok-ads", name: "TikTok Ads", icon: "music-2", category: "ads", zernioPlatform: "tiktokads", color: "#010101" },
  { id: "x-ads", name: "X Ads", icon: "at-sign", category: "ads", zernioPlatform: "xads", color: "#000000" },
  { id: "pinterest-ads", name: "Pinterest Ads", icon: "pin", category: "ads", zernioPlatform: "pinterestads", color: "#E60023" },

  // ── Analytics ──
  // NOTE: Google Analytics is NOT covered by Zernio. Until there's a
  // first-party analytics integration, this card is effectively informational.
  // We keep it in the platform list so the /social Analytics tab renders
  // something, but `useAnalyticsData` shows an empty/coming-soon state.
  { id: "google-analytics", name: "Google Analytics", icon: "line-chart", category: "analytics", zernioPlatform: "googleanalytics", color: "#E37400" },
];

/** Get platforms by category */
export const getSocialPlatforms = () => SOCIAL_PLATFORMS.filter((p) => p.category === "social");
export const getAdsPlatforms = () => SOCIAL_PLATFORMS.filter((p) => p.category === "ads");
export const getAnalyticsPlatforms = () => SOCIAL_PLATFORMS.filter((p) => p.category === "analytics");
export const getPlatformById = (id: string) => SOCIAL_PLATFORMS.find((p) => p.id === id);

/** Inverse lookup — match a Zernio platform slug back to our config row. */
export const getPlatformByZernioSlug = (slug: string) =>
  SOCIAL_PLATFORMS.find((p) => p.zernioPlatform.toLowerCase() === slug.toLowerCase());
