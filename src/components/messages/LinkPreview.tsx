import { memo } from "react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewProps {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

export const LinkPreview = memo(function LinkPreview({ url, title, description, thumbnail }: LinkPreviewProps) {
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-foreground/10 overflow-hidden hover:bg-foreground/5 transition-colors max-w-[280px] mt-1">
      {thumbnail && (
        <img src={thumbnail} alt="" className="w-full h-[120px] object-cover" />
      )}
      <div className="p-2 space-y-0.5">
        {title && <p className="text-xs font-medium truncate">{title}</p>}
        {description && <p className="text-[10px] text-muted-foreground line-clamp-2">{description}</p>}
        <p className="text-[10px] text-primary flex items-center gap-1">
          <ExternalLink className="w-2.5 h-2.5" /> {domain}
        </p>
      </div>
    </a>
  );
});

// Detect URLs in text
export function extractUrls(text: string): string[] {
  const regex = /https?:\/\/[^\s<>\"'\)]+/gi;
  return text.match(regex) || [];
}
