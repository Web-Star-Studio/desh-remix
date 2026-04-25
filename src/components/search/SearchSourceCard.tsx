import { memo } from "react";
import { ExternalLink } from "lucide-react";
import SourceReliabilityBadge from "./SourceReliabilityBadge";

interface SearchSourceCardProps {
  url: string;
  index: number;
}

const SearchSourceCard = memo(({ url, index }: SearchSourceCardProps) => {
  const getDomain = (u: string) => {
    try {
      return new URL(u).hostname.replace("www.", "");
    } catch {
      return u;
    }
  };

  const getTitle = (u: string) => {
    try {
      const parsed = new URL(u);
      const pathParts = parsed.pathname
        .split("/")
        .filter(Boolean)
        .map(p => decodeURIComponent(p).replace(/[-_]/g, " "));
      if (pathParts.length > 0) {
        const last = pathParts[pathParts.length - 1];
        const clean = last.replace(/\.\w+$/, "");
        if (clean.length > 3) {
          return clean.charAt(0).toUpperCase() + clean.slice(1);
        }
      }
      const domain = getDomain(u);
      return domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
    } catch {
      return url.slice(0, 40);
    }
  };

  const domain = getDomain(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-all group border border-transparent hover:border-foreground/10"
    >
      <img
        src={faviconUrl}
        alt={domain}
        className="w-6 h-6 rounded-md flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{getTitle(url)}</p>
          <SourceReliabilityBadge url={url} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{domain}</p>
      </div>
      <span className="text-xs text-muted-foreground/60 font-mono">{index + 1}</span>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </a>
  );
});

SearchSourceCard.displayName = "SearchSourceCard";

export default SearchSourceCard;
