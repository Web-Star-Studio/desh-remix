import { useState } from "react";
import { Plus, Wifi, Unplug, CheckCircle2 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { type ConnectedPlatform } from "@/hooks/social/useSocialConnections";
import { DynamicIcon } from "./DynamicIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PlatformSectionProps {
  title: string;
  platforms: ConnectedPlatform[];
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  description?: string;
}

export function PlatformSection({ title, platforms, onConnect, onDisconnect, description }: PlatformSectionProps) {
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedPlatform | null>(null);
  const connectedCount = platforms.filter(p => p.connected).length;

  return (
    <>
      <GlassCard size="auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" /> {title}
            {connectedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                <CheckCircle2 className="w-2.5 h-2.5" /> {connectedCount}
              </span>
            )}
          </h3>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {platforms.map((p, i) => (
            <div
              key={p.id}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                p.connected
                  ? "border-emerald-500/20 bg-emerald-500/5 hover:shadow-md"
                  : "border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-primary/20 hover:shadow-sm cursor-pointer"
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => !p.connected && onConnect(p.id)}
            >
              {p.connected && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDisconnectTarget(p); }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Desconectar"
                >
                  <Unplug className="w-3 h-3" />
                </button>
              )}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 hover:scale-110"
                style={{ background: `${p.color}15` }}
              >
                <DynamicIcon name={p.icon} className="w-5 h-5" color={p.color} />
              </div>
              <span className="text-xs font-medium text-foreground text-center leading-tight">{p.name}</span>
              {p.connected ? (
                <div className="text-center">
                  <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 justify-center">
                    <Wifi className="w-3 h-3" /> Ativo
                  </span>
                  {p.email && (
                    <span className="text-[9px] text-muted-foreground block mt-0.5 truncate max-w-[120px]">{p.email}</span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                  <Plus className="w-3 h-3" /> Conectar
                </span>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      <AlertDialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar {disconnectTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A conexão com {disconnectTarget?.name} será removida. Você poderá reconectar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (disconnectTarget) onDisconnect(disconnectTarget.id);
                setDisconnectTarget(null);
              }}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
