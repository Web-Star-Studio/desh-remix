import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NAV_LINKS } from "@/lib/landing-config";
import { ROUTES } from "@/constants/routes";
import deshLogoHeader from "@/assets/desh-logo-header.png";

export function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // IntersectionObserver for active section
  useEffect(() => {
    const sectionIds = NAV_LINKS.map((l) => l.href.replace("#", ""));
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(`#${id}`);
        },
        { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(10, 10, 15, 0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={deshLogoHeader} alt="DESH" className="h-7" />
          </button>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-sm transition-colors duration-200"
                style={{ color: activeSection === l.href ? "#C8956C" : "#8E8E93" }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate(ROUTES.AUTH)} className="text-sm text-[#8E8E93] hover:text-[#F5F5F7] transition-colors">
              Entrar
            </button>
            <button
              onClick={() => navigate(ROUTES.AUTH)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[#0A0A0F] bg-gradient-to-r from-[#C8956C] to-[#E8B98A] hover:opacity-90 transition-all shadow-[0_0_20px_rgba(200,149,108,0.2)] hover:shadow-[0_0_30px_rgba(200,149,108,0.3)] hover:scale-[1.02]"
            >
              Começar grátis
            </button>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden w-10 h-10 flex items-center justify-center text-[#8E8E93]">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/[0.06]"
          >
            <div className="px-4 py-4 space-y-3">
              {NAV_LINKS.map((l) => (
                <button
                  key={l.href}
                  onClick={() => scrollTo(l.href)}
                  className="block w-full text-left text-sm py-2 transition-colors"
                  style={{ color: activeSection === l.href ? "#C8956C" : "#8E8E93" }}
                >
                  {l.label}
                </button>
              ))}
              <div className="pt-3 border-t border-white/[0.06] space-y-2">
                <button onClick={() => { setMobileOpen(false); navigate(ROUTES.AUTH); }} className="block w-full text-left text-sm text-[#8E8E93] py-2">
                  Entrar
                </button>
                <button
                  onClick={() => { setMobileOpen(false); navigate(ROUTES.AUTH); }}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-[#0A0A0F] bg-gradient-to-r from-[#C8956C] to-[#E8B98A]"
                >
                  Começar grátis
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
