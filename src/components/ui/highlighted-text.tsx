/**
 * HighlightedText — renders text with case-insensitive highlight on every
 * occurrence of `terms`. For phone matching, also accepts a `digits` term
 * that is matched against the digit-only projection of the source text.
 *
 * Keeps original whitespace, returns plain spans. Safe against injection —
 * uses React text nodes only (no dangerouslySetInnerHTML).
 */
import { useMemo, type ReactNode } from "react";

interface Props {
  text: string | null | undefined;
  /** Plain string terms — matched verbatim, case-insensitive. */
  terms?: string[];
  /** Optional digit-only term — matched against digits-only projection. */
  digits?: string;
  className?: string;
  highlightClassName?: string;
}

/** Escape regex special chars in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build the set of character index ranges to highlight inside `text`.
 * Ranges are merged so overlapping matches render as one highlight.
 */
function buildRanges(
  text: string,
  terms: string[],
  digits?: string,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const lower = text.toLowerCase();

  for (const raw of terms) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    const re = new RegExp(escapeRegex(term), "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      ranges.push([m.index, m.index + m[0].length]);
    }
  }

  // Digits projection: walk chars, build a digit-only string with an index map
  // back to the original positions, then locate the digits substring.
  if (digits && digits.length >= 2) {
    const digitChars: string[] = [];
    const indexMap: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (/\d/.test(text[i])) {
        digitChars.push(text[i]);
        indexMap.push(i);
      }
    }
    const digitStr = digitChars.join("");
    let from = 0;
    while (true) {
      const found = digitStr.indexOf(digits, from);
      if (found === -1) break;
      const startOriginal = indexMap[found];
      const endOriginal = indexMap[found + digits.length - 1] + 1;
      ranges.push([startOriginal, endOriginal]);
      from = found + digits.length;
    }
  }

  if (ranges.length === 0) return ranges;

  // Merge overlapping / adjacent ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= last[1]) {
      last[1] = Math.max(last[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

export function HighlightedText({
  text,
  terms = [],
  digits,
  className,
  highlightClassName = "bg-[hsl(142,70%,45%)]/25 text-foreground rounded-sm px-0.5",
}: Props) {
  const safeText = text ?? "";
  const ranges = useMemo(
    () => buildRanges(safeText, terms, digits),
    [safeText, terms, digits],
  );

  if (ranges.length === 0) {
    return <span className={className}>{safeText}</span>;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], idx) => {
    if (start > cursor) {
      nodes.push(<span key={`t-${idx}`}>{safeText.slice(cursor, start)}</span>);
    }
    nodes.push(
      <mark key={`m-${idx}`} className={highlightClassName}>
        {safeText.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < safeText.length) {
    nodes.push(<span key="t-end">{safeText.slice(cursor)}</span>);
  }

  return <span className={className}>{nodes}</span>;
}
