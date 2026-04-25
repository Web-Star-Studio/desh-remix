import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComposioErrorAlertProps {
  service: string;
  error: string | null;
  onRetry?: () => void;
}

const SERVICE_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Google Calendar",
  tasks: "Google Tasks",
  drive: "Google Drive",
  people: "Contatos",
};

export default function ComposioErrorAlert({ service, error, onRetry }: ComposioErrorAlertProps) {
  if (!error) return null;

  const isNotConnected = error.includes("NOT_CONNECTED");
  const isTokenExpired = error.includes("TOKEN_EXPIRED");
  const label = SERVICE_LABELS[service] || service;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
        {isNotConnected ? (
          <WifiOff className="w-6 h-6 text-destructive/70" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-destructive/70" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          {isNotConnected
            ? `${label} não conectado`
            : isTokenExpired
              ? `Sessão do ${label} expirada`
              : `Erro ao carregar ${label}`}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
          {isNotConnected
            ? `Conecte ${label} na página de Integrações para acessar seus dados.`
            : isTokenExpired
              ? "Reconecte o serviço para continuar."
              : "O serviço pode estar temporariamente indisponível. Tente novamente."}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
