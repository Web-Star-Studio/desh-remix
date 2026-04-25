import { memo, useState, useCallback } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { SmilePlus } from "lucide-react";

const EMOJI_CATEGORIES = [
  { label: "😊", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒","🙄","😬","😮‍💨","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐"] },
  { label: "👍", emojis: ["👍","👎","👊","✊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐","🖖","👋","🤏","💪","🦾","🖕","✍️"] },
  { label: "❤️", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","🫶","💯","💢","💥","💫","💦","💨","🕳","💣","💬","👁‍🗨","🗨","🗯","💭"] },
  { label: "🎉", emojis: ["🎉","🎊","🎈","🎁","🎀","🎗","🏆","🥇","🥈","🥉","⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🥍","🏑","🥅","⛳","🏹","🎣","🤿","🥊","🥋"] },
  { label: "🍕", emojis: ["🍕","🍔","🍟","🌭","🥪","🌮","🌯","🫔","🥙","🧆","🥚","🍳","🥘","🍲","🫕","🥣","🥗","🍿","🧈","🧂","🥫","🍱","🍘","🍙","🍚","🍛","🍜","🍝","🍠","🍢","🍣","🍤","🍥","🥮","🍡"] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
}

export const EmojiPicker = memo(function EmojiPicker({ onSelect, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  }, [onSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <DeshTooltip label="Emoji">
            <button className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <SmilePlus className="w-4 h-4" />
            </button>
          </DeshTooltip>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[280px] p-0 bg-background border border-foreground/10">
        <div className="flex border-b border-foreground/5">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button key={i} onClick={() => setTab(i)} className={`flex-1 p-2 text-sm hover:bg-foreground/5 ${tab === i ? "bg-foreground/10" : ""}`}>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
          {EMOJI_CATEGORIES[tab].emojis.map(emoji => (
            <button key={emoji} onClick={() => handleSelect(emoji)} className="p-1 text-lg hover:bg-foreground/10 rounded transition-colors">
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
});

// Quick reaction picker (inline)
interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
}

const QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🙏"];

export const ReactionPicker = memo(function ReactionPicker({ onSelect }: ReactionPickerProps) {
  return (
    <div className="flex items-center gap-0.5 p-1 bg-background rounded-full shadow-lg border border-foreground/10">
      {QUICK_REACTIONS.map(emoji => (
        <button key={emoji} onClick={() => onSelect(emoji)} className="p-1.5 text-base hover:bg-foreground/10 rounded-full transition-colors hover:scale-125">
          {emoji}
        </button>
      ))}
    </div>
  );
});
