import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

const shimmer =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.04] before:to-transparent";

type CardVariant = "standard" | "compact" | "wide";

const CARD_VARIANTS: CardVariant[] = [
  "wide", "standard", "standard", "compact",
  "standard", "standard", "compact", "standard",
];

const variantStyles: Record<CardVariant, string> = {
  standard: "",
  compact: "sm:h-[160px]",
  wide: "sm:col-span-2",
};

const SkeletonCard = ({ index, variant = "standard" }: { index: number; variant?: CardVariant }) => (
  <motion.div
    className={`glass-card rounded-2xl p-4 space-y-3 ${shimmer} ${variantStyles[variant]}`}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
  >
    <div className="flex items-center gap-2.5">
      <div className="h-4 w-4 rounded-md bg-primary/10" />
      <div className="h-3 w-24 rounded bg-foreground/8" />
      <div className="ml-auto h-3 w-10 rounded bg-foreground/5" />
    </div>
    <div className="space-y-2 pt-1">
      <div className="h-2.5 w-full rounded bg-foreground/5" />
      {variant !== "compact" && <div className="h-2.5 w-4/5 rounded bg-foreground/5" />}
      {variant !== "compact" && <div className="h-2.5 w-3/5 rounded bg-foreground/5" />}
    </div>
    {variant !== "compact" && <div className="h-16 rounded-xl bg-foreground/[0.03] mt-2" />}
    <div className="flex items-center gap-2 pt-1">
      <div className="h-6 w-6 rounded-full bg-foreground/5" />
      <div className="h-2.5 w-16 rounded bg-foreground/5" />
      <div className="ml-auto h-2.5 w-12 rounded bg-foreground/5" />
    </div>
  </motion.div>
);

const DashboardSkeleton = () => {
  const isMobile = useIsMobile();
  const count = isMobile ? 4 : 8;

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:auto-rows-[280px] lg:auto-rows-[320px] grid-flow-row-dense gap-2.5 sm:gap-3 lg:gap-4 mt-3 md:mt-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={`skel-${i}`} index={i} variant={CARD_VARIANTS[i % CARD_VARIANTS.length]} />
      ))}
    </motion.div>
  );
};

export default DashboardSkeleton;
