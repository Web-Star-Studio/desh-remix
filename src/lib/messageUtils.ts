/**
 * Shared types, constants, and pure helper functions for the Messages module.
 * Extracted from MessagesPage.tsx for reusability and maintainability.
 */

// --- Types ---

export interface Conversation {
  id: string;
  name: string;
  platform: string;
  lastMessage: string;
  time: string;
  lastMessageAt: number;
  unread: number;
  avatar: string;
  channelId: string;
  pinned: boolean;
  archived: boolean;
  muted: boolean;
  workspaceId?: string | null;
  labels?: string[];
  /** Late API account ID — required for social inbox API calls */
  accountId?: string;
  /** Late API account username */
  accountUsername?: string;
  /** Whether this is a Late inbox conversation (id starts with late_) */
  isLateInbox?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  rawDate: string;
  isMe: boolean;
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  mediaType?: "image" | "audio" | "video" | "document" | "album";
  mediaThumbnail?: string;
  mediaFileName?: string;
  mediaMimetype?: string;
  quotedText?: string;
  quotedSender?: string;
  reactions?: Array<{ emoji: string; fromMe?: boolean; timestamp?: number }>;
  starred?: boolean;
  deletedForEveryone?: boolean;
  contentRaw?: any;
}

// --- Constants ---

export const platformColors: Record<string, string> = {
  whatsapp: "bg-green-500",
  slack: "bg-purple-600",
  teams: "bg-blue-600",
  discord: "bg-indigo-500",
  instagram: "bg-pink-500",
  facebook: "bg-blue-500",
  twitter: "bg-sky-500",
  bluesky: "bg-blue-400",
  reddit: "bg-orange-500",
  telegram: "bg-cyan-500",
  threads: "bg-zinc-700",
  tiktok: "bg-zinc-900",
  linkedin: "bg-blue-700",
  youtube: "bg-red-600",
  pinterest: "bg-red-500",
  dribbble: "bg-pink-400",
};

export const platformLabels: Record<string, string> = {
  all: "Todas",
  whatsapp: "WhatsApp",
  slack: "Slack",
  teams: "Teams",
  discord: "Discord",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter/X",
  bluesky: "Bluesky",
  reddit: "Reddit",
  telegram: "Telegram",
  threads: "Threads",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  pinterest: "Pinterest",
  dribbble: "Dribbble",
};

// --- Helper Functions ---

/** Extract media info from WhatsApp message content_raw */
export function extractMedia(raw: any): Pick<ChatMessage, "mediaType" | "mediaThumbnail" | "mediaFileName" | "mediaMimetype"> {
  if (!raw || typeof raw !== "object") return {};
  const msgType = raw.messageType;
  const msg = raw.message;

  if (msgType === "imageMessage" && msg?.imageMessage) {
    const img = msg.imageMessage;
    let thumbDataUri: string | undefined;
    const thumbBytes = img.jpegThumbnail;
    if (thumbBytes && typeof thumbBytes === "object" && !Array.isArray(thumbBytes)) {
      try {
        const arr = Object.values(thumbBytes) as number[];
        const binary = arr.map(b => String.fromCharCode(b)).join("");
        thumbDataUri = `data:image/jpeg;base64,${btoa(binary)}`;
      } catch { /* ignore */ }
    } else if (typeof thumbBytes === "string") {
      thumbDataUri = `data:image/jpeg;base64,${thumbBytes}`;
    }
    return { mediaType: "image", mediaThumbnail: thumbDataUri, mediaMimetype: img.mimetype };
  }

  if (msgType === "documentMessage" && msg?.documentMessage) {
    const doc = msg.documentMessage;
    return { mediaType: "document", mediaFileName: doc.fileName, mediaMimetype: doc.mimetype };
  }

  if (msgType === "audioMessage" && msg?.audioMessage) {
    return { mediaType: "audio", mediaMimetype: msg.audioMessage.mimetype };
  }

  if (msgType === "videoMessage" && msg?.videoMessage) {
    return { mediaType: "video", mediaMimetype: msg.videoMessage.mimetype };
  }

  if (msgType === "albumMessage") {
    const count = msg?.albumMessage?.expectedImageCount || 0;
    return { mediaType: "album", mediaFileName: `Álbum de ${count} fotos` };
  }

  return {};
}

/** Extract quoted message info from content_raw */
export function extractQuote(raw: any): { quotedText?: string; quotedSender?: string } {
  if (!raw || typeof raw !== "object") return {};
  const msg = raw.message;
  if (!msg) return {};
  for (const key of Object.keys(msg)) {
    const inner = msg[key];
    if (inner?.contextInfo?.quotedMessage) {
      const quoted = inner.contextInfo.quotedMessage;
      const text = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || "Mídia";
      const sender = inner.contextInfo.participant?.replace(/@.*/, "") || "";
      return { quotedText: text, quotedSender: sender };
    }
  }
  return {};
}

/** Detect special message types from content_raw */
export function detectSpecialType(raw: any): "location" | "contact" | "sticker" | null {
  if (!raw || typeof raw !== "object") return null;
  const msgType = raw.messageType;
  if (msgType === "locationMessage" || msgType === "liveLocationMessage") return "location";
  if (msgType === "contactMessage" || msgType === "contactsArrayMessage") return "contact";
  if (msgType === "stickerMessage") return "sticker";
  return null;
}

/** Get human-readable date label */
export function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString("pt-BR", { weekday: "long" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

/** Insert date separators between messages */
export function insertDateSeparators(messages: ChatMessage[]): (ChatMessage | { type: "separator"; label: string; id: string })[] {
  const result: (ChatMessage | { type: "separator"; label: string; id: string })[] = [];
  let lastDateLabel = "";
  for (const msg of messages) {
    const label = getDateLabel(msg.rawDate);
    if (label !== lastDateLabel) {
      result.push({ type: "separator", label, id: `sep-${msg.id}` });
      lastDateLabel = label;
    }
    result.push(msg);
  }
  return result;
}

/** Format phone number for display */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return "Contato";
  const clean = phone.replace(/@.*$/, "");
  if (clean.length > 8) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  return clean;
}

/** Build type label for last message preview */
export function getMessageTypeLabel(type: string): string | null {
  switch (type) {
    case "image": return "📷 Imagem";
    case "audio": return "🎤 Áudio";
    case "video": return "🎥 Vídeo";
    case "document": return "📎 Documento";
    case "sticker": return "🖼️ Sticker";
    case "location": return "📍 Localização";
    case "contact": return "👤 Contato";
    default: return null;
  }
}
