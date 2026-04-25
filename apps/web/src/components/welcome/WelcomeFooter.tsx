import { Link } from "react-router-dom";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { motion } from "framer-motion";
import { Shield, Lock, Globe, ArrowUpRight, Heart } from "lucide-react";
import { WELCOME_CREDITS } from "@/constants/plans";
import deshLogo from "@/assets/desh-logo.png";

const FOOTER_COLUMNS = [
  {
    title: "Produto",
    links: [
      { label: "Preços", href: "/welcome#pricing" },
    ],
  },
  {
    title: "Conta",
    links: [
      { label: "Criar conta", href: "/auth?tab=signup" },
      { label: "Entrar", href: "/auth" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidade", href: "/privacy" },
      { label: "Termos de Uso", href: "/terms" },
    ],
  },
];

const TRUST_ITEMS = [
  { icon: Shield, label: "Criptografia AES-256" },
  { icon: Lock, label: "Conformidade LGPD" },
  { icon: Globe, label: "Servidores no Brasil" },
];

export default function WelcomeFooter() {
  const { theme } = useWelcomeTheme();

  return (
    <footer className="relative z-10 px-4 sm:px-6 pb-[env(safe-area-inset-bottom)]">
      {/* Divider */}
      <div
        className="h-px w-full max-w-5xl mx-auto"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}25, transparent)` }}
      />

      <div className="max-w-5xl mx-auto pt-12 sm:pt-16 pb-8">
        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-12 sm:mb-16">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 text-center md:text-left flex flex-col items-center md:items-start">
            <motion.div
              className="mb-3"
              whileHover={{ scale: 1.02 }}
            >
              <img src={deshLogo} alt="DESH" className="h-20 sm:h-[120px] w-auto opacity-80" />
            </motion.div>
            <p className="text-xs leading-relaxed text-white/35 mb-5 max-w-[200px]">
              Sua vida organizada em um só lugar. Teste grátis com {WELCOME_CREDITS} créditos por 30 dias.
            </p>

            {/* Trust badges inline */}
            <div className="flex flex-col gap-2 items-center md:items-start">
              {TRUST_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon size={11} style={{ color: theme.accent }} className="opacity-60" />
                  <span className="text-[10px] text-white/30">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Link columns - 3 side by side */}
          <div className="col-span-2 md:col-span-3 grid grid-cols-3 gap-6 text-center md:text-left">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h4
                  className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-4"
                  style={{ color: `${theme.text}60` }}
                >
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.href}
                        className="group inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors duration-300"
                      >
                        {link.label}
                        <ArrowUpRight
                          size={10}
                          className="opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="h-px w-full mb-6"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}10, transparent)` }}
        />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-white/20">
            © {new Date().getFullYear()} DESH. Todos os direitos reservados.
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-white/20">
            <span>Desenvolvido com</span>
            <Heart size={10} className="text-red-400/50" fill="currentColor" />
            <span>por</span>
            <a
              href="https://www.webstar.studio"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold hover:text-white/40 transition-colors duration-300"
            >
              Web Star Studio
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
