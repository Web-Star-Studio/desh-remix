import { useEffect, useState, useRef, useCallback } from "react";
import { Building2, Phone, CheckCircle, AlertCircle, Loader2, Megaphone, FileText, Users, Plus, Link2, RefreshCw } from "lucide-react";
import { useZernioWhatsApp, WABAAccount } from "@/hooks/whatsapp/useZernioWhatsApp";
import { useZernioSyncAccounts } from "@/hooks/whatsapp/useZernioSyncAccounts";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { zernioClient } from "@/services/zernio/client";
import { Button } from "@/components/ui/button";
import WABAConnectionSetup from "./WABAConnectionSetup";

interface Props {
  onAccountReady?: (accountId: string) => void;
}

export default function WhatsAppBusinessOverview({ onAccountReady }: Props) {
  const { getAccounts } = useZernioWhatsApp();
  const { sync, loading: syncing } = useZernioSyncAccounts();
  const { activeWorkspaceId } = useWorkspace();
  const [accounts, setAccounts] = useState<WABAAccount[]>([]);
  const [linkedProfileId, setLinkedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const mountedRef = useRef(true);
  const lastAccountIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      if (activeWorkspaceId) {
        const status = await zernioClient.forWorkspace(activeWorkspaceId).status();
        if (mountedRef.current) setLinkedProfileId(status.profileId);
      } else if (mountedRef.current) {
        setLinkedProfileId(null);
      }

      const res = await getAccounts();
      if (!mountedRef.current) return;
      const waba = (res.data?.accounts || []).filter(a => a.platform === "whatsapp");
      setAccounts(waba);
      // Only notify parent if accountId actually changed
      if (waba.length > 0 && waba[0].accountId !== lastAccountIdRef.current) {
        lastAccountIdRef.current = waba[0].accountId;
        onAccountReady?.(waba[0].accountId);
      }
    } catch (e) {
      console.error("[WABA] Failed to fetch accounts:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getAccounts, onAccountReady, activeWorkspaceId]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSync = useCallback(async () => {
    const result = await sync();
    if (result.data && result.data.synced > 0) {
      await fetchAccounts();
    }
  }, [sync, fetchAccounts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts.length === 0 && !showSetup) {
    // If a Zernio profile is already linked, offer a sync action instead of full setup
    if (linkedProfileId) {
      return (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-[hsl(142,70%,45%)]/10 flex items-center justify-center">
            <Link2 className="w-10 h-10 text-[hsl(142,70%,45%)]" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h2 className="text-xl font-bold text-foreground">Perfil Zernio vinculado</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Profile{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                {linkedProfileId.slice(0, 8)}…
              </code>{" "}
              está provisionado, mas as contas ainda não foram sincronizadas localmente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSync} disabled={syncing} size="lg" className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar contas
            </Button>
            <Button onClick={() => setShowSetup(true)} variant="outline" size="lg" className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-[hsl(142,70%,45%)]/10 flex items-center justify-center">
          <Building2 className="w-10 h-10 text-[hsl(142,70%,45%)]" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-foreground">Conecte seu WhatsApp Business</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use a API oficial do WhatsApp Business para enviar broadcasts, gerenciar templates e contatos com zero risco de bloqueio.
          </p>
        </div>
        <Button onClick={() => setShowSetup(true)} size="lg" className="gap-2">
          <Plus className="w-4 h-4" /> Conectar WABA
        </Button>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Configurar Conexão</h3>
          {accounts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowSetup(false)}>Cancelar</Button>
          )}
        </div>
        <WABAConnectionSetup onConnected={() => { setShowSetup(false); fetchAccounts(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {linkedProfileId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(142,70%,45%)]/8 border border-[hsl(142,70%,45%)]/20 text-xs">
          <Link2 className="w-3.5 h-3.5 text-[hsl(142,70%,45%)] shrink-0" />
          <span className="text-muted-foreground">Conectado ao Zernio profile</span>
          <code className="font-mono text-foreground">{linkedProfileId.slice(0, 8)}…</code>
        </div>
      )}

      {/* Connected accounts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contas Conectadas</h3>
          <div className="flex items-center gap-2">
            {linkedProfileId && (
              <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5 text-xs">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Resincronizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowSetup(true)} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> Nova conta
            </Button>
          </div>
        </div>
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50">
            <div className="w-12 h-12 rounded-xl bg-[hsl(142,70%,45%)]/10 flex items-center justify-center shrink-0">
              <Phone className="w-6 h-6 text-[hsl(142,70%,45%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{acc.name || acc.phoneNumber || acc.accountId}</p>
              <p className="text-xs text-muted-foreground">{acc.phoneNumber || "Número pendente"}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {acc.status === "connected" || acc.status === "active" ? (
                <span className="flex items-center gap-1 text-xs text-[hsl(142,70%,45%)] bg-[hsl(142,70%,45%)]/10 px-2 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Ativo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> {acc.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Megaphone, label: "Broadcasts", sublabel: "Envios em massa", color: "text-primary" },
          { icon: FileText, label: "Templates", sublabel: "Modelos de mensagem", color: "text-amber-500" },
          { icon: Users, label: "Contatos", sublabel: "Gerenciamento CRM", color: "text-blue-500" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-border/50 bg-card/30 text-center space-y-2">
            <s.icon className={`w-6 h-6 mx-auto ${s.color}`} />
            <p className="text-sm font-semibold text-foreground">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.sublabel}</p>
          </div>
        ))}
      </div>
    </div>
  );
}