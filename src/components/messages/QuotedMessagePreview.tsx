import { memo } from "react";
import { X } from "lucide-react";

interface QuotedMessagePreviewProps {
  senderName: string;
  text: string;
  onClear?: () => void;
  compact?: boolean;
}

export const QuotedMessagePreview = memo(function QuotedMessagePreview({
  senderName, text, onClear, compact,
}: QuotedMessagePreviewProps) {
  return (
    <div className={`flex items-start gap-2 ${compact ? "py-0.5" : "p-2 bg-foreground/5 rounded-lg"}`}>
      <div className="w-1 rounded-full bg-primary flex-shrink-0 self-stretch min-h-[20px]" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-primary">{senderName}</p>
        <p className="text-xs text-muted-foreground truncate">{text}</p>
      </div>
      {onClear && (
        <button onClick={onClear} className="p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});
