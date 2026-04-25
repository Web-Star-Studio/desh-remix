import { useMemo } from "react";
import { Palette, Check, Monitor, Sun, Moon, Sparkles, ListTodo, Calendar, Wallet, Mail, BarChart3, Clock, ChevronRight } from "lucide-react";
import { RevealOnScroll } from "@/components/landing/ui/RevealOnScroll";
import { GradientText } from "@/components/landing/ui/GradientText";
import { motion, AnimatePresence } from "framer-motion";
import { useWelcomeTheme, WELCOME_WALLPAPERS, WELCOME_GRADIENTS } from "@/components/welcome/WelcomeThemeContext";

const THEME_COLORS = [
  { id: "brown", label: "Âmbar", hex: "#8B6914" },
  { id: "graphite", label: "Grafite", hex: "#4D5566" },
  { id: "purple", label: "Roxo", hex: "#9333EA" },
  { id: "blue", label: "Azul", hex: "#3B82F6" },
  { id: "green", label: "Verde", hex: "#22A55B" },
  { id: "red", label: "Vermelho", hex: "#EF4444" },
  { id: "orange", label: "Laranja", hex: "#F97316" },
  { id: "yellow", label: "Amarelo", hex: "#EAB308" },
  { id: "pink", label: "Rosa", hex: "#EC4899" },
  { id: "lilac", label: "Lilás", hex: "#C084FC" },
];

function MiniWidget({ color, children, className = "" }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-black/40 backdrop-blur-md border border-white/[0.08] p-2.5 ${className}`}>
      {children}
    </div>
  );
}

function DashboardPreview({ wallpaper, gradient, accentColor }: {
  wallpaper: typeof WELCOME_WALLPAPERS[0] | null;
  gradient: typeof WELCOME_GRADIENTS[0] | null;
  accentColor: string;
}) {
  const bgStyle = useMemo(() => {
    if (gradient) return { background: gradient.gradient };
    if (wallpaper) return { backgroundImage: `url(${wallpaper.src})`, backgroundSize: "cover", backgroundPosition: "center" };
    return { backgroundImage: `url(${WELCOME_WALLPAPERS[0].src})`, backgroundSize: "cover", backgroundPosition: "center" };
  }, [wallpaper, gradient]);

  return (
    <motion.div
      className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
      style={{ boxShadow: `0 25px 60px -12px ${accentColor}20, 0 0 0 1px rgba(255,255,255,0.05)` }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={wallpaper?.id || gradient?.id || "default"}
          className="absolute inset-0"
          style={bgStyle}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 h-full flex flex-col p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${accentColor}30` }}>
              <Sun size={10} style={{ color: accentColor }} />
            </div>
            <span className="text-[9px] sm:text-[10px] font-medium text-white/80">Bom dia, Lucas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-white/10" />
            <div className="w-4 h-4 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-1.5 sm:gap-2">
          <MiniWidget color={accentColor} className="col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <ListTodo size={8} style={{ color: accentColor }} />
              <span className="text-[7px] sm:text-[8px] font-medium text-white/70">Tarefas</span>
            </div>
            <div className="space-y-1">
              {[true, true, false].map((done, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm border flex-shrink-0" style={{ borderColor: done ? accentColor : "rgba(255,255,255,0.2)", background: done ? accentColor : "transparent" }} />
                  <div className={`h-[2px] rounded-full ${done ? "opacity-40" : "opacity-60"}`} style={{ width: `${50 + i * 12}%`, background: "white" }} />
                </div>
              ))}
            </div>
          </MiniWidget>

          <MiniWidget color={accentColor} className="col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <Calendar size={8} style={{ color: accentColor }} />
              <span className="text-[7px] sm:text-[8px] font-medium text-white/70">Agenda</span>
            </div>
            <div className="space-y-1">
              {["9:00", "11:30"].map((time, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[6px] text-white/40 font-mono w-4">{time}</span>
                  <div className="h-[2px] flex-1 rounded-full" style={{ background: `${accentColor}${i === 0 ? "80" : "40"}` }} />
                </div>
              ))}
            </div>
          </MiniWidget>

          <MiniWidget color={accentColor} className="col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <Wallet size={8} style={{ color: accentColor }} />
              <span className="text-[7px] sm:text-[8px] font-medium text-white/70">Finanças</span>
            </div>
            <div className="flex items-end gap-[2px] h-5">
              {[40, 65, 35, 80, 55, 70, 50].map((h, i) => (
                <motion.div key={i} className="flex-1 rounded-sm" style={{ background: i === 3 ? accentColor : `${accentColor}40` }}
                  initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.05, duration: 0.4 }}
                />
              ))}
            </div>
          </MiniWidget>

          <MiniWidget color={accentColor} className="col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <Mail size={8} style={{ color: accentColor }} />
              <span className="text-[7px] sm:text-[8px] font-medium text-white/70">E-mails</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="text-[10px] font-bold" style={{ color: accentColor }}>3</div>
              <span className="text-[6px] text-white/40">não lidos</span>
            </div>
          </MiniWidget>

          <MiniWidget color={accentColor} className="col-span-1">
            <div className="flex items-center gap-1 mb-1.5">
              <BarChart3 size={8} style={{ color: accentColor }} />
              <span className="text-[7px] sm:text-[8px] font-medium text-white/70">Resumo</span>
            </div>
            <div className="flex items-center gap-1">
              <motion.div className="h-1.5 rounded-full" style={{ background: accentColor }}
                initial={{ width: 0 }} whileInView={{ width: "70%" }} viewport={{ once: true }}
                transition={{ delay: 0.8, duration: 0.6 }}
              />
            </div>
          </MiniWidget>

          <MiniWidget color={accentColor} className="col-span-1 flex flex-col items-center justify-center">
            <Clock size={10} style={{ color: accentColor }} />
            <span className="text-[8px] font-mono text-white/60 mt-0.5">14:32</span>
          </MiniWidget>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.01) 100%)"
      }} />
    </motion.div>
  );
}

export default function WelcomeFeatures() {
  const {
    theme, themeIndex, setThemeIndex,
    bgMode, setBgMode,
    wallpaperIndex, setWallpaperIndex,
    gradientIndex, setGradientIndex,
    activeWallpaper, activeGradient,
  } = useWelcomeTheme();

  const selectedColor = themeIndex;
  const accentColor = THEME_COLORS[selectedColor].hex;

  return (
    <section id="features" className="relative py-20 md:py-36 px-4 sm:px-6">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 80%, ${accentColor}08, transparent 60%)` }}
      />

      <div className="relative max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-12 md:mb-16">
            <motion.p
              className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-4"
              style={{ color: theme.accent }}
            >
              Personalização Total
            </motion.p>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-5xl font-bold mb-4 tracking-tight [text-wrap:balance]" style={{ color: theme.text }}>
              Feito do{" "}
              <GradientText from={accentColor} to={theme.accentSecondary}>seu jeito.</GradientText>
            </h2>
            <p className="text-white/50 text-sm sm:text-lg max-w-2xl mx-auto">
              Escolha um wallpaper e uma cor. Veja a página inteira se transformar em tempo real.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-6 lg:gap-8 items-start">
          {/* Left: Controls */}
          <div className="space-y-5">
            {/* Theme colors */}
            <RevealOnScroll>
              <motion.div
                className="group rounded-2xl backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08] p-5 sm:p-6 hover:border-white/[0.12] transition-all duration-500"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}18` }}>
                    <Palette size={18} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: theme.text }}>Cor do tema</h3>
                    <p className="text-[11px] text-white/40">{THEME_COLORS[selectedColor].label}, muda tudo!</p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {THEME_COLORS.map((color, i) => (
                    <motion.button
                      key={color.id}
                      onClick={() => setThemeIndex(i)}
                      className="relative aspect-square rounded-xl transition-all duration-200 flex items-center justify-center"
                      style={{
                        background: `${color.hex}15`,
                        border: selectedColor === i ? `2px solid ${color.hex}` : "2px solid rgba(255,255,255,0.04)",
                        boxShadow: selectedColor === i ? `0 0 20px ${color.hex}25` : "none",
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.92 }}
                      title={color.label}
                    >
                      <div className="w-4 h-4 rounded-full" style={{ background: color.hex }} />
                      {selectedColor === i && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-xl ring-1 ring-white/20" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </RevealOnScroll>

            {/* Wallpaper picker */}
            <RevealOnScroll delay={0.1}>
              <motion.div
                className="group rounded-2xl backdrop-blur-2xl bg-white/[0.04] border border-white/[0.08] p-5 sm:p-6 hover:border-white/[0.12] transition-all duration-500"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}18` }}>
                    <Monitor size={18} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: theme.text }}>Wallpaper</h3>
                    <p className="text-[11px] text-white/40">
                      {bgMode === "wallpaper" ? WELCOME_WALLPAPERS[wallpaperIndex].label : WELCOME_GRADIENTS[gradientIndex].label}
                      {" "}· fundo da página
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 p-0.5 rounded-lg bg-white/[0.03]">
                  {(["wallpaper", "gradient"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setBgMode(t)}
                      className="flex-1 text-[10px] font-medium py-1.5 rounded-md transition-all duration-300"
                      style={{
                        background: bgMode === t ? `${accentColor}20` : "transparent",
                        color: bgMode === t ? accentColor : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {t === "wallpaper" ? "Paisagens" : "Abstratos"}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {bgMode === "wallpaper" ? (
                    <motion.div
                      key="wallpaper"
                      className="grid grid-cols-4 gap-1.5"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.25 }}
                    >
                      {WELCOME_WALLPAPERS.map((wp, i) => (
                        <motion.button
                          key={wp.id}
                          onClick={() => setWallpaperIndex(i)}
                          className="relative aspect-[4/3] rounded-lg overflow-hidden transition-all duration-200"
                          style={{
                            border: wallpaperIndex === i ? `2px solid ${accentColor}` : "2px solid rgba(255,255,255,0.04)",
                            boxShadow: wallpaperIndex === i ? `0 0 16px ${accentColor}25` : "none",
                          }}
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <img src={wp.src} alt={wp.label} className="w-full h-full object-cover" loading="lazy" />
                          {wallpaperIndex === i && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 flex items-center justify-center bg-black/30"
                            >
                              <Check size={12} className="text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="gradient"
                      className="grid grid-cols-4 gap-1.5"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      {WELCOME_GRADIENTS.map((g, i) => (
                        <motion.button
                          key={g.id}
                          onClick={() => setGradientIndex(i)}
                          className="relative aspect-[4/3] rounded-lg overflow-hidden transition-all duration-200"
                          style={{
                            background: g.gradient,
                            border: gradientIndex === i ? `2px solid ${accentColor}` : "2px solid rgba(255,255,255,0.04)",
                            boxShadow: gradientIndex === i ? `0 0 16px ${accentColor}25` : "none",
                          }}
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {gradientIndex === i && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 flex items-center justify-center bg-black/20"
                            >
                              <Check size={12} className="text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </RevealOnScroll>
          </div>

          {/* Right: Live dashboard preview */}
          <RevealOnScroll delay={0.2}>
            <div className="lg:sticky lg:top-24">
              <div className="relative">
                {/* Browser chrome */}
                <div className="rounded-t-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.08] border-b-0 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white/[0.05] rounded-md px-4 py-1 text-[9px] text-white/40 font-mono flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                      desh.life/dashboard
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sun size={10} className="text-white/40" />
                    <Moon size={10} className="text-white/40" />
                  </div>
                </div>

                {/* Dashboard preview */}
                <div className="rounded-b-2xl overflow-hidden border border-white/[0.08] border-t-0">
                  <DashboardPreview
                    wallpaper={activeWallpaper}
                    gradient={activeGradient}
                    accentColor={accentColor}
                  />
                </div>

                {/* Floating label */}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
