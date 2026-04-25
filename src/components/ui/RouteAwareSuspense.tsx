import React, { Suspense } from "react";
import SmartPageLoader from "./SmartPageLoader";

const EmailLoadingSkeleton = React.lazy(() => import("@/components/email/EmailLoadingSkeleton"));
const FinanceLoadingSkeleton = React.lazy(() => import("@/components/finance/FinanceLoadingSkeleton"));

function PageSkeleton({ page }: { page: string }) {
  switch (page) {
    case "email":
      return (
        <Suspense fallback={null}>
          <EmailLoadingSkeleton />
        </Suspense>
      );
    case "finances":
      return (
        <Suspense fallback={null}>
          <FinanceLoadingSkeleton />
        </Suspense>
      );
    default:
      return null;
  }
}

interface RouteAwareSuspenseProps {
  children: React.ReactNode;
  page: string;
}

const RouteAwareSuspense = ({ children, page }: RouteAwareSuspenseProps) => {
  return (
    <Suspense
      fallback={
        <SmartPageLoader page={page}>
          <PageSkeleton page={page} />
        </SmartPageLoader>
      }
    >
      {children}
    </Suspense>
  );
};

export default RouteAwareSuspense;
