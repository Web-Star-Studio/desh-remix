import { ExternalLink } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import type { Streamdown } from "streamdown";

// Custom Streamdown component overrides used across the search results
// surfaces (TldrCard, KeyFactsCard, AnswerCard, DeepResearchPanel). Most
// element styling is handled by Streamdown's built-ins; we only override
// where there's behavior worth preserving:
//   - `a` injects an external-link icon next to citation links
//   - `img` adds lazy-loading + zoom-cursor UX
type Components = ComponentPropsWithoutRef<typeof Streamdown>["components"];

export const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
    >
      {children}
      <ExternalLink className="w-3 h-3 inline-block" />
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ""}
      loading="lazy"
      className="rounded-xl max-h-72 object-cover shadow-md hover:shadow-lg transition-shadow cursor-zoom-in"
    />
  ),
};
