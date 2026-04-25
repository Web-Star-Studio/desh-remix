import { useState, lazy, Suspense } from "react";
import { Share2, BarChart3, Users, Megaphone, LineChart, Sparkles, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OverviewTab } from "@/components/social/OverviewTab";
import { PeriodSelector, type Period } from "@/components/social/PeriodSelector";

// Lazy-load non-default tabs
const AccountsTab = lazy(() => import("@/components/social/AccountsTab").then(m => ({ default: m.AccountsTab })));
const AdsTab = lazy(() => import("@/components/social/AdsTab").then(m => ({ default: m.AdsTab })));
const AnalyticsTab = lazy(() => import("@/components/social/AnalyticsTab").then(m => ({ default: m.AnalyticsTab })));
const AITab = lazy(() => import("@/components/social/AITab").then(m => ({ default: m.AITab })));

const RANKEY_URL = "https://rankey.ai";

const tabs = [
  { value: "overview", label: "Visão Geral", icon: BarChart3 },
  { value: "accounts", label: "Contas", icon: Users },
  { value: "ads", label: "Anúncios", icon: Megaphone },
  { value: "analytics", label: "Analytics", icon: LineChart },
  { value: "ai", label: "IA", icon: Sparkles },
] as const;

const TabFallback = () => (
  <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
);

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [period, setPeriod] = useState<Period>("30d");

  return (
    <PageLayout maxWidth="7xl">
      <TooltipProvider>
        <PageHeader
          title="Redes Sociais"
          icon={<Share2 className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />}
          backTo="/dashboard"
          subtitle={
            <span className="text-xs text-muted-foreground">
              Monitoramento & Analytics · Posts via{" "}
              <a href={RANKEY_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Rankey
              </a>
            </span>
          }
          actions={
            ["overview", "ads", "analytics"].includes(activeTab) ? (
              <PeriodSelector value={period} onChange={setPeriod} />
            ) : undefined
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
          {/* Tab navigation */}
          <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 no-scrollbar mb-5">
            <TabsList className="w-max md:w-auto inline-flex gap-0.5 bg-foreground/[0.04] backdrop-blur-sm p-1 rounded-xl border border-foreground/[0.04]">
              {tabs.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="gap-1.5 text-xs md:text-sm px-3 md:px-4 py-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-foreground/5 transition-all duration-200"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label.length > 6 ? label.slice(0, 5) + "." : label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4 mt-0"><OverviewTab period={period} onGoToAccounts={() => setActiveTab("accounts")} /></TabsContent>
          <TabsContent value="accounts" className="space-y-4 mt-0"><Suspense fallback={<TabFallback />}><AccountsTab /></Suspense></TabsContent>
          <TabsContent value="ads" className="space-y-4 mt-0"><Suspense fallback={<TabFallback />}><AdsTab period={period} onGoToAccounts={() => setActiveTab("accounts")} /></Suspense></TabsContent>
          <TabsContent value="analytics" className="space-y-4 mt-0"><Suspense fallback={<TabFallback />}><AnalyticsTab period={period} onGoToAccounts={() => setActiveTab("accounts")} /></Suspense></TabsContent>
          <TabsContent value="ai" className="space-y-4 mt-0"><Suspense fallback={<TabFallback />}><AITab /></Suspense></TabsContent>
        </Tabs>
      </TooltipProvider>
    </PageLayout>
  );
}
