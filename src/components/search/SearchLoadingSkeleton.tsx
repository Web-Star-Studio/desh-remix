import { Globe, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import { specializedSkeletonConfig, SPECIALIZED_FILTER_LABELS } from "./searchConstants";

const SearchLoadingSkeleton = ({ activeFilter }: { activeFilter?: string }) => {
  const isSpecialized = activeFilter && SPECIALIZED_FILTER_LABELS.includes(activeFilter);

  if (isSpecialized) {
    const cfg = specializedSkeletonConfig[activeFilter!];
    const Icon = cfg?.icon || Globe;
    return (
      <div className="space-y-3">
        <AnimatedItem index={1}>
          <GlassCard size="auto">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className={`w-3.5 h-3.5 ${cfg?.colorClass || "text-primary"} animate-pulse`} />
              <span className="text-xs text-muted-foreground animate-pulse">IA analisando sua busca e extraindo parâmetros...</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Icon className={`w-4 h-4 ${cfg?.colorClass || "text-primary"}`} />
              <span className="text-xs font-medium text-foreground/70">Buscando no {cfg?.label || "Google"}...</span>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.3 }}
                  className="flex items-center gap-3"
                >
                  <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </AnimatedItem>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatedItem index={1}>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </div>
      </AnimatedItem>
      <AnimatedItem index={2}>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <Skeleton className="h-3 w-20 mb-3" />
          <div className="space-y-2">
            <div className="flex items-center gap-2"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-full" /></div>
            <div className="flex items-center gap-2"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-5/6" /></div>
            <div className="flex items-center gap-2"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-4/6" /></div>
          </div>
        </div>
      </AnimatedItem>
      <AnimatedItem index={3}>
        <GlassCard>
          <Skeleton className="h-4 w-3/4 mb-3" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </GlassCard>
      </AnimatedItem>
    </div>
  );
};

export default SearchLoadingSkeleton;
