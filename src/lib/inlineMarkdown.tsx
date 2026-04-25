import React from "react";

/**
 * Converts inline markdown (**bold** and *italic*) to React elements.
 * Handles nested patterns: **bold with *italic* inside**
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text || typeof text !== "string") return text;
  
  // No markdown markers? Return as-is
  if (!text.includes("*")) return text;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Find the next ** or * pattern
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);

    // Determine which comes first
    const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const italicIndex = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

    let nextIndex = -1;
    let isBold = false;
    let match: RegExpMatchArray | null = null;

    if (boldIndex >= 0 && (italicIndex < 0 || boldIndex <= italicIndex)) {
      nextIndex = boldIndex;
      isBold = true;
      match = boldMatch;
    } else if (italicIndex >= 0) {
      nextIndex = italicIndex;
      isBold = false;
      match = italicMatch;
    }

    if (nextIndex < 0 || !match) {
      // No more patterns
      parts.push(remaining);
      break;
    }

    // Add text before the match
    if (nextIndex > 0) {
      parts.push(remaining.slice(0, nextIndex));
    }

    const innerText = match[1];
    if (isBold) {
      // Recursively process inner content for nested italic
      parts.push(<strong key={keyIdx++} className="font-semibold text-white/80">{renderInlineMarkdown(innerText)}</strong>);
    } else {
      parts.push(<em key={keyIdx++}>{innerText}</em>);
    }

    remaining = remaining.slice(nextIndex + match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
