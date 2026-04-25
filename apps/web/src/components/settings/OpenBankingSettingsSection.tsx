import { Landmark, Loader2, RefreshCw, Trash2, Clock } from "lucide-react";
import { useFinancialConnections } from "@/hooks/finance/useFinance";
import ConnectBankWidget from "@/components/finance/ConnectBankWidget";
import MoveConnectionToWorkspace from "@/components/finance/MoveConnectionToWorkspace";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const OpenBankingSettingsSection = () => {
  const { connections, loading, removeConnection, syncConnection, refresh } = useFinancialConnections();

  return (
    <div className="pt-3 border-t border-foreground/10 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-4 h-4 text-primary/60" />
        <p className="text-sm font-medium text-foreground">Open Banking (Unificado)</p>
        {connections.length > 0 && (
          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
            {connections.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {connections.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-foreground/5 group">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-4 h-4 text-primary/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">
                      {conn.institution_name || "Banco conectado"}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="uppercase font-semibold text-primary/70">{conn.provider}</span>
                      {conn.last_synced_at && (
                        <>
                          <Clock className="w-3 h-3" />
                          <span>{formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true, locale: ptBR })}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    conn.status === "active" ? "bg-green-500/10 text-green-400" :
                    conn.status === "syncing" ? "bg-blue-500/10 text-blue-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>
                    {conn.status === "active" ? "Ativo" : conn.status === "syncing" ? "Sincronizando" : conn.status}
                  </span>
                  <MoveConnectionToWorkspace
                    connectionId={conn.id}
                    currentWorkspaceId={(conn as any).workspace_id}
                    onMoved={() => refresh()}
                  />
                  <button onClick={() => syncConnection(conn)} className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0" title="Sincronizar">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm("Desconectar este banco?")) removeConnection(conn.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <ConnectBankWidget />

          {connections.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Conecte um banco via Pluggy para importar dados automaticamente.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default OpenBankingSettingsSection;
