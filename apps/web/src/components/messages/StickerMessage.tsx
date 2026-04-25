import { memo } from "react";

interface StickerMessageProps {
  thumbnail?: string;
}

export const StickerMessage = memo(function StickerMessage({ thumbnail }: StickerMessageProps) {
  if (!thumbnail) {
    return (
      <div className="w-[120px] h-[120px] bg-foreground/5 rounded-lg flex items-center justify-center text-2xl">
        🏷️
      </div>
    );
  }

  return (
    <img
      src={thumbnail}
      alt="Sticker"
      className="w-[120px] h-[120px] object-contain"
    />
  );
});
