/**
 * @module whatsapp-utils
 * @description Pure utility functions for WhatsApp Web proxy
 */

/** Derive a per-user+workspace Evolution instance name */
export function userInstanceName(userId: string, workspaceId?: string): string {
  const userPart = userId.replace(/-/g, "").slice(0, 8);
  if (workspaceId) {
    const wsPart = workspaceId.replace(/-/g, "").slice(0, 6);
    return `desh_${userPart}_${wsPart}`;
  }
  return `desh_${userPart}`;
}

/** Normalize Brazilian mobile numbers: add the 9th digit after DDD if missing */
export function normalizeBrazilianNumber(num: string): string {
  const clean = num.replace(/\D/g, "");
  if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = parseInt(clean.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) {
      return clean.slice(0, 4) + "9" + clean.slice(4);
    }
  }
  return clean;
}

/** Get all possible number variants for a Brazilian mobile (with/without 9th digit) */
export function numberVariants(num: string): string[] {
  const clean = num.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(clean);
  if (clean.length === 13 && clean.startsWith("55")) {
    const ddd = clean.slice(2, 4);
    const withoutNine = "55" + ddd + clean.slice(5);
    variants.add(withoutNine);
  }
  if (clean.length === 12 && clean.startsWith("55")) {
    const ddd = parseInt(clean.slice(2, 4), 10);
    if (ddd >= 11 && ddd <= 99) {
      const withNine = clean.slice(0, 4) + "9" + clean.slice(4);
      variants.add(withNine);
    }
  }
  return Array.from(variants);
}

export function mapEvolutionState(state: string): string {
  if (state === "open") return "CONNECTED";
  if (state === "connecting") return "QR_PENDING";
  if (state === "close") return "DISCONNECTED";
  return "DISCONNECTED";
}

/** Extract QR code from all possible fields across Evolution API v1/v2 */
export function extractQrCode(gw: Record<string, unknown>): string | null {
  if (typeof gw.base64 === "string" && gw.base64) return gw.base64;
  if (typeof gw.qrcode === "string" && gw.qrcode) return gw.qrcode;
  if (gw.qrcode && typeof gw.qrcode === "object") {
    const qr = gw.qrcode as Record<string, unknown>;
    if (typeof qr.base64 === "string" && qr.base64) return qr.base64;
    if (typeof qr.code === "string" && qr.code) return qr.code;
  }
  return null;
}

/** Map Evolution messageType to DB type */
export function mapMessageType(messageType: string): string {
  const VALID_TYPES = ["text","image","audio","video","document","sticker","location","contact","reaction","template","other"];
  let dbType = "text";
  if (messageType === "imageMessage") dbType = "image";
  else if (messageType === "audioMessage") dbType = "audio";
  else if (messageType === "videoMessage") dbType = "video";
  else if (messageType === "documentMessage") dbType = "document";
  else if (messageType === "stickerMessage") dbType = "sticker";
  else if (messageType === "locationMessage" || messageType === "liveLocationMessage") dbType = "location";
  else if (messageType === "contactMessage" || messageType === "contactsArrayMessage") dbType = "contact";
  else if (messageType === "reactionMessage") dbType = "reaction";
  else if (messageType === "conversation" || messageType === "extendedTextMessage") dbType = "text";
  else dbType = "other";
  if (!VALID_TYPES.includes(dbType)) dbType = "other";
  return dbType;
}
