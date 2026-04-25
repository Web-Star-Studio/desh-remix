/**
 * Pandora Response Cleaner & Post-Processor
 * Strips leaked JSON, code blocks, and normalizes formatting per channel.
 */

export interface CleanedResponse {
  text: string;
  suggestedReplies: string[];
}

/**
 * Extract and remove any trailing JSON/array suggest_replies from the AI response.
 */
export function cleanPandoraResponse(rawResponse: string): CleanedResponse {
  let text = rawResponse;
  let suggestedReplies: string[] = [];

  // Detect and extract JSON suggest_replies at the end
  const jsonMatch = text.match(/\{[\s\n]*"suggest_replies"[\s\n]*:[\s\n]*\[[\s\S]*?\][\s\n]*\}[\s]*$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      suggestedReplies = parsed.suggest_replies || [];
      text = text.slice(0, jsonMatch.index).trim();
    } catch { /* ignore */ }
  }

  // Also detect loose arrays of suggestions
  const arrayMatch = text.match(/\[[\s\n]*"[^"]+?"[\s\n]*(,[\s\n]*"[^"]+?"[\s\n]*)*\][\s]*$/);
  if (arrayMatch && !jsonMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.every((i: unknown) => typeof i === "string")) {
        suggestedReplies = parsed;
        text = text.slice(0, arrayMatch.index).trim();
      }
    } catch { /* ignore */ }
  }

  // Remove any residual markdown code blocks
  text = text.replace(/```json[\s\S]*?```/g, "").trim();
  text = text.replace(/```[\s\S]*?```/g, "").trim();

  return { text, suggestedReplies };
}

/**
 * Post-process AI text for the target channel's formatting rules.
 */
export function postProcessResponse(text: string, channel: "chat" | "whatsapp" | "mcp"): string {
  let processed = text;

  // 1. Replace markdown headings with bold
  processed = processed.replace(/^#{1,3}\s+(.+)$/gm, (_, title) => {
    if (channel === "whatsapp") return `*${title.trim()}*`;
    return `**${title.trim()}**`;
  });

  // 2. Remove markdown separators (--- or ***)
  processed = processed.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "");

  // 3. Remove escaped code blocks
  processed = processed.replace(/```[\w]*\n?[\s\S]*?```/g, "");
  processed = processed.replace(/`([^`]+)`/g, "$1"); // inline code → plain text

  // 4. WhatsApp: convert **bold** markdown to *bold* WhatsApp
  if (channel === "whatsapp") {
    processed = processed.replace(/\*\*(.+?)\*\*/g, "*$1*");
    // Convert markdown links [text](url) → text (url)
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  }

  // 5. Collapse excessive blank lines (max 2 in a row)
  processed = processed.replace(/\n{3,}/g, "\n\n");

  // 6. Trim
  processed = processed.trim();

  return processed;
}

/**
 * Full pipeline: clean + post-process.
 */
export function processPandoraResponse(
  rawResponse: string,
  channel: "chat" | "whatsapp" | "mcp",
): CleanedResponse {
  const { text, suggestedReplies } = cleanPandoraResponse(rawResponse);
  const finalText = postProcessResponse(text, channel);
  return { text: finalText, suggestedReplies };
}
