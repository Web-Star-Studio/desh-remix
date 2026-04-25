import { Link } from "react-router-dom";
import { DollarSign, CheckSquare, Mail, Calendar, Users, Brain } from "lucide-react";
import { TiltCard } from "@/components/landing/ui/TiltCard";
import { RevealOnScroll } from "@/components/landing/ui/RevealOnScroll";
import { GradientText } from "@/components/landing/ui/GradientText";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/landing/ui/AnimatedCounter";

const MODULES = [
  {
    icon: DollarSign,
    label: "Finanças",
    desc: "Open Banking, orçamentos, metas e visão completa dos seus gastos.",
    color: "rgba(234,179,8,0.15)",
    iconColor: "#EAB308",
    stat: { value: 100, suffix: "+", label: "Bancos" },
    span: "md:col-span-2",
  },
  {
    icon: CheckSquare,
    label: "Tarefas",
    desc: "Kanban, subtarefas, prioridades e automações inteligentes.",
    color: "rgba(59,130,246,0.15)",
    iconColor: "#3B82F6",
    stat: { value: 8, suffix: "", label: "Visões" },
    span: "",
  },
  {
    icon: Mail,
    label: "E-mail",
    desc: "Integração Gmail com IA: resumos, respostas e limpeza automática.",
    color: "rgba(239,68,68,0.15)",
    iconColor: "#EF4444",
    stat: { value: 5, suffix: "x", label: "Mais rápido" },
    span: "",
  },
  {
    icon: Calendar,
    label: "Calendário",
    desc: "Eventos, lembretes, sincronização e gestão visual do tempo.",
    color: "rgba(34,197,94,0.15)",
    iconColor: "#22C55E",
    stat: { value: 24, suffix: "/7", label: "Alertas" },
    span: "",
  },
  {
    icon: Users,
    label: "Contatos",
    desc: "CRM pessoal com tags, interações e importação do Google.",
    color: "rgba(168,85,247,0.15)",
    iconColor: "#A855F7",
    stat: { value: 3, suffix: "", label: "Integrações" },
    span: "",
  },
  {
    icon: Brain,
    label: "Pandora IA",
    desc: "Assistente contextual que conhece seus dados e executa ações.",
    color: "rgba(200,149,108,0.15)",
    iconColor: "#C8956C",
    stat: { value: 21, suffix: "+", label: "Ações IA" },
    span: "md:col-span-2",
  },
];

export default function WelcomeBento() {
  const { theme } = useWelcomeTheme();

  return (
    <section id="modules" className="relative py-20 md:py-36 px-4 sm:px-6">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${theme.accent}08, transparent 60%)` }}
      />


      <div className="relative max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-14 md:mb-20">
            <motion.p
              className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4"
              style={{ color: theme.accent }}
            >
              Módulos
            </motion.p>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-5xl font-bold mb-5 tracking-tight [text-wrap:balance]" style={{ color: theme.text }}>
              Tudo que você precisa.{" "}
              <GradientText from={theme.accent} to={theme.accentSecondary}>Um só lugar.</GradientText>
            </h2>
            <p className="text-white/50 text-sm sm:text-lg max-w-xl mx-auto">
              Seis módulos integrados que trabalham juntos para simplificar sua vida.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {MODULES.map((mod, i) => (
            <RevealOnScroll key={mod.label} delay={i * 0.08} className={mod.span}>
              <Link to={`/modules#${mod.label.toLowerCase()}`} className="block h-full focusable rounded-2xl">
              <TiltCard
                className="group relative rounded-2xl p-6 h-full backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-250 cursor-pointer overflow-hidden"
                glowColor={mod.color}
              >
                {/* Hover gradient reveal */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[400ms]"
                  style={{
                    background: `radial-gradient(ellipse at 30% 20%, ${mod.color}, transparent 70%)`,
                  }}
                />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-250 group-hover:scale-110"
                      style={{ background: mod.color }}
                    >
                      <mod.icon size={22} style={{ color: mod.iconColor }} />
                    </div>

                    {/* Mini stat */}
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono" style={{ color: mod.iconColor }}>
                        <AnimatedCounter value={mod.stat.value} suffix={mod.stat.suffix} />
                      </div>
                      <div className="text-[9px] text-white/40 uppercase tracking-wider">{mod.stat.label}</div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold mb-2" style={{ color: theme.text }}>{mod.label}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{mod.desc}</p>

                  {/* Hover arrow */}
                  <motion.div
                    className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-250"
                    style={{ color: mod.iconColor }}
                  >
                    Explorar
                    <motion.span className="inline-block" animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span>
                  </motion.div>
                </div>
              </TiltCard>
              </Link>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
