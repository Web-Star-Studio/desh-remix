import { RevealOnScroll } from "@/components/landing/ui/RevealOnScroll";
import { AnimatedCounter } from "@/components/landing/ui/AnimatedCounter";
import { Star, Wallet, LayoutGrid, Bot, Zap, Users, Globe } from "lucide-react";
import { useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";
import { motion } from "framer-motion";

const STATS = [
  { value: 12, suffix: "", label: "Módulos integrados", desc: "Finanças, tarefas, e-mails, calendário e mais", icon: LayoutGrid },
  { value: 200, suffix: "+", label: "Instituições financeiras", desc: "Open Banking com os maiores bancos do Brasil", icon: Wallet },
  { value: 47, suffix: "", label: "Ações com IA", desc: "Automações, análises e comandos por linguagem natural", icon: Bot },
  { value: 30, suffix: "+", label: "Widgets personalizáveis", desc: "Dashboard totalmente adaptável ao seu fluxo", icon: Zap },
  { value: 500, suffix: "+", label: "Usuários ativos", desc: "Profissionais que já organizaram sua vida", icon: Users },
  { value: 15, suffix: "+", label: "Integrações externas", desc: "Google, WhatsApp, Stripe, Pluggy e mais", icon: Globe },
];

const TESTIMONIALS = [
  { name: "Lucas M.", role: "Empreendedor", text: "O DESH substituiu 5 apps que eu usava. Agora tudo está num lugar só, com a Pandora me ajudando no dia a dia.", avatar: "LM" },
  { name: "Ana C.", role: "Freelancer", text: "A parte de finanças com Open Banking é incrível. Finalmente consigo ver todos os meus gastos de verdade.", avatar: "AC" },
  { name: "Pedro R.", role: "Desenvolvedor", text: "A personalização é impressionante. Escolher wallpaper, cores e widgets deixou tudo com a minha cara.", avatar: "PR" },
];

export default function WelcomeSocial() {
  const { theme } = useWelcomeTheme();

  return (
    <section className="relative py-20 md:py-36 px-4 sm:px-6">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${theme.accent}08, transparent 60%)` }}
      />

      <div className="relative max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: theme.accent }}>
              Em números
            </p>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-tight [text-wrap:balance]" style={{ color: theme.text }}>
              Construído para escala real.
            </h2>
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5 mb-20 md:mb-28">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl p-4 sm:p-6 md:p-8 overflow-hidden hover:border-white/[0.14] transition-all duration-500"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                whileHover={{ y: -3 }}
              >
                <div
                  className="absolute -top-16 -right-16 w-32 h-32 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background: `radial-gradient(circle, ${theme.accent}12, transparent 70%)`, filter: "blur(25px)" }}
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${theme.accent}12` }}
                    >
                      <stat.icon size={15} style={{ color: theme.accent }} />
                    </div>
                  </div>

                  <div
                    className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-1"
                    style={{ color: theme.text }}
                  >
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} duration={2.2} />
                  </div>

                  <p className="text-sm font-medium mb-1" style={{ color: `${theme.text}AA` }}>{stat.label}</p>
                  <p className="text-xs leading-relaxed text-white/40">{stat.desc}</p>

                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${theme.accent}40, transparent)` }}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.8 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4" style={{ color: theme.accent }}>
              Depoimentos
            </p>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-tight [text-wrap:balance]" style={{ color: theme.text }}>
              Quem usa, recomenda.
            </h2>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <RevealOnScroll key={t.name} delay={i * 0.12}>
              <motion.div
                className="group rounded-2xl backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08] p-5 sm:p-7 h-full flex flex-col hover:border-white/[0.14] transition-all duration-500 relative overflow-hidden"
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div
                  className="absolute -top-20 -right-20 w-40 h-40 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{
                    background: `radial-gradient(circle, ${theme.accent}10, transparent 70%)`,
                    filter: "blur(30px)",
                  }}
                />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={14} style={{ color: theme.accent, fill: theme.accent }} />
                    ))}
                  </div>

                  <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: `${theme.text}CC` }}>
                    "{t.text}"
                  </p>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${theme.accent}30, ${theme.accentSecondary}20)`,
                        color: theme.accent,
                        border: `1px solid ${theme.accent}30`,
                      }}
                    >
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: theme.text }}>{t.name}</p>
                      <p className="text-xs text-white/40">{t.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
