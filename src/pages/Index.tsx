import { useMemo, useState, useCallback, lazy, Suspense } from "react";
import { useThemeContext } from "@/contexts/ThemeContext";
import { GoogleServiceNotifiers } from "@/hooks/integrations/useGoogleNewDataNotifier";
import { useEventReminders } from "@/hooks/calendar/useEventReminders";
import { useLocalDataNotifier } from "@/hooks/ui/useLocalDataNotifier";
import { useAutomationEngine } from "@/hooks/automation/useAutomationEngine";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { useSmartNotifications } from "@/hooks/ui/useSmartNotifications";
import { useAutoSync } from "@/hooks/common/useAutoSync";

import GreetingHeader from "@/components/dashboard/GreetingHeader";
import BroadcastBanner from "@/components/dashboard/BroadcastBanner";
import WhatsAppDisconnectedBanner from "@/components/dashboard/WhatsAppDisconnectedBanner";
import ComposioOnboardingBanner from "@/components/dashboard/ComposioOnboardingBanner";
import DemoBanner from "@/components/dashboard/DemoBanner";
import WidgetGrid, { useValidWidgetIds } from "@/components/dashboard/WidgetGrid";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useWidgetLayout } from "@/hooks/ui/useWidgetLayout";
import { LayoutGrid } from "lucide-react";
import GlobalSearchBar from "@/components/dashboard/GlobalSearchBar";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";

const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard"));
const WidgetManager = lazy(() => import("@/components/dashboard/WidgetManager"));
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
  const { widgets, visibleWidgets, toggleWidget, moveWidgetById } = useWidgetLayout();
  const VALID_WIDGET_IDS = useValidWidgetIds();
  const { isLoading: isDemoLoading } = useDemo();
  const [showManager, setShowManager] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem("desh-intro-seen") && !localStorage.getItem("desh-intro-disabled"));

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
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <GreetingHeader />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <GlobalSearchBar />
              </div>
              <button
                onClick={() => setShowManager(!showManager)}
                className="focusable glass-card p-2.5 rounded-xl hover:bg-foreground/10 transition-colors flex-shrink-0"
                title="Gerenciar widgets"
                aria-label="Gerenciar widgets"
              >
                <LayoutGrid className="w-4 h-4 text-foreground/70" />
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {showManager && (
              <Suspense fallback={null}>
                <WidgetManager
                  widgets={widgets}
                  validWidgetIds={VALID_WIDGET_IDS}
                  onToggle={toggleWidget}
                  onMoveById={moveWidgetById}
                  onClose={() => setShowManager(false)}
                />
              </Suspense>
            )}
          </AnimatePresence>

          <div className="space-y-3 mt-3">
            <BroadcastBanner />
            <ComposioOnboardingBanner />
            <WhatsAppDisconnectedBanner />
            <DemoBanner />
          </div>

          <AnimatePresence mode="wait">
            {isDemoLoading ? (
              <motion.div
                key="demo-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <DashboardSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key="widget-grid"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <WidgetGrid visibleWidgets={validVisibleWidgets} moveWidgetById={moveWidgetById} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Index;
