import { DollarSign, Mail, CheckSquare, MessageSquare, Users, Zap, FolderOpen } from "lucide-react";
import { RevealOnScroll } from "./ui/RevealOnScroll";
import { TiltCard } from "./ui/TiltCard";
/* ── Mini preview components for each card ── */

function MiniChart() {
  return (
    <div className="h-[100px] w-full flex items-end gap-1.5 px-3 pt-3 pb-2">
      {[40, 65, 35, 80, 55, 70, 45, 90, 60, 75, 50, 85].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${h}%`,
            background: i >= 10 ? "rgba(200,149,108,0.5)" : "rgba(200,149,108,0.15)",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

function MiniInbox() {
  return (
    <div className="px-3 pt-3 pb-2 space-y-1.5">
      {[
        { from: "Banco", subject: "Extrato disponível", unread: true },
        { from: "Maria S.", subject: "Re: Reunião amanhã", unread: true },
        { from: "Newsletter", subject: "Novidades da semana", unread: false },
      ].map((e, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.unread ? "bg-[#64D2FF]" : "bg-transparent"}`} />
          <span className="text-[10px] text-[#8E8E93] truncate flex-shrink-0 w-12 font-medium">{e.from}</span>
          <span className="text-[10px] text-[#636366] truncate">{e.subject}</span>
        </div>
      ))}
    </div>
  );
}

function MiniKanban() {
  return (
    <div className="px-3 pt-3 pb-2 flex gap-2">
      {["A fazer", "Em prog.", "Feito"].map((col, ci) => (
        <div key={ci} className="flex-1">
          <div className="text-[8px] text-[#636366] mb-1 text-center">{col}</div>
          <div className="space-y-1">
            {Array.from({ length: ci === 1 ? 2 : ci === 2 ? 1 : 3 }).map((_, i) => (
              <div key={i} className="h-4 rounded" style={{ background: ci === 2 ? "rgba(48,209,88,0.15)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


function MiniContactScore() {
  return (
    <div className="px-3 pt-3 pb-2 flex items-center justify-center">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#BF5AF2" strokeWidth="3" strokeDasharray="75 25" strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#F5F5F7]">75</span>
      </div>
      <div className="ml-3 space-y-1">
        <div className="text-[10px] text-[#8E8E93]">Score médio</div>
        <div className="text-[10px] text-[#636366]">142 contatos</div>
      </div>
    </div>
  );
}

function MiniAutomation() {
  return (
    <div className="px-3 pt-3 pb-2 flex items-center gap-2 justify-center">
      <div className="px-2 py-1 rounded-md text-[9px] text-[#FFD60A] border border-[#FFD60A]/20" style={{ background: "rgba(255,214,10,0.08)" }}>Trigger</div>
      <div className="w-6 h-px bg-[#636366] relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-[#636366] border-y-2 border-y-transparent" />
      </div>
      <div className="px-2 py-1 rounded-md text-[9px] text-[#30D158] border border-[#30D158]/20" style={{ background: "rgba(48,209,88,0.08)" }}>Action</div>
    </div>
  );
}

function MiniChat() {
  return (
    <div className="px-3 pt-3 pb-2 space-y-1.5">
      <div className="flex justify-start">
        <div className="px-2 py-1 rounded-lg rounded-bl-sm text-[9px] text-[#F5F5F7] max-w-[70%]" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          Oi! Preciso do orçamento
        </div>
      </div>
      <div className="flex justify-end">
        <div className="px-2 py-1 rounded-lg rounded-br-sm text-[9px] text-[#F5F5F7] max-w-[70%]" style={{ background: "rgba(48,209,88,0.15)" }}>
          Claro! Enviando agora ✓✓
        </div>
      </div>
    </div>
  );
}

function MiniFiles() {
  return (
    <div className="px-3 pt-3 pb-2 grid grid-cols-3 gap-1.5">
      {["📄", "📊", "🖼️", "📁", "📋", "📎"].map((icon, i) => (
        <div key={i} className="h-8 rounded-md flex items-center justify-center text-[10px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {icon}
        </div>
      ))}
    </div>
  );
}

const PREVIEWS: Record<string, React.FC> = {
  "Finanças": MiniChart,
  "E-mail": MiniInbox,
  "Tarefas": MiniKanban,
  "Contatos CRM": MiniContactScore,
  "Automações": MiniAutomation,
  "WhatsApp": MiniChat,
  "Arquivos": MiniFiles,
};

const modules = [
  {
    icon: DollarSign, title: "Finanças", span: "col-span-2 row-span-2",
    desc: "Open Banking real com Pluggy. Seus bancos conectados, despesas categorizadas, saúde financeira calculada.",
    tags: ["Open Banking", "Projeção", "Score Financeiro"],
    color: "#30D158",
  },
  {
    icon: Mail, title: "E-mail", span: "col-span-1 row-span-1",
    desc: "3 contas Gmail unificadas. IA que resume, limpa, categoriza e sugere respostas.",
    tags: ["Multi-conta", "IA", "Smart Labels"],
    color: "#64D2FF",
  },
  {
    icon: CheckSquare, title: "Tarefas", span: "col-span-1 row-span-1",
    desc: "Kanban, subtarefas, projetos e Google Tasks sync. Produtividade sem atrito.",
    tags: ["Kanban", "Google Tasks"],
    color: "#FFD60A",
  },
  {
    icon: MessageSquare, title: "WhatsApp", span: "col-span-1 row-span-1",
    desc: "WhatsApp Business integrado. Mensagens, contatos e automações em um só painel.",
    tags: ["Business API", "Automações"],
    color: "#30D158",
  },
  {
    icon: Users, title: "Contatos CRM", span: "col-span-1 row-span-1",
    desc: "CRM pessoal com score de relacionamento. Saiba quem precisa de atenção.",
    tags: ["Score", "Follow-up"],
    color: "#BF5AF2",
  },
  {
    icon: Zap, title: "Automações", span: "col-span-1 row-span-1",
    desc: "11 templates prontos. Email chega → tarefa criada. Hábito falha → lembrete enviado.",
    tags: ["Trigger→Action", "Templates"],
    color: "#FFD60A",
  },
  {
    icon: FolderOpen, title: "Arquivos", span: "col-span-1 row-span-1",
    desc: "Google Drive integrado. Upload, organização com IA, busca inteligente.",
    tags: ["Google Drive", "IA"],
    color: "#64D2FF",
  },
];

export function ModulesShowcase() {
  return (
    <section id="modules" className="relative py-20 md:py-28" style={{ background: "#0A0A0F" }}>
      {/* Section separator */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="absolute inset-0" style={{
        backgroundImage: "linear-gradient(180deg, transparent 0%, rgba(200,149,108,0.02) 50%, transparent 100%)",
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <RevealOnScroll>
          <h2 className="font-sans font-bold text-3xl sm:text-4xl md:text-5xl text-[#F5F5F7] text-center leading-[1.1] tracking-[-0.02em] mb-4">
            Tudo que você precisa.<br /><span className="text-[#C8956C]">Em um só lugar.</span>
          </h2>
          <p className="text-[#8E8E93] text-center text-base sm:text-lg max-w-xl mx-auto mb-10 font-['DM_Sans',sans-serif]">
            Módulos integrados que conversam entre si. Nenhum outro app faz isso.
          </p>
        </RevealOnScroll>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const isLarge = i === 0;
            const Preview = PREVIEWS[mod.title];
            return (
              <RevealOnScroll
                key={i}
                delay={i * 0.06}
                className={isLarge ? "sm:col-span-2 lg:col-span-2 sm:row-span-2 lg:row-span-2" : ""}
              >
                <TiltCard
                  className={`group relative h-full rounded-[20px] overflow-hidden transition-all duration-400 ${isLarge ? "min-h-[300px]" : ""}`}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                  glowColor={`${mod.color}15`}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "rgba(200, 149, 108, 0.15)";
                    el.style.boxShadow = "0 0 40px rgba(200, 149, 108, 0.06)";
                    el.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.borderColor = "rgba(255, 255, 255, 0.08)";
                    el.style.boxShadow = "none";
                    el.style.background = "rgba(255, 255, 255, 0.03)";
                  }}
                >
                  {/* Mini preview */}
                  {Preview && (
                    <div className="border-b border-white/[0.04]">
                      <Preview />
                    </div>
                  )}

                  <div className="p-5 sm:p-6">
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${mod.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: mod.color }} />
                    </div>

                    <h3 className="text-lg font-semibold text-[#F5F5F7] mb-2 font-['DM_Sans',sans-serif]">
                      {mod.title}
                    </h3>
                    <p className="text-sm text-[#8E8E93] leading-relaxed mb-4 font-['DM_Sans',sans-serif]">
                      {mod.desc}
                    </p>

                    {/* Tags - pill style */}
                    <div className="flex flex-wrap gap-2">
                      {mod.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium font-['JetBrains_Mono',monospace]"
                          style={{
                            background: "rgba(200, 149, 108, 0.1)",
                            border: "1px solid rgba(200, 149, 108, 0.2)",
                            color: "#C8956C",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </TiltCard>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}
