import { RevealOnScroll } from "./ui/RevealOnScroll";
import { AnimatedCounter } from "./ui/AnimatedCounter";
import { STATS } from "@/lib/landing-config";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Mariana Santos",
    role: "Product Manager, Startup SaaS",
    text: "O DESH substituiu Notion, Todoist e 3 planilhas. A Pandora me dá um briefing matinal que economiza 30min todo dia.",
  },
  {
    name: "Rafael Oliveira",
    role: "Desenvolvedor Full-Stack",
    text: "A integração com Open Banking é real. Conectei meu Nubank e C6 em 2 minutos. Nunca mais abri planilha de gastos.",
  },
  {
    name: "Camila Ferreira",
    role: "Designer UX, Freelancer",
    text: "O sistema de XP e streaks me fez manter hábitos que eu abandonava em 3 dias. Estou no level 12 e não quero parar.",
  },
  {
    name: "Lucas Mendes",
    role: "CEO, Agência Digital",
    text: "Gerencio 3 perfis no DESH: pessoal, agência e side-project. Tudo separado e organizado. Personalização incrível.",
  },
  {
    name: "Ana Paula Costa",
    role: "Advogada, Escritório Próprio",
    text: "A Pandora organiza meus emails por urgência e já sugere respostas. Minha produtividade dobrou desde que comecei a usar.",
  },
  {
    name: "Thiago Nascimento",
    role: "Engenheiro de Dados",
    text: "O CRM pessoal com score de relacionamento me ajudou a manter networking ativo. Feature única que nunca vi em outro app.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 md:py-28 px-4 sm:px-6 relative overflow-hidden" style={{ background: "#0A0A0F" }}>
      {/* Section separator */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="max-w-6xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-12">
            <p className="text-[#C8956C] text-sm font-medium tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Depoimentos
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-[#F5F5F7]" style={{ fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>
              O que dizem os{" "}
              <span className="bg-gradient-to-r from-[#C8956C] to-[#E8B98A] bg-clip-text text-transparent">usuários</span>
            </h2>
          </div>
        </RevealOnScroll>

        {/* Marquee */}
        <div className="relative mb-14">
          <div className="flex gap-6 animate-marquee hover:[animation-play-state:paused]">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={i}
                className="w-[340px] flex-shrink-0 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#C8956C]/20"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Quote className="w-6 h-6 text-[#C8956C]/40 mb-3" />
                <p className="text-[#F5F5F7] text-sm leading-relaxed mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  "{t.text}"
                </p>
                <div>
                  <p className="text-[#F5F5F7] text-sm font-medium">{t.name}</p>
                  <p className="text-[#636366] text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0A0A0F] to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0A0A0F] to-transparent pointer-events-none" />
        </div>

        {/* Stats */}
        <RevealOnScroll>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-[#F5F5F7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <AnimatedCounter value={s.value} />{s.suffix}
                </p>
                <p className="text-[#8E8E93] text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </section>
  );
}
