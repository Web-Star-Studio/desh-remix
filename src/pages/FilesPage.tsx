import { useState, lazy, Suspense } from "react";
import { useGoogleServiceData } from "@/hooks/integrations/useGoogleServiceData";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import ScopeRequestBanner from "@/components/dashboard/ScopeRequestBanner";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import ConnectionBadge from "@/components/dashboard/ConnectionBadge";
import { FolderOpen, HardDrive, ArrowRight, Inbox, Loader2 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const NativeFileExplorer = lazy(() => import("@/components/files/NativeFileExplorer"));
const GoogleDriveExplorer = lazy(() => import("@/components/files/GoogleDriveExplorer"));
const FileInbox = lazy(() => import("@/components/files/FileInbox"));

const TabFallback = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
  </div>
);

const FilesPage = () => {
  const { activeWorkspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState("native");

  const {
    isConnected: driveConnected,
    isLoading: driveLoading,
    error: driveError,
    connectionNames: driveNames,
    needsScope: driveNeedsScope,
    requestScope: driveRequestScope,
  } = useGoogleServiceData<any[]>({
    service: "drive",
    path: "/files",
    params: { pageSize: "1", fields: "files(id)" },
  });

  return (
    <PageLayout maxWidth="7xl">
      <PageHeader
        title="Arquivos"
        icon={<FolderOpen className="w-5 h-5 text-primary" />}
        actions={
          <ConnectionBadge
            isConnected={driveConnected}
            isLoading={driveLoading}
            sourceNames={driveConnected ? driveNames : undefined}
            size="lg"
          />
        }
      />

      {driveNeedsScope && (
        <ScopeRequestBanner service="drive" onRequest={driveRequestScope} />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="native" className="gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" /> Meus Arquivos
          </TabsTrigger>
          <TabsTrigger value="drive" className="gap-1.5">
            <HardDrive className="w-3.5 h-3.5" /> Google Drive
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="w-3.5 h-3.5" /> Inbox
          </TabsTrigger>
        </TabsList>

        <TabsContent value="native">
          <Suspense fallback={<TabFallback />}>
            <NativeFileExplorer />
          </Suspense>
        </TabsContent>

        <TabsContent value="drive">
          {driveConnected ? (
            <Suspense fallback={<TabFallback />}>
              <GoogleDriveExplorer fullPage />
            </Suspense>
          ) : (
            <GlassCard className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <HardDrive className="w-7 h-7 text-primary/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {driveLoading ? "Verificando conexão..." : "Conecte seu armazenamento na nuvem"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                  {driveError
                    ? `Erro: ${driveError}. Tente novamente.`
                    : "Conecte o Google Drive para gerenciar seus arquivos diretamente no Desh."}
                </p>
              </div>
              {!driveLoading && (
                <button
                  onClick={driveRequestScope}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mt-2"
                >
                  Conectar Google Drive <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </GlassCard>
          )}
        </TabsContent>

        <TabsContent value="inbox">
          <Suspense fallback={<TabFallback />}>
            <FileInbox />
          </Suspense>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default FilesPage;
