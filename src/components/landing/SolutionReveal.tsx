import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { useReducedMotion } from "@/hooks/ui/useReducedMotion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Home, Calendar, Mail, DollarSign, CheckSquare,
  Heart, FileText, Users, Map, BarChart3, Cloud, Music,
  Link2, Lock, Flame, Clock,
} from "lucide-react";

const steps = [
  { label: "Conheça seu novo centro de comando", area: "full" },
  { label: "Calendário e tarefas em um só lugar, com gamificação", area: "calendar" },
  { label: "Seus emails organizados com IA: limpeza, categorização, respostas sugeridas", area: "email" },
  { label: "Open Banking real. Seus bancos conectados e analisados", area: "finance" },
  { label: "Hábitos, notas e saúde mental integrados", area: "habits" },
  { label: "E a Pandora coordenando tudo para você", area: "pandora" },
  { label: "Tudo em um lugar. Tudo conectado.", area: "complete" },
];

const sidebarIcons = [Home, Calendar, Mail, DollarSign, CheckSquare, Heart, FileText, Users, Map];

const widgetDefs = [
  { id: "calendar", label: "Calendário", col: "col-span-2", rows: "row-span-2", icon: Calendar },
  { id: "tasks", label: "Tarefas", col: "", rows: "", icon: CheckSquare },
  { id: "weather", label: "Clima", col: "", rows: "", icon: Cloud },
  { id: "finance", label: "Finanças", col: "col-span-2", rows: "", icon: BarChart3 },
  { id: "email", label: "Emails", col: "", rows: "", icon: Mail },
  { id: "habits", label: "Hábitos", col: "", rows: "", icon: Flame },
  { id: "notes", label: "Notas", col: "", rows: "", icon: FileText },
  { id: "music", label: "Música", col: "", rows: "", icon: Music },
  { id: "links", label: "Links", col: "", rows: "", icon: Link2 },
  { id: "contacts", label: "Contatos", col: "", rows: "", icon: Users },
  { id: "clock", label: "Relógio", col: "", rows: "", icon: Clock },
  { id: "passwords", label: "Senhas", col: "", rows: "", icon: Lock },
];

// Map step area to which widget IDs glow
const areaHighlightMap: Record<string, string[]> = {
  full: [],
  calendar: ["calendar", "tasks"],
  email: ["email"],
  finance: ["finance"],
  habits: ["habits", "notes"],
  pandora: widgetDefs.map((w) => w.id),
  complete: widgetDefs.map((w) => w.id),
};

/* ─── Mini widget content renderers ─── */
function MiniCalendar() {
  const days = ["S","T","Q","Q","S","S","D"];
  return (
    <div className="mt-1">
      <div className="flex justify-between mb-0.5">{days.map((d,i)=><span key={i} className="text-[5px] text-[#636366] w-3 text-center">{d}</span>)}</div>
      {[0,1,2].map(r=>(
        <div key={r} className="flex justify-between">
          {Array.from({length:7}).map((_,c)=>{
            const day=r*7+c+1;
            const today=day===14;
            const hasEvent=day===10||day===18||day===22;
            return <span key={c} className={`text-[5px] w-3 h-3 flex items-center justify-center rounded-full ${today?"bg-[#C8956C] text-[#0A0A0F] font-bold":hasEvent?"text-[#C8956C]":"text-[#8E8E93]"}`}>{day<=28?day:""}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
function MiniTasks() {
  const tasks=[{done:true,t:"Revisar contrato"},{done:true,t:"Pagar fatura"},{done:false,t:"Ligar para cliente"},{done:false,t:"Enviar proposta"}];
  return <div className="mt-1 space-y-0.5">{tasks.map((tk,i)=><div key={i} className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-sm border ${tk.done?"bg-[#C8956C] border-[#C8956C]":"border-[#636366]"}`}/><span className={`text-[5px] ${tk.done?"text-[#636366] line-through":"text-[#8E8E93]"}`}>{tk.t}</span></div>)}</div>;
}
function MiniWeather() {
  return <div className="mt-1 flex items-end gap-1"><span className="text-sm font-bold text-[#F5F5F7] leading-none">24°</span><span className="text-[5px] text-[#636366] mb-0.5">São Paulo • Parcialmente nublado</span></div>;
}
function MiniFinance() {
  const bars=[35,55,40,70,50,65,80,45,60,75,55,90];
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[7px] text-[#28C840] font-medium">+R$ 2.450</span>
        <span className="text-[5px] text-[#636366]">este mês</span>
      </div>
      <div className="flex items-end gap-px h-5">{bars.map((h,i)=><div key={i} className="flex-1 rounded-t-sm" style={{height:`${h}%`,background:i>=10?"rgba(200,149,108,0.6)":"rgba(200,149,108,0.25)"}}/>)}</div>
    </div>
  );
}
function MiniEmail() {
  const emails=[{from:"Ana Costa",sub:"Re: Proposta atualizada",time:"10:32",unread:true},{from:"Newsletter",sub:"Seu resumo semanal",time:"09:15",unread:false},{from:"Banco C6",sub:"Fatura disponível",time:"08:40",unread:true}];
  return <div className="mt-1 space-y-0.5">{emails.map((e,i)=><div key={i} className="flex justify-between items-center"><div className="flex items-center gap-1">{e.unread&&<div className="w-1 h-1 rounded-full bg-[#C8956C]"/>}<span className={`text-[5px] ${e.unread?"text-[#F5F5F7] font-medium":"text-[#636366]"}`}>{e.from}</span></div><span className="text-[4px] text-[#636366]">{e.time}</span></div>)}</div>;
}
function MiniHabits() {
  const habits=[{n:"Meditação",done:true,streak:12},{n:"Exercício",done:false,streak:5},{n:"Leitura",done:true,streak:30}];
  return <div className="mt-1 space-y-0.5">{habits.map((h,i)=><div key={i} className="flex items-center justify-between"><div className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${h.done?"bg-[#28C840]":"border border-[#636366]"}`}/><span className="text-[5px] text-[#8E8E93]">{h.n}</span></div><span className="text-[4px] text-[#C8956C]">🔥{h.streak}</span></div>)}</div>;
}
function MiniNotes() {
  return <div className="mt-1"><div className="text-[5px] text-[#8E8E93] leading-relaxed">Ideias para o projeto Q2...<br/>• Rever budget marketing<br/>• Agendar call com equipe</div></div>;
}
function MiniContacts() {
  return <div className="mt-1 flex gap-1">{["#C8956C","#5B9BD5","#28C840","#FFB84D"].map((c,i)=><div key={i} className="w-4 h-4 rounded-full text-[5px] font-bold flex items-center justify-center text-white/80" style={{background:c}}>{["FC","AM","LS","RT"][i]}</div>)}</div>;
}

const widgetContentMap: Record<string, () => React.ReactNode> = {
  calendar: MiniCalendar, tasks: MiniTasks, weather: MiniWeather,
  finance: MiniFinance, email: MiniEmail, habits: MiniHabits,
  notes: MiniNotes, contacts: MiniContacts,
};

function DashboardMockup({ activeArea }: { activeArea: string }) {
  const highlightedIds = areaHighlightMap[activeArea] || [];
  const allHighlighted = activeArea === "complete" || activeArea === "pandora";

  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{
        boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 120px rgba(200,149,108,0.05)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: "#0D0D14" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 rounded-md text-[10px] text-[#636366]" style={{ background: "rgba(255,255,255,0.04)" }}>
            desh-ws.lovable.app
          </div>
        </div>
      </div>

      {/* Dashboard body */}
      <div className="flex" style={{ background: "#1A1A28", minHeight: 320 }}>
        {/* Sidebar */}
        <div className="w-12 flex-shrink-0 flex flex-col items-center py-3 gap-3" style={{ background: "#12121A", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
          {sidebarIcons.map((Icon, i) => (
            <Icon key={i} className="w-4 h-4 transition-colors duration-500" style={{ color: i === 0 ? "#C8956C" : "#636366" }} />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-3 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] text-[#C8956C] font-medium font-['DM_Sans',sans-serif]">Boa noite, Felipe</div>
              <div className="text-[7px] text-[#636366] font-['DM_Sans',sans-serif]">Terça-feira, 22 de fevereiro</div>
            </div>
            <div className="w-6 h-6 rounded-full" style={{ background: "linear-gradient(135deg, #C8956C, #E8B98A)" }} />
          </div>

          {/* Widget grid — realistic */}
          <div className="grid grid-cols-4 gap-1.5 auto-rows-[52px]">
            {widgetDefs.map((w) => {
              const isHighlighted = allHighlighted || highlightedIds.includes(w.id);
              const ContentComp = widgetContentMap[w.id];
              return (
                <div
                  key={w.id}
                  className={`rounded-lg p-1.5 flex flex-col transition-all duration-500 ${w.col} ${w.rows}`}
                  style={{
                    background: isHighlighted ? "rgba(200,149,108,0.10)" : "rgba(255,255,255,0.03)",
                    border: isHighlighted ? "1px solid rgba(200,149,108,0.25)" : "1px solid rgba(255,255,255,0.04)",
                    boxShadow: isHighlighted ? "0 0 24px rgba(200,149,108,0.1)" : "none",
                  }}
                >
                  <div className="flex items-center gap-1">
                    <w.icon className="w-2.5 h-2.5" style={{ color: isHighlighted ? "#C8956C" : "#636366" }} />
                    <span className="text-[6px] text-[#8E8E93] font-medium tracking-wide uppercase">{w.label}</span>
                  </div>
                  {ContentComp ? <ContentComp /> : <div className="flex-1" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SolutionReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const imageOpacity = useTransform(scrollYProgress, [0, 0.1], [0.3, 1]);
  const glowOpacity = useTransform(scrollYProgress, [0.6, 0.85], [0, 0.4]);

  // Determine active step area based on scroll
  const activeStepIndex = useTransform(scrollYProgress, (v) => Math.min(Math.floor(v * steps.length), steps.length - 1));

  // Mobile: simple accordion-style
  if (isMobile) {
    return (
      <section id="solution" className="py-20 px-4" style={{ background: "#0A0A0F" }}>
        <RevealOnScroll>
          <h2 className="font-sans font-bold text-3xl text-[#F5F5F7] text-center leading-[1.1] tracking-[-0.02em] mb-12">
            Conheça seu novo<br />centro de comando
          </h2>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1}>
          <div className="mb-10">
            <DashboardMockup activeArea="complete" />
          </div>
        </RevealOnScroll>

        <div className="space-y-4 max-w-md mx-auto">
          {steps.slice(1).map((step, i) => (
            <RevealOnScroll key={i} delay={i * 0.08}>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-6 h-6 rounded-full bg-[#C8956C]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[#C8956C] text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-sm text-[#F5F5F7] font-['DM_Sans',sans-serif]">{step.label}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>
    );
  }

  // Desktop: sticky scroll reveal
  return (
    <section id="solution" ref={containerRef} className="relative" style={{ height: "400vh", background: "#12121A" }}>
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(200,149,108,0.04) 0%, transparent 60%)",
        }} />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 grid grid-cols-5 gap-12 items-center">
          {/* Left: text steps */}
          <div className="col-span-2 space-y-6">
            {steps.map((step, i) => {
              const start = i / steps.length;
              const end = (i + 1) / steps.length;
              return (
                <StepText key={i} text={step.label} progress={scrollYProgress} start={start} end={end} index={i} />
              );
            })}
          </div>

          {/* Right: dashboard mockup */}
          <div className="col-span-3 relative">
            <motion.div
              style={reduced ? {} : { opacity: imageOpacity }}
            >
              <ActiveAreaMockup progress={scrollYProgress} />
              {/* Golden glow overlay at completion */}
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  opacity: glowOpacity,
                  boxShadow: "inset 0 0 80px rgba(200,149,108,0.15), 0 0 60px rgba(200,149,108,0.1)",
                }}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Wrapper that derives activeArea from scroll progress */
function ActiveAreaMockup({ progress }: { progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const area = useTransform(progress, (v) => {
    const idx = Math.min(Math.floor(v * steps.length), steps.length - 1);
    return steps[idx].area;
  });
  // Use motion value to string
  const areaStr = useMotionString(area);
  return <DashboardMockup activeArea={areaStr} />;
}

/** Small hook to read a MotionValue<string> reactively */
function useMotionString(mv: ReturnType<typeof useTransform<number, string>>) {
  const [val, setVal] = useState(mv.get());
  useEffect(() => mv.on("change", setVal), [mv]);
  return val as string;
}

function StepText({ text, progress, start, end, index }: {
  text: string;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  start: number;
  end: number;
  index: number;
}) {
  const opacity = useTransform(progress, [start, start + 0.03, end - 0.03, end], [0.25, 1, 1, 0.25]);
  const x = useTransform(progress, [start, start + 0.05], [10, 0]);

  return (
    <motion.div className="flex items-start gap-3" style={{ opacity, x }}>
      <div className="w-6 h-6 rounded-full bg-[#C8956C]/20 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-[#C8956C] text-xs font-bold">{index + 1}</span>
      </div>
      <p className="text-base text-[#F5F5F7] font-['DM_Sans',sans-serif] leading-relaxed">{text}</p>
    </motion.div>
  );
}
