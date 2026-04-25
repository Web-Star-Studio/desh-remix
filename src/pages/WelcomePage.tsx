import { useEffect } from "react";
import { ScrollProgressBar } from "@/components/landing/ui/ScrollProgressBar";
import WelcomeNavbar from "@/components/welcome/WelcomeNavbar";
import WelcomeHero from "@/components/welcome/WelcomeHero";
import WelcomeBento from "@/components/welcome/WelcomeBento";
import WelcomePandora from "@/components/welcome/WelcomePandora";
import WelcomeFeatures from "@/components/welcome/WelcomeFeatures";
import WelcomeSocial from "@/components/welcome/WelcomeSocial";
import WelcomePricing from "@/components/welcome/WelcomePricing";
import WelcomeCTA from "@/components/welcome/WelcomeCTA";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";
import WelcomeChatBubble from "@/components/welcome/WelcomeChatBubble";
import { WelcomeThemeProvider, useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { motion, AnimatePresence } from "framer-motion";

function WelcomeContent() {
  const { theme, activeWallpaper, activeGradient } = useWelcomeTheme();

  useEffect(() => {
    document.title = "DESH — Sua vida organizada em um só lugar";
    document.documentElement.style.backgroundColor = "#050508";
    document.body.style.backgroundColor = "#050508";
    return () => {
      document.title = "DESH";
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  const bgKey = activeWallpaper?.id || activeGradient?.id || "default";

  return (
    <div className="min-h-screen overflow-x-hidden relative" style={{ color: theme.text }}>
      {/* Fixed wallpaper background — identical to dashboard */}
      <div className="fixed inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={bgKey}
            className="absolute inset-0"
            style={
              activeGradient
                ? { background: activeGradient.gradient }
                : activeWallpaper
                ? {
                    backgroundImage: `url(${activeWallpaper.src})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : { background: "#050508" }
            }
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>

        {/* Dark overlay for readability — gives the glass feel */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Subtle noise grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Scrollable content */}
      <div className="relative z-10">
        <ScrollProgressBar />
        <WelcomeNavbar />
        <WelcomeHero />
        <WelcomeBento />
        <WelcomePandora />
        <WelcomeFeatures />
        <WelcomeSocial />
        <WelcomePricing />
        <WelcomeCTA />
        <WelcomeFooter />
      </div>
      <WelcomeChatBubble />
    </div>
  );
}

export default function WelcomePage() {
  return (
    <WelcomeThemeProvider>
      <WelcomeContent />
    </WelcomeThemeProvider>
  );
}
