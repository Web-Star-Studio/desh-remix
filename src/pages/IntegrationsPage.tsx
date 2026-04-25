import { useEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useComposioConnection } from "@/hooks/integrations/useComposioConnection";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Calendar, HardDrive, CheckSquare,
  RefreshCw, Puzzle, MessageSquare, Landmark, Share2, ExternalLink, Loader2,
} from "lucide-react";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { IntegrationServiceCard } from "@/components/integrations/IntegrationServiceCard";
import { IntegrationsProgressBar } from "@/components/integrations/IntegrationsProgressBar";
import { IntegrationsLoadingSkeleton } from "@/components/integrations/IntegrationsLoadingSkeleton";
import {
  getConnectionQueue,
  advanceQueue,
  clearConnectionQueue,
  type ConnectionQueue,
} from "@/lib/google-connection-queue";

// Lazy load heavy modal (359 lines, only shown on demand)
const GoogleBulkConnectModal = lazy(() =>
  import("@/components/integrations/GoogleBulkConnectModal").then(m => ({ default: m.GoogleBulkConnectModal }))
);

const CORE_GOOGLE_ITEMS = [
  { toolkit: "gmail", name: "Gmail", icon: Mail, description: "Emails, inbox e envio de mensagens", redirect: "/email" },
  { toolkit: "googlecalendar", name: "Google Calendar", icon: Calendar, description: "Eventos, agenda e lembretes", redirect: "/calendar" },
  { toolkit: "googledrive", name: "Google Drive", icon: HardDrive, description: "Arquivos e pastas na nuvem" },
  { toolkit: "googletasks", name: "Google Tasks", icon: CheckSquare, description: "Tarefas e listas", redirect: "/tasks" },
  { toolkit: "googlecontacts", name: "Google Contacts", icon: MessageSquare, description: "Contatos sincronizados" },
];

const EXTERNAL_ITEMS = [
  { id: "whatsapp", name: "WhatsApp", icon: MessageSquare, description: "Gerenciado em Configurações > WhatsApp", link: "/settings" },
  { id: "openbanking", name: "Open Banking (Pluggy)", icon: Landmark, description: "Gerenciado em Configurações > Conexões", link: "/settings" },
  { id: "social", name: "Redes Sociais & Ads", icon: Share2, description: "Monitoramento via Composio", link: "/social" },
];

const ALL_CORE = CORE_GOOGLE_ITEMS;

export default function IntegrationsPage() {
  const {
    connections, loading, isConnected,
    getConnectUrl, connectToolkit, disconnectToolkit,
    handleComposioCallback, fetchConnections,
  } = useComposioConnection();
  const { activeWorkspace, defaultWorkspace } = useWorkspace();
  const currentWorkspace = activeWorkspace || defaultWorkspace;
  const { toast } = useToast();
  const navigate = useNavigate();

  const [connecting, setConnecting] = useState<string | null>(null);
  const [callbackProcessed, setCallbackProcessed] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [resumeQueue, setResumeQueue] = useState<ConnectionQueue | null>(null);

  // Handle OAuth callback + queue resumption
  useEffect(() => {
    if (callbackProcessed) return;

    const params = new URLSearchParams(window.location.search);
    const isCallback = params.get("composio_callback") === "true";

    if (!isCallback) return;

    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
    setCallbackProcessed(true);

    // Wait for connections to refresh, then check queue
    const processCallback = async () => {
      await new Promise((r) => setTimeout(r, 2000));
      await fetchConnections();

      const queue = getConnectionQueue();
      if (queue) {
        await new Promise((r) => setTimeout(r, 500));

        const currentToolkit = queue.toolkits[queue.currentIndex];
        const connected = isConnected(currentToolkit);
        const updated = advanceQueue(connected);

        if (updated) {
          setResumeQueue({ ...updated });
          setShowBulkModal(true);
        }
      }
    };

    processCallback();
  }, [callbackProcessed, fetchConnections, isConnected]);

  // Re-check queue after connections update
  const queueCheckRef = useRef(false);
  useEffect(() => {
    if (queueCheckRef.current || !callbackProcessed) return;

    const queue = getConnectionQueue();
    if (queue && !showBulkModal) {
      const currentToolkit = queue.toolkits[queue.currentIndex];
      if (currentToolkit) {
        const connected = isConnected(currentToolkit);
        const updated = advanceQueue(connected);
        if (updated) {
          queueCheckRef.current = true;
          setResumeQueue({ ...updated });
          setShowBulkModal(true);
        }
      }
    }
  }, [connections, callbackProcessed, isConnected, showBulkModal]);

  const prevConnectionsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentConnected = connections
      .filter(c => c.status === "ACTIVE")
      .map(c => c.toolkit);

    const newlyConnected = currentConnected.filter(
      t => !prevConnectionsRef.current.includes(t)
    );
    const newlyDisconnected = prevConnectionsRef.current.filter(
      t => !currentConnected.includes(t)
    );

    const queue = getConnectionQueue();
    if (!queue) {
      if (newlyConnected.length > 0 && prevConnectionsRef.current.length > 0) {
        newlyConnected.forEach(toolkit => {
          const item = ALL_CORE.find(i => i.toolkit === toolkit);
          toast({
            title: `${item?.name || toolkit} conectado!`,
            description: `Carregando dados do ${item?.name || toolkit}...`,
          });
          const redirect = item && "redirect" in item ? (item as any).redirect : null;
          if (redirect) {
            setTimeout(() => navigate(redirect), 1500);
          }
        });
      }

      if (newlyDisconnected.length > 0) {
        newlyDisconnected.forEach(toolkit => {
          const item = ALL_CORE.find(i => i.toolkit === toolkit);
          toast({
            title: `${item?.name || toolkit} desconectado`,
            description: "Os dados do serviço foram removidos localmente.",
          });
        });
      }
    }

    prevConnectionsRef.current = currentConnected;
    setConnecting(null);
  }, [connections, toast, navigate]);

  const connectedCount = useMemo(
    () => ALL_CORE.filter(i => isConnected(i.toolkit)).length,
    [connections, isConnected] // eslint-disable-line
  );

  const handleConnect = useCallback(async (toolkit: string) => {
    setConnecting(toolkit);
    try {
      await connectToolkit(toolkit);
    } catch {
      setConnecting(null);
    }
  }, [connectToolkit]);

  const handleDisconnect = useCallback(async (toolkit: string) => {
    setConnecting(toolkit);
    try {
      await disconnectToolkit(toolkit);
    } finally {
      setConnecting(null);
    }
  }, [disconnectToolkit]);

  const handleBulkModalClose = useCallback(() => {
    setShowBulkModal(false);
    setResumeQueue(null);
    fetchConnections();
  }, [fetchConnections]);

  const handleQueueFinished = useCallback(() => fetchConnections(), [fetchConnections]);

  const hasUnconnectedGoogle = useMemo(
    () => CORE_GOOGLE_ITEMS.some(i => !isConnected(i.toolkit)),
    [connections, isConnected] // eslint-disable-line
  );

  const isInitialLoad = loading && connections.length === 0;
  const isRefreshing = loading && connections.length > 0;

  return (
    <PageLayout maxWidth="5xl">
      {/* Top indeterminate progress strip */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50 overflow-hidden bg-primary/10">
          <div className="h-full w-1/3 bg-primary/60 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      )}

      <PageHeader
        title="Integrações"
        icon={<Puzzle className="w-6 h-6 text-primary drop-shadow" />}
        subtitle="Conecte seus apps e deixe a Pandora agir em seu nome"
        actions={
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1.5 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Atualizando...
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchConnections()}
              disabled={loading}
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {currentWorkspace && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs">
            <span className="mr-1">{currentWorkspace.icon}</span>
            Integrações do workspace: {currentWorkspace.name}
          </Badge>
        </div>
      )}

      <IntegrationsProgressBar
        connectedCount={connectedCount}
        totalCount={ALL_CORE.length}
        loading={loading}
      />

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Google Workspace
        </h2>

        {hasUnconnectedGoogle && (
          <button
            onClick={() => { setResumeQueue(null); setShowBulkModal(true); }}
            disabled={!!getConnectionQueue()}
            className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-4 text-left disabled:opacity-50"
          >
            <span className="text-xl">⚡</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Conectar Google de uma vez</p>
              <p className="text-xs text-muted-foreground">Selecione e autorize cada serviço sequencialmente</p>
            </div>
          </button>
        )}

        {isInitialLoad ? (
          <IntegrationsLoadingSkeleton />
        ) : (
          <div className="grid gap-2">
            {CORE_GOOGLE_ITEMS.map((integration, idx) => (
              <AnimatedItem key={integration.toolkit} index={idx}>
                <IntegrationServiceCard
                  toolkit={integration.toolkit}
                  name={integration.name}
                  icon={integration.icon}
                  description={integration.description}
                  connected={isConnected(integration.toolkit)}
                  accountEmail={connections.find(c => c.toolkit === integration.toolkit)?.email}
                  connectedAt={connections.find(c => c.toolkit === integration.toolkit)?.connectedAt}
                  isLoading={connecting === integration.toolkit}
                  disabled={loading}
                  globalLoading={isRefreshing}
                  onConnect={() => handleConnect(integration.toolkit)}
                  onDisconnect={() => handleDisconnect(integration.toolkit)}
                  onReconnect={() => handleConnect(integration.toolkit)}
                />
              </AnimatedItem>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Disponíveis
        </h2>
        <div className="grid gap-2">
          {EXTERNAL_ITEMS.map((item, idx) => (
            <AnimatedItem key={item.id} index={CORE_GOOGLE_ITEMS.length + idx}>
              <button
                onClick={() => navigate(item.link)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-foreground/[0.03] border border-foreground/5 hover:border-foreground/10 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </AnimatedItem>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/30 bg-background/60 backdrop-blur-sm p-4 mt-4">
        <p className="text-xs text-muted-foreground">
          <strong>WhatsApp</strong> e{" "}
          <strong>Open Banking</strong> são gerenciados
          separadamente nas configurações da Pandora.
        </p>
      </div>

      {showBulkModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
          <GoogleBulkConnectModal
            open={showBulkModal}
            onClose={handleBulkModalClose}
            isConnected={isConnected}
            getConnectUrl={getConnectUrl}
            onQueueFinished={handleQueueFinished}
            resumeQueue={resumeQueue}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
