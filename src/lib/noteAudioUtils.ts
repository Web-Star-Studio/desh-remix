/**
 * Utilities for handling audio blocks embedded in note HTML content.
 * 
 * Audio blocks are stored as special HTML markers that survive being 
 * stored in the database but need to be separated from TipTap content
 * since TipTap strips unknown HTML elements like <audio>.
 * 
 * Format: <!--AUDIO_BLOCK:{"src":"data:audio/...","duration":120}-->
 */

export interface AudioBlock {
  id: string;
  src: string;       // base64 data URL
  duration: number;   // seconds
}

const AUDIO_MARKER_RE = /<!--AUDIO_BLOCK:(.*?)-->/g;
const LEGACY_AUDIO_RE = /<div\s+data-audio="true"[^>]*>.*?<\/div>/gs;

/** Generate a unique ID for an audio block */
function generateAudioId(): string {
  return `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create an audio block marker string */
export function createAudioMarker(src: string, duration: number): string {
  const block: AudioBlock = { id: generateAudioId(), src, duration };
  return `<!--AUDIO_BLOCK:${JSON.stringify(block)}-->`;
}

/**
 * Extract audio blocks from HTML content.
 * Returns the cleaned HTML (without audio markers) and the extracted audio blocks.
 */
export function extractAudioBlocks(html: string): { cleanHtml: string; audioBlocks: AudioBlock[] } {
  const blocks: AudioBlock[] = [];

  // Extract new-format markers
  let cleanHtml = html.replace(AUDIO_MARKER_RE, (_, json) => {
    try {
      const block = JSON.parse(json) as AudioBlock;
      if (block.src && block.id) blocks.push(block);
    } catch {}
    return "";
  });

  // Extract legacy <div data-audio> blocks
  cleanHtml = cleanHtml.replace(LEGACY_AUDIO_RE, (match) => {
    const srcMatch = match.match(/src="([^"]+)"/);
    const durationMatch = match.match(/Áudio\s*\((\d+):(\d+)\)/);
    if (srcMatch?.[1]) {
      const dur = durationMatch ? parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]) : 0;
      blocks.push({ id: generateAudioId(), src: srcMatch[1], duration: dur });
    }
    return "";
  });

  return { cleanHtml: cleanHtml.trim(), audioBlocks: blocks };
}

/**
 * Merge audio blocks back into HTML content for storage.
 */
export function mergeAudioBlocks(html: string, audioBlocks: AudioBlock[]): string {
  if (audioBlocks.length === 0) return html;
  const markers = audioBlocks.map(b => `<!--AUDIO_BLOCK:${JSON.stringify(b)}-->`).join("");
  return html + markers;
}

/** Remove a specific audio block by ID */
export function removeAudioBlock(audioBlocks: AudioBlock[], id: string): AudioBlock[] {
  return audioBlocks.filter(b => b.id !== id);
}

/** Format seconds to MM:SS */
export function formatAudioDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
