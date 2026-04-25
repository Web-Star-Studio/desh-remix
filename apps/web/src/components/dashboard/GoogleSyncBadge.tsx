import { RefreshCw } from "lucide-react";

interface GoogleSyncBadgeProps {
  /** "synced" = local item pushed to Google, "from-google" = item originated from Google */
  variant?: "synced" | "from-google";
  className?: string;
}

const GoogleSyncBadge = ({ variant = "synced", className = "" }: GoogleSyncBadgeProps) => (
  <span
    className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
      variant === "from-google"
        ? "bg-blue-500/10 text-blue-400"
        : "bg-green-500/10 text-green-400"
    } ${className}`}
    title={variant === "from-google" ? "Importado do Google" : "Sincronizado com Google"}
  >
    <RefreshCw className="w-2.5 h-2.5" />
    {variant === "from-google" ? "Google" : "Sync"}
  </span>
);

export default GoogleSyncBadge;
