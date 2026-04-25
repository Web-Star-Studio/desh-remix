import React from "react";
import RouteAwareSuspense from "@/components/ui/RouteAwareSuspense";
import ChunkErrorBoundary from "@/components/ui/ChunkErrorBoundary";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";

interface RouteWrapperProps {
  /** Route key used by RouteAwareSuspense to pick a skeleton */
  page: string;
  /** Friendly label shown in error fallbacks */
  label: string;
  children: React.ReactNode;
}

/**
 * RouteWrapper
 * ------------
 * Composes the three layers of safety for a lazy-loaded route:
 *
 *   ChunkErrorBoundary    → catches dynamic import failures (stale deploy,
 *                            missing chunk, network drop) and offers a hard
 *                            reload escape, preventing the user from being
 *                            stuck on the loading screen.
 *   RouteAwareSuspense    → shows the right skeleton while the chunk loads.
 *   AppErrorBoundary      → catches render-time errors inside the page,
 *                            with a "try again" recovery.
 */
export const RouteWrapper = ({ page, label, children }: RouteWrapperProps) => (
  <ChunkErrorBoundary label={label}>
    <RouteAwareSuspense page={page}>
      <AppErrorBoundary fallbackLabel={label}>{children}</AppErrorBoundary>
    </RouteAwareSuspense>
  </ChunkErrorBoundary>
);

export default RouteWrapper;
