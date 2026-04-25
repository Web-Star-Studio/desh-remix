import { useState } from "react";
import GlassCard from "@/components/dashboard/GlassCard";
import { Shield, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { PluggyConsent, PluggyItemStatus } from "@/hooks/finance/usePluggyInsights";

interface Props {
  connections: Array<{ id: string; provider_connection_id: string; institution_name: string | null; status: string }>;
  onFetchConsents: (itemId: string) => Promise<any[]>;
  onRevokeConsent: (itemId: string) => Promise<any>;
  onFetchItemStatus: (itemId: string) => Promise<PluggyItemStatus | null>;
  fetching: boolean;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  ACTIVE: { icon: CheckCircle2, color: "text-green-500", label: "Ativo" },
  UPDATING: { icon: Loader2, color: "text-yellow-500", label: "Atualizando" },
  WAITING_USER_INPUT: { icon: Clock, color: "text-orange-500", label: "Aguardando" },
  LOGIN_ERROR: { icon: XCircle, color: "text-red-500", label: "Erro Login" },
  OUTDATED: { icon: AlertTriangle, color: "text-yellow-500", label: "Desatualizado" },
};

export default function ConsentManager({ connections, onFetchConsents, onRevokeConsent, onFetchItemStatus, fetching }: Props) {
  const [consents, setConsents] = useState<Record<string, any[]>>({});
  const [itemStatuses, setItemStatuses] = useState<Record<string, PluggyItemStatus>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  if (connections.length === 0) return null;

  const loadStatus = async (conn: typeof connections[0]) => {
    setLoadingId(conn.id);
    const [status, consentList] = await Promise.all([
      onFetchItemStatus(conn.provider_connection_id),
      onFetchConsents(conn.provider_connection_id),
    ]);
    if (status) setItemStatuses(prev => ({ ...prev, [conn.id]: status }));
    setConsents(prev => ({ ...prev, [conn.id]: consentList }));
    setLoadingId(null);
  };

  const handleRevoke = async (conn: typeof connections[0]) => {
    setLoadingId(conn.id);
    await onRevokeConsent(conn.provider_connection_id);
    setConfirmRevoke(null);
    setLoadingId(null);
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground text-base">Consentimentos & Status</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Gerencie suas conexões Open Finance e consentimentos LGPD.
      </p>

      <div className="space-y-3">
        {connections.map(conn => {
          const status = itemStatuses[conn.id];
          const statusInfo = status ? statusConfig[status.status] || statusConfig.ACTIVE : null;
          const consentList = consents[conn.id] || [];
          const isLoading = loadingId === conn.id;

          return (
            <div key={conn.id} className="border border-border/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {conn.institution_name || "Instituição"}
                  </span>
                  {statusInfo && (
                    <span className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
                      <statusInfo.icon className={`w-3 h-3 ${status?.status === 'UPDATING' ? 'animate-spin' : ''}`} />
                      {statusInfo.label}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => loadStatus(conn)}
                  disabled={isLoading || fetching}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Item details */}
              {status && (
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Execução: <span className="text-foreground">{status.executionStatus || "—"}</span></div>
                  <div>Atualizado: <span className="text-foreground">
                    {status.lastUpdatedAt ? new Date(status.lastUpdatedAt).toLocaleDateString("pt-BR") : "—"}
                  </span></div>
                  {status.connector && (
                    <div className="col-span-2">Conector: <span className="text-foreground">{status.connector.name || "—"}</span></div>
                  )}
                  {status.warnings && status.warnings.length > 0 && (
                    <div className="col-span-2 text-yellow-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {status.warnings.length} aviso(s)
                    </div>
                  )}
                </div>
              )}

              {/* Consent info */}
              {consentList.length > 0 && (
                <div className="text-xs space-y-1">
                  {consentList.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-muted-foreground">
                      <span>Consentimento {c.status || "ativo"}</span>
                      <span>{c.expiresAt ? `Expira: ${new Date(c.expiresAt).toLocaleDateString("pt-BR")}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Revoke button */}
              {confirmRevoke === conn.id ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-destructive">Revogar e desconectar?</span>
                  <button onClick={() => handleRevoke(conn)} disabled={isLoading}
                    className="px-2 py-1 bg-destructive/20 text-destructive rounded hover:bg-destructive/30 transition-colors disabled:opacity-50">
                    Confirmar
                  </button>
                  <button onClick={() => setConfirmRevoke(null)}
                    className="px-2 py-1 bg-muted/50 text-muted-foreground rounded hover:bg-muted/80 transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRevoke(conn.id)}
                  className="text-xs text-destructive/70 hover:text-destructive transition-colors"
                >
                  Revogar consentimento
                </button>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
