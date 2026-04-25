import { WifiOff, ArrowRight, Sparkles } from "lucide-react";
import { getSocialPlatforms, getAdsPlatforms, getAnalyticsPlatforms } from "@/lib/social-integrations";
import { DynamicIcon } from "./DynamicIcon";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: 'social' | 'ads' | 'analytics';
  onGoToAccounts?: () => void;
}

export function EmptyState({ type, onGoToAccounts }: EmptyStateProps) {
  const platforms = type === 'social'
    ? getSocialPlatforms().slice(0, 5)
    : type === 'ads'
    ? getAdsPlatforms().slice(0, 4)
    : getAnalyticsPlatforms();

  const title = type === 'social'
    ? "Conecte suas redes sociais"
    : type === 'ads'
    ? "Conecte suas plataformas de anúncios"
    : "Conecte o Google Analytics";

  const subtitle = type === 'social'
    ? "Monitore seguidores, engajamento e posts em um só lugar."
    : type === 'ads'
    ? "Acompanhe gastos, ROAS e campanhas de todas as plataformas."
    : "Visualize visitantes, pageviews e fontes de tráfego.";

  return (
    <div className="flex flex-col items-center py-20 px-4">
      {/* Animated icon area */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center animate-in zoom-in-75 duration-500">
          <WifiOff className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center animate-bounce">
          <Sparkles className="w-3 h-3 text-primary" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">{subtitle}</p>

      <div className="flex flex-wrap justify-center gap-3 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300">
        {platforms.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-foreground/10 hover:shadow-sm transition-all duration-300 cursor-default"
            style={{ animationDelay: `${300 + i * 80}ms` }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: p.color + '15' }}>
              <DynamicIcon name={p.icon} className="w-3.5 h-3.5" color={p.color} />
            </div>
            <span className="text-xs font-medium text-foreground">{p.name}</span>
          </div>
        ))}
      </div>

      {onGoToAccounts && (
        <Button
          onClick={onGoToAccounts}
          size="sm"
          className="gap-2 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-500"
        >
          Conectar Contas <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
