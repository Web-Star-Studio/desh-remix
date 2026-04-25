import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";

const COMPOSIO_GOOGLE_SERVICES = [
  { toolkit: "gmail", label: "Gmail", icon: "📧" },
  { toolkit: "googlecalendar", label: "Google Calendar", icon: "📅" },
  { toolkit: "googletasks", label: "Google Tasks", icon: "✅" },
  { toolkit: "googlecontacts", label: "Google Contatos", icon: "👤" },
  { toolkit: "googledrive", label: "Google Drive", icon: "📁" },
] as const;

const GoogleStatusPanel = () => {
  const { isConnected, connectToolkit, loading } = useComposioConnection();
  const navigate = useNavigate();

  const connectedCount = COMPOSIO_GOOGLE_SERVICES.filter(s => isConnected(s.toolkit)).length;
  const hasAny = connectedCount > 0;

  return (
    <div className="pt-3 border-t border-foreground/10 mt-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <p className="text-sm font-medium text-foreground">Status Google</p>
          {hasAny && (
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
              {connectedCount}/{COMPOSIO_GOOGLE_SERVICES.length}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : !hasAny ? (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">Nenhum serviço Google conectado.</p>
          <button onClick={() => navigate("/integrations")}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Conectar Google
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-1 gap-1">
            {COMPOSIO_GOOGLE_SERVICES.map(svc => {
              const connected = isConnected(svc.toolkit);
              return (
                <div key={svc.toolkit} className="flex items-center gap-2.5 p-2 rounded-lg bg-foreground/5">
                  <span className="text-sm">{svc.icon}</span>
                  <span className="flex-1 text-xs font-medium text-foreground">{svc.label}</span>
                  {connected ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> Ativo
                    </span>
                  ) : (
                    <button onClick={() => connectToolkit(svc.toolkit)}
                      className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-primary transition-colors">
                      <AlertCircle className="w-3 h-3" /> Ativar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleStatusPanel;
