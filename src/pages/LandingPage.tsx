import { lazy, Suspense, useEffect } from "react";
import WelcomeNavbar from "@/components/welcome/WelcomeNavbar";
import { initScrollDepthTracking, trackLandingEvent } from "@/lib/landing-analytics";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { ScrollProgressBar } from "@/components/landing/ui/ScrollProgressBar";
import { usePandoraLanding } from "@/hooks/ai/usePandoraLanding";
import WelcomeChatBubble from "@/components/welcome/WelcomeChatBubble";
import { WelcomeThemeProvider } from "@/components/welcome/WelcomeThemeContext";

// Below-the-fold sections — lazy-loaded so the LCP chunk stays small on 3G.
const SolutionReveal = lazy(() => import("@/components/landing/SolutionReveal").then(m => ({ default: m.SolutionReveal })));
const ModulesShowcase = lazy(() => import("@/components/landing/ModulesShowcase").then(m => ({ default: m.ModulesShowcase })));
const PersonalizationSection = lazy(() => import("@/components/landing/PersonalizationSection").then(m => ({ default: m.PersonalizationSection })));
const PandoraShowcase = lazy(() => import("@/components/landing/PandoraShowcase").then(m => ({ default: m.PandoraShowcase })));
const TestimonialsSection = lazy(() => import("@/components/landing/TestimonialsSection").then(m => ({ default: m.TestimonialsSection })));
const PricingSection = lazy(() => import("@/components/landing/PricingSection").then(m => ({ default: m.PricingSection })));
const FAQSection = lazy(() => import("@/components/landing/FAQSection").then(m => ({ default: m.FAQSection })));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA").then(m => ({ default: m.FinalCTA })));
const PandoraScrollReactions = lazy(() => import("@/components/landing/pandora/PandoraScrollReactions").then(m => ({ default: m.PandoraScrollReactions })));

// Skeleton placeholder reserves vertical space → prevents CLS while chunk loads.
const SectionSkeleton = ({ minHeight = 600 }: { minHeight?: number }) => (
  <div aria-hidden="true" style={{ minHeight, contain: "layout paint" }} />
);

export default function LandingPage() {
  const pandora = usePandoraLanding();

  useEffect(() => {
    trackLandingEvent("page_view", { location: "landing" });
    const cleanup = initScrollDepthTracking();
    return cleanup;
  }, []);

  return (
    <WelcomeThemeProvider>
      <div className="landing-page min-h-screen relative" style={{ background: "#0A0A0F" }}>
        {/* Global noise texture overlay */}
        <div
          className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03]"
          aria-hidden="true"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        <ScrollProgressBar />
        <WelcomeNavbar />

        <main>
          {/* Above-the-fold — eager (drives LCP) */}
          <HeroSection />
          <ProblemSection />

          {/* Below-the-fold — lazy with skeletons (prevents CLS) */}
          <Suspense fallback={<SectionSkeleton minHeight={700} />}>
            <SolutionReveal />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={800} />}>
            <ModulesShowcase />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={600} />}>
            <PersonalizationSection />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={700} />}>
            <PandoraShowcase />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={500} />}>
            <TestimonialsSection />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={800} />}>
            <PricingSection />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={600} />}>
            <FAQSection />
          </Suspense>
          <Suspense fallback={<SectionSkeleton minHeight={500} />}>
            <FinalCTA />
          </Suspense>
        </main>

        <LandingFooter />
        <CookieConsentBanner />

        <Suspense fallback={null}>
          <PandoraScrollReactions triggerSectionReaction={pandora.triggerSectionReaction} />
        </Suspense>
        <WelcomeChatBubble />
      </div>
    </WelcomeThemeProvider>
  );
}
