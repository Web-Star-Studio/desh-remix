import { useState } from "react";
import { Palette, Image, Layout } from "lucide-react";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { AnimatedCounter } from "./ui/AnimatedCounter";

const themeColors = [
  { name: "Âmbar", value: "#C8956C" },
  { name: "Azul", value: "#64D2FF" },
  { name: "Verde", value: "#30D158" },
  { name: "Roxo", value: "#BF5AF2" },
  { name: "Rosa", value: "#FF6B8A" },
  { name: "Vermelho", value: "#FF453A" },
  { name: "Laranja", value: "#FF9F0A" },
  { name: "Teal", value: "#40C8E0" },
];

const wallpapers = [
  { name: "Aurora", gradient: "linear-gradient(135deg, #1a0533 0%, #0d3b2e 100%)" },
  { name: "Montanha", gradient: "linear-gradient(135deg, #2c3e50 0%, #4a6fa5 100%)" },
  { name: "Praia", gradient: "linear-gradient(135deg, #3a7bd5 0%, #d2b48c 100%)" },
  { name: "Floresta", gradient: "linear-gradient(135deg, #0b3d0b 0%, #1a472a 100%)" },
  { name: "Cidade", gradient: "linear-gradient(180deg, #0f0c29 0%, #1a1a2e 60%, #e2b33e22 100%)" },
  { name: "Deserto", gradient: "linear-gradient(135deg, #c2956a 0%, #4a3728 100%)" },
];

const stats = [
  { icon: Palette, value: 12, label: "cores de tema" },
  { icon: Image, value: 21, label: "wallpapers" },
  { icon: Layout, value: 0, label: "layouts possíveis", display: "∞" },
];

export function PersonalizationSection() {
  const [activeColor, setActiveColor] = useState("#C8956C");
  const [activeWallpaper, setActiveWallpaper] = useState(0);

  return (
    <section id="personalization" className="relative py-20 md:py-28" style={{ background: "#0A0A0F" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        <RevealOnScroll>
          <h2 className="font-sans font-bold text-3xl sm:text-4xl md:text-5xl text-[#F5F5F7] text-center leading-[1.1] tracking-[-0.02em] mb-4">
            Seu. <span style={{ color: activeColor }} className="transition-colors duration-300">Do seu jeito.</span>
          </h2>
          <p className="text-[#8E8E93] text-center text-base sm:text-lg max-w-xl mx-auto mb-10 font-['DM_Sans',sans-serif]">
            100% personalizável. Widgets reorganizáveis. Perfis separados para cada contexto da sua vida.
          </p>
        </RevealOnScroll>

        {/* Interactive color picker */}
        <RevealOnScroll className="max-w-md mx-auto mb-8">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-[#636366] uppercase tracking-widest mb-4 font-['DM_Sans',sans-serif]">Experimente: toque em uma cor</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {themeColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setActiveColor(color.value)}
                  className="w-10 h-10 rounded-xl transition-all duration-200 hover:scale-110 flex items-center justify-center"
                  style={{
                    background: `${color.value}20`,
                    border: activeColor === color.value ? `2px solid ${color.value}` : "2px solid transparent",
                    boxShadow: activeColor === color.value ? `0 0 20px ${color.value}30` : "none",
                  }}
                  title={color.name}
                >
                  <div className="w-5 h-5 rounded-lg" style={{ background: color.value }} />
                </button>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        {/* Dashboard preview with wallpaper thumbnails */}
        <RevealOnScroll delay={0.1} className="max-w-lg mx-auto mb-10">
          <div
            className="rounded-2xl overflow-hidden transition-all duration-500"
            style={{
              border: `1px solid ${activeColor}40`,
              boxShadow: `0 0 30px ${activeColor}10`,
            }}
          >
            {/* Active wallpaper preview */}
            <div
              className="h-32 sm:h-40 transition-all duration-700 relative"
              style={{ background: wallpapers[activeWallpaper].gradient }}
            >
              {/* Mini overlay simulating dashboard widgets */}
              <div className="absolute inset-0 flex items-end p-3">
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-6 rounded-md transition-all duration-500"
                      style={{
                        width: i === 1 ? 60 : 40,
                        background: `${activeColor}20`,
                        border: `1px solid ${activeColor}30`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Wallpaper thumbnails grid */}
            <div className="p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
              <p className="text-[10px] text-[#636366] uppercase tracking-widest mb-2">Wallpapers</p>
              <div className="grid grid-cols-6 gap-1.5">
                {wallpapers.map((wp, i) => (
                  <button
                    key={wp.name}
                    onClick={() => setActiveWallpaper(i)}
                    className="h-10 sm:h-12 rounded-lg transition-all duration-200 hover:scale-105"
                    style={{
                      background: wp.gradient,
                      border: activeWallpaper === i ? `2px solid ${activeColor}` : "2px solid transparent",
                      boxShadow: activeWallpaper === i ? `0 0 12px ${activeColor}30` : "none",
                    }}
                    title={wp.name}
                  />
                ))}
              </div>
            </div>

            {/* Bottom accent bar */}
            <div className="h-1 transition-colors duration-500" style={{ background: activeColor }} />
          </div>
        </RevealOnScroll>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          {stats.map((stat, i) => (
            <RevealOnScroll key={i} delay={i * 0.1}>
              <div className="text-center">
                <stat.icon className="w-5 h-5 mx-auto mb-2 transition-colors duration-300" style={{ color: activeColor }} />
                <div className="text-2xl font-bold text-[#F5F5F7] font-['JetBrains_Mono',monospace]">
                  {stat.display ? stat.display : <AnimatedCounter value={stat.value} />}
                </div>
                <p className="text-[11px] text-[#636366] mt-1">{stat.label}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
