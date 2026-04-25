/**
 * DeliveryStatusBadge — visual badge for WhatsApp message delivery state.
 * Colors are theme-token driven (no hard-coded HSL).
 */
import { Badge } from "@/components/ui/badge";
import { Check, CheckCheck, Eye, AlertTriangle, Clock } from "lucide-react";
import type { DeliveryStatus } from "@/hooks/whatsapp/useWhatsAppSendLogs";
import { cn } from "@/lib/utils";

interface Props {
  status: DeliveryStatus | null;
  /** Hide label text on small screens */
  compact?: boolean;
}

const META: Record<
  DeliveryStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  queued: {
    label: "Na fila",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  },
  sent: {
    label: "Enviada",
    icon: Check,
    className: "bg-muted/50 text-foreground/80 border-border",
  },
  delivered: {
    label: "Entregue",
    icon: CheckCheck,
    className:
      "bg-[hsl(220,80%,50%)]/10 text-[hsl(220,80%,55%)] border-[hsl(220,80%,50%)]/30",
  },
  read: {
    label: "Lida",
    icon: Eye,
    className:
      "bg-[hsl(142,70%,45%)]/10 text-[hsl(142,70%,45%)] border-[hsl(142,70%,45%)]/30",
  },
  failed: {
    label: "Falhou",
    icon: AlertTriangle,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export function DeliveryStatusBadge({ status, compact = false }: Props) {
  const meta = META[status ?? "sent"];
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium tracking-tight px-2 py-0.5 text-[11px]",
        meta.className,
      )}
    >
      <Icon className="w-3 h-3" />
      {!compact && <span>{meta.label}</span>}
    </Badge>
  );
}
