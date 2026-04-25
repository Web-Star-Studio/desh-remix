import { memo } from "react";
import { User, Phone, UserPlus } from "lucide-react";

interface ContactCardMessageProps {
  displayName: string;
  phoneNumber?: string;
  onSaveToCRM?: () => void;
}

export const ContactCardMessage = memo(function ContactCardMessage({ displayName, phoneNumber, onSaveToCRM }: ContactCardMessageProps) {
  return (
    <div className="rounded-lg border border-foreground/10 p-3 min-w-[200px] space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{displayName}</p>
          {phoneNumber && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Phone className="w-2.5 h-2.5" /> {phoneNumber}
            </p>
          )}
        </div>
      </div>
      {onSaveToCRM && (
        <button
          onClick={onSaveToCRM}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg py-1.5 transition-colors border border-primary/20"
        >
          <UserPlus className="w-3 h-3" /> Salvar no CRM
        </button>
      )}
    </div>
  );
});
