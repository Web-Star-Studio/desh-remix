import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message?: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}

const ErrorState = ({
  message = "Ocorreu um erro inesperado.",
  detail,
  onRetry,
  className,
}: ErrorStateProps) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 py-8 text-center", className)}>
    <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center">
      <AlertTriangle className="w-5 h-5 text-destructive/70" />
    </div>
    <div>
      <p className="text-sm font-medium text-foreground/80">{message}</p>
      {detail && (
        <p className="text-xs text-muted-foreground max-w-[260px] mt-0.5 leading-relaxed">{detail}</p>
      )}
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Tentar novamente
      </button>
    )}
  </div>
);

export default ErrorState;
