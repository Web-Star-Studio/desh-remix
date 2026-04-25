/** Social Media Management types — Late API integration */

export type SocialPlatform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "reddit"
  | "bluesky"
  | "threads"
  | "googlebusiness"
  | "telegram"
  | "snapchat";

export interface SocialProfile {
  id: string;
  user_id: string;
  workspace_id: string | null;
  late_profile_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  user_id: string;
  profile_id: string;
  late_account_id: string;
  platform: SocialPlatform;
  username: string | null;
  avatar_url: string | null;
  current_followers: number;
  status: string;
  created_at: string;
}

export type SocialPostStatus = "draft" | "scheduled" | "published" | "failed" | "partial";

export interface SocialPost {
  id: string;
  user_id: string;
  workspace_id: string | null;
  late_post_id: string | null;
  content: string;
  status: SocialPostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  platforms: string[];
  media_items: SocialMediaItem[];
  analytics: SocialPostAnalytics | null;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaItem {
  url: string;
  type: "image" | "video" | "gif" | "document";
  thumbnail_url?: string;
  title?: string;
}

/** Twitter reply settings */
export type TwitterReplySettings = "following" | "mentionedUsers" | "subscribers" | "verified";

/** Calculate Twitter-accurate character count (URLs=23, emojis=2) */
export function twitterCharCount(text: string): number {
  // Replace URLs with 23-char placeholder
  const urlRegex = /https?:\/\/[^\s]+/g;
  let adjusted = text.replace(urlRegex, "x".repeat(23));
  // Count emoji as 2 chars each (surrogate pairs + ZWJ sequences)
  const emojiRegex = /\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic})*/gu;
  let emojiCount = 0;
  const matches = adjusted.matchAll(emojiRegex);
  for (const m of matches) {
    emojiCount++;
    adjusted = adjusted.replace(m[0], "");
  }
  return adjusted.length + emojiCount * 2;
}

export interface SocialPostAnalytics {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  engagement_rate?: number;
}

export interface SocialAnalyticsOverview {
  total_impressions: number;
  total_reach: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_clicks: number;
  avg_engagement_rate: number;
}

export interface FollowerStats {
  account_id: string;
  platform: SocialPlatform;
  data: { date: string; followers: number }[];
}

export interface BestTimeSlot {
  day: number; // 0=Sun, 6=Sat
  hour: number; // 0-23
  score: number; // 0-100
}

export interface QueueSlot {
  id: string;
  profile_id: string;
  day_of_week: number;
  time: string; // HH:mm
  active: boolean;
}

/** Platform-specific media constraints */
export interface PlatformMediaRules {
  maxImages: number;
  maxVideos: number;
  canMixMedia: boolean;
  maxFileSize: number; // MB
  requiresMedia: boolean;
  supportsDocuments: boolean;
}

export const PLATFORM_MEDIA_RULES: Record<SocialPlatform, PlatformMediaRules> = {
  twitter:        { maxImages: 4, maxVideos: 1, canMixMedia: false, maxFileSize: 5120, requiresMedia: false, supportsDocuments: false },
  instagram:      { maxImages: 10, maxVideos: 1, canMixMedia: true, maxFileSize: 8, requiresMedia: true, supportsDocuments: false },
  facebook:       { maxImages: 10, maxVideos: 1, canMixMedia: false, maxFileSize: 4, requiresMedia: false, supportsDocuments: false },
  linkedin:       { maxImages: 20, maxVideos: 1, canMixMedia: false, maxFileSize: 5120, requiresMedia: false, supportsDocuments: true },
  tiktok:         { maxImages: 35, maxVideos: 1, canMixMedia: false, maxFileSize: 20, requiresMedia: true, supportsDocuments: false },
  youtube:        { maxImages: 0, maxVideos: 1, canMixMedia: false, maxFileSize: 5120, requiresMedia: true, supportsDocuments: false },
  pinterest:      { maxImages: 1, maxVideos: 1, canMixMedia: false, maxFileSize: 32, requiresMedia: true, supportsDocuments: false },
  reddit:         { maxImages: 20, maxVideos: 0, canMixMedia: false, maxFileSize: 20, requiresMedia: false, supportsDocuments: false },
  bluesky:        { maxImages: 4, maxVideos: 1, canMixMedia: false, maxFileSize: 50, requiresMedia: false, supportsDocuments: false },
  threads:        { maxImages: 10, maxVideos: 1, canMixMedia: false, maxFileSize: 8, requiresMedia: false, supportsDocuments: false },
  googlebusiness: { maxImages: 1, maxVideos: 0, canMixMedia: false, maxFileSize: 5, requiresMedia: false, supportsDocuments: false },
  telegram:       { maxImages: 10, maxVideos: 10, canMixMedia: true, maxFileSize: 50, requiresMedia: false, supportsDocuments: true },
  snapchat:       { maxImages: 1, maxVideos: 1, canMixMedia: false, maxFileSize: 500, requiresMedia: true, supportsDocuments: false },
};

/** Platform-specific connection types */
export type PlatformConnectType = "oauth" | "credentials" | "code";

export const PLATFORM_CONNECT_TYPE: Record<SocialPlatform, PlatformConnectType> = {
  twitter: "oauth",
  instagram: "oauth",
  facebook: "oauth",
  linkedin: "oauth",
  tiktok: "oauth",
  youtube: "oauth",
  pinterest: "oauth",
  reddit: "oauth",
  bluesky: "credentials",
  threads: "oauth",
  googlebusiness: "oauth",
  telegram: "code",
  snapchat: "oauth",
};

/** Platforms requiring secondary selection after OAuth */
export const PLATFORMS_WITH_SELECTION = ["facebook", "linkedin", "pinterest", "googlebusiness", "snapchat"] as const;

/** Platform metadata for UI */
export const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; icon: string; charLimit: number }> = {
  twitter: { label: "X (Twitter)", color: "#000000", icon: "𝕏", charLimit: 280 },
  instagram: { label: "Instagram", color: "#E4405F", icon: "📸", charLimit: 2200 },
  facebook: { label: "Facebook", color: "#1877F2", icon: "f", charLimit: 63206 },
  linkedin: { label: "LinkedIn", color: "#0A66C2", icon: "in", charLimit: 3000 },
  tiktok: { label: "TikTok", color: "#000000", icon: "♪", charLimit: 2200 },
  youtube: { label: "YouTube", color: "#FF0000", icon: "▶", charLimit: 5000 },
  pinterest: { label: "Pinterest", color: "#E60023", icon: "P", charLimit: 500 },
  reddit: { label: "Reddit", color: "#FF4500", icon: "R", charLimit: 40000 },
  bluesky: { label: "Bluesky", color: "#0085FF", icon: "🦋", charLimit: 300 },
  threads: { label: "Threads", color: "#000000", icon: "@", charLimit: 500 },
  googlebusiness: { label: "Google Business", color: "#4285F4", icon: "G", charLimit: 1500 },
  telegram: { label: "Telegram", color: "#26A5E4", icon: "✈", charLimit: 4096 },
  snapchat: { label: "Snapchat", color: "#FFFC00", icon: "👻", charLimit: 250 },
};
