import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight, Sparkles, LayoutGrid, Bot, CreditCard, BookOpen, Play } from "lucide-react";
import deshIcon from "@/assets/desh-icon.png";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";

const NAV_ITEMS = [
  { label: "Módulos", href: "/modules", isRoute: true, icon: LayoutGrid, desc: "Todos os recursos do DESH" },
  { label: "Pandora IA", href: "/pandora", isRoute: true, icon: Bot, desc: "Sua assistente inteligente" },
  { label: "Blog", href: "/blog", isRoute: true, icon: BookOpen, desc: "Insights sobre Life OS e produtividade" },
  { label: "Preços", href: "#pricing", isRoute: false, icon: CreditCard, desc: "Planos e créditos" },
];

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const panel = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "spring" as const, damping: 30, stiffness: 300, mass: 0.8 } },
  exit: { x: "100%", transition: { duration: 0.3, ease: [0.4, 0, 1, 1] as [number, number, number, number] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

const itemAnim = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0, transition: { type: "spring" as const, damping: 25, stiffness: 250 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.15 } },
};

export default function WelcomeNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useWelcomeTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const scrollTo = useCallback((href: string) => {
    setMobileOpen(false);
    setTimeout(() => {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth" });
    }, 350);
  }, []);

  const close = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <motion.nav
        className={`fixed top-3 inset-x-0 mx-auto z-50 w-[calc(100%-2rem)] max-w-5xl rounded-2xl transition-all duration-500 backdrop-blur-2xl border border-white/[0.08] ${
          scrolled
            ? "bg-[#0A0A0F]/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            : "bg-white/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
        }`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="px-6 h-14 flex items-center justify-between">
          <Link to="/welcome" className="flex items-center">
            <img src={deshIcon} alt="DESH" className="h-8 w-8" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) =>
              item.isRoute ? (
                <Link key={item.href} to={item.href} className="text-sm text-[#8E8E93] hover:text-[#F5F5F7] transition-colors duration-300">
                  {item.label}
                </Link>
              ) : (
                <button key={item.href} onClick={() => scrollTo(item.href)} className="text-sm text-[#8E8E93] hover:text-[#F5F5F7] transition-colors duration-300">
                  {item.label}
                </button>
              )
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="text-sm text-[#F5F5F7] px-4 py-2 rounded-xl hover:bg-white/[0.06] transition-colors duration-300">
              Entrar
            </Link>
            <Link
              to="/auth?tab=signup"
              className="text-sm font-medium px-5 py-2 rounded-xl hover:opacity-90 transition-all duration-500"
              style={{ background: `linear-gradient(to right, ${theme.accent}, ${theme.accentSecondary})`, color: "#0A0A0F" }}
            >
              Criar conta
            </Link>
          </div>

          {/* Mobile hamburger */}
          <motion.button
            className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-xl text-[#F5F5F7]"
            onClick={() => setMobileOpen(!mobileOpen)}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <X size={22} />
                </motion.span>
              ) : (
                <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Menu size={22} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.nav>

      {/* Full-screen mobile slide-over */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              variants={backdrop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={close}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              variants={panel}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-y-0 right-0 z-[70] w-[85vw] max-w-sm md:hidden flex flex-col"
              style={{
                background: "linear-gradient(165deg, rgba(15,15,25,0.98) 0%, rgba(8,8,18,0.99) 100%)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <img src={deshIcon} alt="DESH" className="h-7 w-7" />
                  <span className="text-sm font-semibold text-white/80 tracking-wide">MENU</span>
                </div>
                <motion.button
                  onClick={close}
                  whileTap={{ scale: 0.85 }}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.1] transition-colors"
                >
                  <X size={18} />
                </motion.button>
              </div>

              {/* Decorative line */}
              <div className="mx-6 h-px" style={{ background: `linear-gradient(to right, ${theme.accent}40, transparent)` }} />

              {/* Nav items */}
              <motion.div className="flex-1 px-4 pt-6 space-y-2 overflow-y-auto" variants={stagger} initial="hidden" animate="visible" exit="exit">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const inner = (
                    <motion.div
                      variants={itemAnim}
                      className="group flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/[0.04] transition-all duration-300 cursor-pointer"
                      whileTap={{ scale: 0.97 }}
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-white/[0.06]"
                        style={{ background: `linear-gradient(135deg, ${theme.accent}18, ${theme.accentSecondary}10)` }}
                      >
                        <Icon size={20} style={{ color: theme.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-white/90 group-hover:text-white transition-colors">{item.label}</p>
                        <p className="text-xs text-white/35 group-hover:text-white/50 transition-colors mt-0.5">{item.desc}</p>
                      </div>
                      <ArrowRight size={16} className="text-white/15 group-hover:text-white/40 transition-all group-hover:translate-x-0.5" />
                    </motion.div>
                  );

                  return item.isRoute ? (
                    <Link key={item.href} to={item.href} onClick={close}>{inner}</Link>
                  ) : (
                    <div key={item.href} onClick={() => scrollTo(item.href)}>{inner}</div>
                  );
                })}
              </motion.div>

              {/* Bottom CTA */}
              <motion.div
                className="px-5 pb-8 pt-4 space-y-3"
                variants={itemAnim}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.35 }}
              >
                {/* Divider */}
                <div className="h-px bg-white/[0.06] mb-2" />

                {/* Promo badge */}
                <motion.div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl mb-1"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}12, ${theme.accentSecondary}08)`, border: `1px solid ${theme.accent}20` }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Sparkles size={14} style={{ color: theme.accent }} />
                  <span className="text-xs text-white/60">Ganhe <strong className="text-white/80">100 créditos de teste</strong> por 30 dias</span>
                </motion.div>

                <Link
                  to="/auth"
                  onClick={close}
                  className="block w-full text-center text-sm text-white/80 py-3 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to="/auth?tab=signup"
                  onClick={close}
                  className="block w-full text-center text-sm font-semibold py-3 rounded-xl transition-all duration-500 hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentSecondary})`,
                    color: "#0A0A0F",
                    boxShadow: `0 4px 20px ${theme.accent}30`,
                  }}
                >
                  Criar conta grátis
                </Link>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
