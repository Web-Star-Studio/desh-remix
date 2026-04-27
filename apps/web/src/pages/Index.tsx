import { useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useThemeContext } from "@/contexts/ThemeContext";
import { GoogleServiceNotifiers } from "@/hooks/integrations/useGoogleNewDataNotifier";
import { useEventReminders } from "@/hooks/calendar/useEventReminders";
import { useLocalDataNotifier } from "@/hooks/ui/useLocalDataNotifier";
import { useAutomationEngine } from "@/hooks/automation/useAutomationEngine";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { useSmartNotifications } from "@/hooks/ui/useSmartNotifications";
import { useAutoSync } from "@/hooks/common/useAutoSync";

import BroadcastBanner from "@/components/dashboard/BroadcastBanner";
import WhatsAppDisconnectedBanner from "@/components/dashboard/WhatsAppDisconnectedBanner";
import ComposioOnboardingBanner from "@/components/dashboard/ComposioOnboardingBanner";
import DemoBanner from "@/components/dashboard/DemoBanner";
import WidgetGrid, { useValidWidgetIds } from "@/components/dashboard/WidgetGrid";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { motion } from "framer-motion";
import { useWidgetLayout } from "@/hooks/ui/useWidgetLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { usePageMeta } from "@/contexts/PageMetaContext";
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));
const IntroSplash = lazy(() => import("@/components/dashboard/IntroSplash"));


const Index = () => {
  useEventReminders();
  useLocalDataNotifier();
  useAutomationEngine();
  useKeyboardShortcuts();
  useSmartNotifications();
  useAutoSync();
  const { wallpaperStyle } = useThemeContext();
  const { profile } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(false);
  const handleOnboardingComplete = useCallback(() => setOnboardingDone(true), []);
  const showOnboarding = profile && !profile.onboarding_completed && !onboardingDone;
  const { visibleWidgets, moveWidgetById } = useWidgetLayout();
  const VALID_WIDGET_IDS = useValidWidgetIds();
  const { isLoading: isDemoLoading } = useDemo();
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem("desh-intro-seen") && !localStorage.getItem("desh-intro-disabled"));

  // Greeting based on time of day; date in pt-BR. These become the dashboard's
  // page title in the shell-level top bar.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return "Boa madrugada";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);
  const firstName = profile?.display_name?.split(" ")[0] || null;
  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );
  usePageMeta({
    title: firstName ? `${greeting}, ${firstName}` : greeting,
    subtitle: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
  });

  const validVisibleWidgets = useMemo(
    () => visibleWidgets.filter(w => VALID_WIDGET_IDS.has(w.id)),
    [visibleWidgets, VALID_WIDGET_IDS]
  );

  if (showOnboarding) {
    return (
      <Suspense fallback={null}>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed [overflow-x:clip] safe-area-left safe-area-right" style={wallpaperStyle}>
      {showIntro && <Suspense fallback={null}><IntroSplash onComplete={() => setShowIntro(false)} /></Suspense>}
      <GoogleServiceNotifiers />
      <main className="p-3 sm:p-4 lg:p-6 pb-24 md:pb-6 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+1rem)] lg:pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        <div className="max-w-[1600px] mx-auto w-full">
          <div className="space-y-3 mt-3">
            <BroadcastBanner />
            <ComposioOnboardingBanner />
            <WhatsAppDisconnectedBanner />
            <DemoBanner />
          </div>

          <motion.div
            key={isDemoLoading ? "demo-skeleton" : "widget-grid"}
            initial={{ opacity: 0, y: isDemoLoading ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: isDemoLoading ? 0.3 : 0.4, ease: "easeOut" }}
          >
            {isDemoLoading ? (
              <DashboardSkeleton />
            ) : (
              <WidgetGrid visibleWidgets={validVisibleWidgets} moveWidgetById={moveWidgetById} />
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Index;
