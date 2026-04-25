import { memo, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { type SerpResult } from "@/hooks/search/useSerpSearch";
import { type SearchPreferences } from "@/hooks/search/useSearchPreferences";
import { Skeleton } from "@/components/ui/skeleton";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";

const SerpScholarCard = lazy(() => import("./SerpScholarCard"));

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
};

const CardFallback = () => <Skeleton className="h-48 w-full rounded-xl" />;

const SafeCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <AppErrorBoundary fallbackLabel={`Erro ao carregar ${label}`}>
    <Suspense fallback={<CardFallback />}>
      {children}
    </Suspense>
  </AppErrorBoundary>
);

interface Props {
  serpResult: SerpResult;
  prefs: SearchPreferences;
  onFinanceWindowChange?: (window: string) => void;
}

const SerpSpecializedResults = memo(({ serpResult, prefs }: Props) => {
  return (
    <>
      {prefs.serp_show_scholar !== false && serpResult.scholar_results && serpResult.scholar_results.length > 0 && (
        <motion.div variants={staggerItem}>
          <SafeCard label="Acadêmico">
            <SerpScholarCard data={{
              scholar_results: serpResult.scholar_results,
              total_results: serpResult.total_results || 0,
              profiles: serpResult.profiles || [],
            }} />
          </SafeCard>
        </motion.div>
      )}
    </>
  );
});

SerpSpecializedResults.displayName = "SerpSpecializedResults";

export default SerpSpecializedResults;
