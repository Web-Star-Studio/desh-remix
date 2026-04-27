import React, { Suspense } from "react";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { ConnectionsProvider } from "@/contexts/ConnectionsContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { PlatformIntegrationsProvider } from "@/contexts/PlatformIntegrationsContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { WhatsappSessionProvider } from "@/contexts/WhatsappSessionContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { PageMetaProvider, useCurrentPageMeta } from "@/contexts/PageMetaContext";
import { WidgetLayoutProvider } from "@/hooks/ui/useWidgetLayout";
import AuthPage from "./pages/AuthPage";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import SyncIndicator from "@/components/dashboard/SyncIndicator";
import SideNav from "@/components/dashboard/SideNav";
import GlobalSearchBar from "@/components/dashboard/GlobalSearchBar";
import HeaderActions from "@/components/dashboard/HeaderActions";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import ChunkErrorBoundary from "@/components/ui/ChunkErrorBoundary";
import RouteWrapper from "@/components/ui/RouteWrapper";

// AIChatWidget temporarily removed — its data layer (Supabase chat function +
// useAIToolExecution) was deleted as part of the Hermes migration. The /ai page
// provides the chat surface in the meantime; a Hermes-wired floating widget
// will return in a follow-up PR.
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";
import DeshLoadingScreen from "@/components/ui/DeshLoadingScreen";
import RouteAwareSuspense from "@/components/ui/RouteAwareSuspense";
import { useCreditErrorListener } from "@/hooks/common/useCreditError";
import { useErrorReporter } from "@/hooks/common/useErrorReporter";
import { useZernioHealthCheck } from "@/hooks/whatsapp/useZernioHealthCheck";
const UpgradeModal = lazyWithRetry(() => import("@/components/billing/UpgradeModal"), "UpgradeModal");
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import PWARegisterErrorBanner from "@/components/PWARegisterErrorBanner";

const Index = lazyWithRetry(() => import("./pages/Index"), "Index");
const SearchPage = lazyWithRetry(() => import("./pages/SearchPage"), "SearchPage");
const CalendarPage = lazyWithRetry(() => import("./pages/CalendarPage"), "CalendarPage");
const WidgetsPage = lazyWithRetry(() => import("./pages/WidgetsPage"), "WidgetsPage");
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"), "SettingsPage");
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"), "ProfilePage");
const AdminPage = lazyWithRetry(() => import("./pages/AdminPage"), "AdminPage");
const EmailPage = lazyWithRetry(() => import("./pages/EmailPage"), "EmailPage");
const MessagesPage = lazyWithRetry(() => import("./pages/MessagesPage"), "MessagesPage");
const FilesPage = lazyWithRetry(() => import("./pages/FilesPage"), "FilesPage");
const NotesPage = lazyWithRetry(() => import("./pages/NotesPage"), "NotesPage");
const TasksPage = lazyWithRetry(() => import("./pages/TasksPage"), "TasksPage");
const ContactsPage = lazyWithRetry(() => import("./pages/ContactsPage"), "ContactsPage");
const FinancesPage = lazyWithRetry(() => import("./pages/FinancesPage"), "FinancesPage");
const AIPage = lazyWithRetry(() => import("./pages/AIPage"), "AIPage");
const NotificationsPage = lazyWithRetry(() => import("./pages/NotificationsPage"), "NotificationsPage");
const InboxPage = lazyWithRetry(() => import("./pages/InboxPage"), "InboxPage");

const PrivacyPage = lazyWithRetry(() => import("./pages/PrivacyPage"), "PrivacyPage");
const TermsPage = lazyWithRetry(() => import("./pages/TermsPage"), "TermsPage");
const AutomationsPage = lazyWithRetry(() => import("./pages/AutomationsPage"), "AutomationsPage");
const WhatsappSettingsPage = lazyWithRetry(() => import("./pages/WhatsappSettingsPage"), "WhatsappSettingsPage");
const PricingPage = lazyWithRetry(() => import("./pages/PricingPage"), "PricingPage");
const BillingPage = lazyWithRetry(() => import("./pages/BillingPage"), "BillingPage");
const ActivityLogsPage = lazyWithRetry(() => import("./pages/ActivityLogsPage"), "ActivityLogsPage");
const WelcomePage = lazyWithRetry(() => import("./pages/WelcomePage"), "WelcomePage");
const ModulesPage = lazyWithRetry(() => import("./pages/ModulesPage"), "ModulesPage");
const PandoraPage = lazyWithRetry(() => import("./pages/PandoraPage"), "PandoraPage");
const BlogPage = lazyWithRetry(() => import("./pages/BlogPage"), "BlogPage");
const BlogPostPage = lazyWithRetry(() => import("./pages/BlogPostPage"), "BlogPostPage");
const BlogCategoryPage = lazyWithRetry(() => import("./pages/BlogCategoryPage"), "BlogCategoryPage");
const BlogAdminPage = lazyWithRetry(() => import("./pages/BlogAdminPage"), "BlogAdminPage");
const BlogEditPage = lazyWithRetry(() => import("./pages/BlogEditPage"), "BlogEditPage");
const WorkspacesPage = lazyWithRetry(() => import("./pages/WorkspacesPage"), "WorkspacesPage");
const SocialPage = lazyWithRetry(() => import("./pages/SocialPage"), "SocialPage");
const WhatsappBusinessPage = lazyWithRetry(() => import("./pages/WhatsappBusinessPage"), "WhatsappBusinessPage");
const WhatsappHistoryPage = lazyWithRetry(() => import("./pages/WhatsappHistoryPage"), "WhatsappHistoryPage");
const IntegrationsPage = lazyWithRetry(() => import("./pages/IntegrationsPage"), "IntegrationsPage");
const SharedFilePage = lazyWithRetry(() => import("./pages/SharedFilePage"), "SharedFilePage");
const PandoraDebugPage = lazyWithRetry(() => import("./pages/PandoraDebugPage"), "PandoraDebugPage");
const PreDeployCheckPage = lazyWithRetry(() => import("./pages/PreDeployCheckPage"), "PreDeployCheckPage");
const DataResetPage = lazyWithRetry(() => import("./pages/DataResetPage"), "DataResetPage");
const NotFound = lazyWithRetry(() => import("./pages/NotFound"), "NotFound");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,   // 10 min — aggressive SWR
      gcTime: 30 * 60 * 1000,      // 30 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <DeshLoadingScreen />;
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <DeshLoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/welcome" replace />;
};

const pageVariants = {
  initial: { opacity: 0, x: 6 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -6 },
};

/**
 * Shell-level top bar. Reads the current page's meta from PageMetaContext and
 * renders a single horizontal row:
 *
 *     <PAGE TITLE>      [SEARCH BAR]  <WORKSPACE CREDITS … PROFILE>
 *
 * No background, no border, no backdrop-blur — it floats over the wallpaper
 * just like the rest of the dashboard chrome. Items are vertically centered.
 */
const ShellTopBar = () => {
  const meta = useCurrentPageMeta();
  return (
    <header className="shrink-0 flex items-center gap-3 sm:gap-4 px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 pb-3 min-w-0">
      {/* Title block — left, shrinks with truncate */}
      <div className="min-w-0 shrink">
        <h1 className="text-lg sm:text-xl md:text-2xl font-sans font-semibold text-overlay truncate leading-tight">
          {meta.title}
        </h1>
        {meta.subtitle && (
          <p className="text-xs sm:text-sm text-overlay-muted truncate leading-tight mt-0.5">
            {meta.subtitle}
          </p>
        )}
      </div>
      {/* Spacer pushes the search/buttons cluster to the right */}
      <div className="flex-1" aria-hidden />
      {/* Right cluster — search, then HeaderActions (workspace + credits + …) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        {!meta.hideSearch && (
          <div className="hidden sm:block w-full max-w-md min-w-[180px]">
            <GlobalSearchBar />
          </div>
        )}
        {!meta.hideHeaderActions && <HeaderActions />}
      </div>
    </header>
  );
};

const AnimatedDashboardRoutes = () => {
  const location = useLocation();
  return (
    <WidgetLayoutProvider>
    {/* Fixed shell: SideNav (rounded card on the left) + a column with the
        shell top bar above and a rounded main-content card below. Only the
        main card scrolls internally; everything else stays put. */}
    <div className="flex h-screen w-full overflow-hidden no-select">
      <SideNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <ShellTopBar />
        <main className="flex-1 min-h-0 overflow-hidden isolate">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="h-full overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)] md:pb-0"
            >
            <Routes location={location}>
              <Route path="/dashboard" element={<RouteWrapper page="dashboard" label="Dashboard"><Index /></RouteWrapper>} />
              <Route path="/connections" element={<RouteWrapper page="settings" label="Integrações"><IntegrationsPage /></RouteWrapper>} />
              <Route path="/search" element={<RouteWrapper page="search" label="Busca"><SearchPage /></RouteWrapper>} />
              <Route path="/calendar" element={<RouteWrapper page="calendar" label="Calendário"><CalendarPage /></RouteWrapper>} />
              <Route path="/widgets" element={<RouteWrapper page="dashboard" label="Widgets"><WidgetsPage /></RouteWrapper>} />
              <Route path="/settings" element={<RouteWrapper page="settings" label="Configurações"><SettingsPage /></RouteWrapper>} />
              <Route path="/profile" element={<RouteWrapper page="settings" label="Perfil"><ProfilePage /></RouteWrapper>} />
              <Route path="/admin" element={<RouteWrapper page="settings" label="Admin"><AdminPage /></RouteWrapper>} />
              <Route path="/email" element={<RouteWrapper page="email" label="E-mail"><EmailPage /></RouteWrapper>} />
              <Route path="/messages" element={<RouteWrapper page="messages" label="Mensagens"><MessagesPage /></RouteWrapper>} />
              <Route path="/files" element={<RouteWrapper page="files" label="Arquivos"><FilesPage /></RouteWrapper>} />
              <Route path="/notes" element={<RouteWrapper page="notes" label="Notas"><NotesPage /></RouteWrapper>} />
              <Route path="/tasks" element={<RouteWrapper page="tasks" label="Tarefas"><TasksPage /></RouteWrapper>} />
              <Route path="/contacts" element={<RouteWrapper page="contacts" label="Contatos"><ContactsPage /></RouteWrapper>} />
              <Route path="/finances" element={<RouteWrapper page="finances" label="Finanças"><FinancesPage /></RouteWrapper>} />
              <Route path="/ai" element={<RouteWrapper page="ai" label="IA"><AIPage /></RouteWrapper>} />
              <Route path="/notifications" element={<RouteWrapper page="dashboard" label="Notificações"><NotificationsPage /></RouteWrapper>} />
              <Route path="/inbox" element={<RouteWrapper page="inbox" label="Inbox"><InboxPage /></RouteWrapper>} />
              <Route path="/automations" element={<RouteWrapper page="automations" label="Automações"><AutomationsPage /></RouteWrapper>} />
              <Route path="/settings/whatsapp" element={<RouteWrapper page="messages" label="WhatsApp"><WhatsappSettingsPage /></RouteWrapper>} />
              <Route path="/settings/data-reset" element={<RouteWrapper page="settings" label="Reset de Dados"><DataResetPage /></RouteWrapper>} />
              <Route path="/pricing" element={<RouteWrapper page="finances" label="Preços"><PricingPage /></RouteWrapper>} />
              <Route path="/billing" element={<RouteWrapper page="finances" label="Faturamento"><BillingPage /></RouteWrapper>} />
              <Route path="/settings/logs" element={<RouteWrapper page="settings" label="Logs"><ActivityLogsPage /></RouteWrapper>} />
              <Route path="/workspaces" element={<RouteWrapper page="settings" label="Workspaces"><WorkspacesPage /></RouteWrapper>} />
              <Route path="/social" element={<RouteWrapper page="social" label="Social"><SocialPage /></RouteWrapper>} />
              <Route path="/whatsapp-business" element={<RouteWrapper page="messages" label="WhatsApp Business"><WhatsappBusinessPage /></RouteWrapper>} />
              <Route path="/messages/whatsapp/history" element={<RouteWrapper page="messages" label="Histórico WhatsApp"><WhatsappHistoryPage /></RouteWrapper>} />
              <Route path="/integrations" element={<RouteWrapper page="settings" label="Integrações"><IntegrationsPage /></RouteWrapper>} />
              <Route path="/settings/pandora-debug" element={<RouteWrapper page="settings" label="Pandora Debug"><PandoraDebugPage /></RouteWrapper>} />
              <Route path="/settings/pre-deploy-check" element={<RouteWrapper page="settings" label="Pre-Deploy Check"><PreDeployCheckPage /></RouteWrapper>} />
              <Route path="*" element={<ChunkErrorBoundary label="Página"><Suspense fallback={<DeshLoadingScreen />}><NotFound /></Suspense></ChunkErrorBoundary>} />
            </Routes>
          </motion.div>
        </AnimatePresence>
        </main>
      </div>
      {/* <AIChatWidget /> — see comment near the (removed) lazy import */}
    </div>
    </WidgetLayoutProvider>
  );
};

const CreditErrorGate = () => {
  const { open, reason, close } = useCreditErrorListener();
  return open ? (
    <Suspense fallback={null}>
      <UpgradeModal open={open} onClose={close} reason={reason} />
    </Suspense>
  ) : null;
};

const ErrorReporterMount = () => {
  useErrorReporter();
  return null;
};

const ZernioHealthMount = () => {
  useZernioHealthCheck();
  return null;
};

const App = () => {

  return (
  <>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/privacy" element={<ChunkErrorBoundary label="Privacidade"><Suspense fallback={<DeshLoadingScreen />}><PrivacyPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/terms" element={<ChunkErrorBoundary label="Termos"><Suspense fallback={<DeshLoadingScreen />}><TermsPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/welcome" element={<ChunkErrorBoundary label="Boas-vindas"><Suspense fallback={<DeshLoadingScreen />}><WelcomePage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/modules" element={<ChunkErrorBoundary label="Módulos"><Suspense fallback={<DeshLoadingScreen />}><ModulesPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/pandora" element={<ChunkErrorBoundary label="Pandora"><Suspense fallback={<DeshLoadingScreen />}><PandoraPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/blog" element={<ChunkErrorBoundary label="Blog"><Suspense fallback={<DeshLoadingScreen />}><BlogPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/blog/categoria/:slug" element={<ChunkErrorBoundary label="Blog"><Suspense fallback={<DeshLoadingScreen />}><BlogCategoryPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/blog/:slug" element={<ChunkErrorBoundary label="Blog"><Suspense fallback={<DeshLoadingScreen />}><BlogPostPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/blog-admin" element={<ChunkErrorBoundary label="Blog Admin"><Suspense fallback={<DeshLoadingScreen />}><BlogAdminPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/blog-admin/edit/:id" element={<ChunkErrorBoundary label="Blog Admin"><Suspense fallback={<DeshLoadingScreen />}><BlogEditPage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/shared/:token" element={<ChunkErrorBoundary label="Arquivo compartilhado"><Suspense fallback={<DeshLoadingScreen />}><SharedFilePage /></Suspense></ChunkErrorBoundary>} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
            <Route path="/*" element={
              <ChunkErrorBoundary label="Aplicação">
               <ProtectedRoute>
                <WorkspaceProvider>
                <ConnectionsProvider>
                <PlatformIntegrationsProvider>
                <DemoProvider>
                <DashboardProvider>
                <NotificationsProvider>
                <WhatsappSessionProvider>
                <PageMetaProvider>
                    <TooltipProvider>
                      <ErrorReporterMount />
                      <ZernioHealthMount />
                      <Toaster />
                      <Sonner />
                      <CommandPalette />
                      <SyncIndicator />
                      <AnimatedDashboardRoutes />
                    </TooltipProvider>
                </PageMetaProvider>
                </WhatsappSessionProvider>
                </NotificationsProvider>
                </DashboardProvider>
                </DemoProvider>
                </PlatformIntegrationsProvider>
                </ConnectionsProvider>
                </WorkspaceProvider>
              </ProtectedRoute>
              </ChunkErrorBoundary>
            } />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
      <CreditErrorGate />
      <PWAUpdatePrompt />
      <PWARegisterErrorBanner />
    </AuthProvider>
  </QueryClientProvider>
  </>
  );
};

export default App;
