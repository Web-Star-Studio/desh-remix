import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Mail, MessageSquare, CreditCard, Calendar, FileText, CheckSquare, Bell, Lock, Smartphone } from "lucide-react";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";
import deshLogoCoin from "@/assets/desh-logo-coin.png";

const orbitApps = [
  { icon: Mail, label: "Gmail", color: "#EA4335" },
  { icon: Bell, label: "Notificações", color: "#FBBC04" },
  { icon: FileText, label: "Notion", color: "#FF7043" },
  { icon: CheckSquare, label: "Todoist", color: "#4CAF50" },
  { icon: Calendar, label: "Google Calendar", color: "#4285F4" },
  { icon: MessageSquare, label: "WhatsApp", color: "#25D366" },
  { icon: CreditCard, label: "Nubank", color: "#8A05BE" },
  { icon: Lock, label: "Senhas", color: "#78909C" },
  { icon: Smartphone, label: "Apps", color: "#FF6F61" },
];

const stats = [
  { value: 8, label: "apps abertos agora" },
  { value: 23, label: "notificações não lidas" },
  { value: 3, label: "senhas esquecidas este mês" },
];

export function ProblemSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduced = useReducedMotion();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const orbitRadius = isMobile ? 160 : 280;
  const startAngle = -180;
  const endAngle = 0;

  return (
    <section
      id="problem"
      ref={ref}
      className="relative py-20 md:py-28 overflow-hidden"
      style={{ background: "#0A0A0F" }}
    >
      {/* Subtle gradient */}
      <div className="absolute inset-0" style={{
        backgroundImage: "linear-gradient(180deg, transparent 0%, rgba(200,149,108,0.02) 50%, transparent 100%)",
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <RevealOnScroll>
          <h2 className="font-sans font-bold text-3xl sm:text-4xl md:text-5xl text-[#F5F5F7] text-center leading-[1.1] tracking-[-0.02em] mb-4">
            Sua vida está espalhada<br />em dezenas de apps
          </h2>
          <p className="text-[#8E8E93] text-center text-base sm:text-lg max-w-xl mx-auto mb-10 font-sans">
            E cada um deles puxa sua atenção para um lado diferente.
          </p>
        </RevealOnScroll>

        {/* Orbit area with DESH logo center */}
        <div className="relative h-[380px] sm:h-[560px] mx-auto max-w-3xl mb-10 flex items-center justify-center">
          
          {/* Orbit path — subtle arc guide */}
          <div
            className="absolute rounded-full border border-white/[0.03]"
            style={{ width: (isMobile ? 160 : 280) * 2 + 48, height: (isMobile ? 160 : 280) * 2 + 48 }}
          />

          {/* Orbiting app icons in rainbow arc */}
          {orbitApps.map((app, i) => {
            const Icon = app.icon;
            const angle = startAngle + (endAngle - startAngle) * (i / (orbitApps.length - 1));
            const rad = (angle * Math.PI) / 180;
            const x = Math.cos(rad) * orbitRadius;
            const y = Math.sin(rad) * orbitRadius;

            return (
              <motion.div
                key={i}
                className="absolute flex flex-col items-center gap-1"
                style={{ left: "50%", top: "50%" }}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.3, x: 0, y: 0 }}
                animate={inView ? {
                  opacity: 1,
                  scale: 1,
                  x: x - 24,
                  y: y - 24,
                } : {}}
                transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center backdrop-blur-sm transition-colors duration-300 hover:border-white/20"
                  style={{ boxShadow: `0 0 16px ${app.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: app.color }} />
                </div>
                <span className="text-[11px] text-[#636366] whitespace-nowrap">{app.label}</span>
              </motion.div>
            );
          })}

          {/* Neon glow below the logo */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 180,
              height: 32,
              top: "calc(50% + 56px)",
              background: "radial-gradient(ellipse, rgba(200,149,108,0.4) 0%, rgba(200,149,108,0.1) 50%, transparent 80%)",
              filter: "blur(12px)",
            }}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8, duration: 0.6 }}
          />

          {/* Center DESH logo — spinning coin */}
          <motion.div
            className="relative z-10 w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {/* Outer glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(200,149,108,0.15) 0%, transparent 70%)",
                transform: "scale(2)",
              }}
            />
            {/* Spinning logo */}
            <motion.img
              src={deshLogoCoin}
              alt="DESH Logo"
              className="w-24 h-24 sm:w-32 sm:h-32 drop-shadow-lg"
              animate={reduced ? {} : { rotateY: [0, 360] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{ filter: "drop-shadow(0 4px 20px rgba(200,149,108,0.4))" }}
            />
          </motion.div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto mb-10">
          {stats.map((stat, i) => (
            <RevealOnScroll key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-[#F5F5F7] font-['JetBrains_Mono',monospace]">
                  <AnimatedCounter value={stat.value} />
                </div>
                <p className="text-sm text-[#8E8E93] mt-1 font-sans">{stat.label}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll>
          <p className="text-center text-xl sm:text-2xl text-[#F5F5F7] font-sans font-semibold">
            E se tudo estivesse em <span className="text-[#C8956C]">um só lugar</span>?
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
