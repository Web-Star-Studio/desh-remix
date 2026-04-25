import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  DollarSign,
  Mail,
  CheckSquare,
  MessageSquare,
  Users,
  Zap,
  FolderOpen,
  Calendar,
  FileText,
  Bot,
  Share2,
  Sparkles,
} from "lucide-react";
import { ScrollProgressBar } from "@/components/landing/ui/ScrollProgressBar";
import WelcomeNavbar from "@/components/welcome/WelcomeNavbar";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";
import WelcomeChatBubble from "@/components/welcome/WelcomeChatBubble";
import { WelcomeThemeProvider, useWelcomeTheme } from "@/components/welcome/WelcomeThemeContext";

type Module = {
  num: string;
  icon: React.ElementType;
  name: string;
  tagline: string;
  description: string;
  capabilities: string[];
  integrations: string[];
};

const MODULES: Module[] = [
  {
    num: "01",
    icon: DollarSign,
    name: "Finanças",
    tagline: "Open Banking real, não planilha.",
    description:
      "Conecte seus bancos via Pluggy. Despesas categorizadas automaticamente, projeção de fluxo de caixa, score de saúde financeira e investimentos consolidados em um único painel.",
    capabilities: ["Open Banking PIX", "Categorização IA", "Projeção mensal", "Score financeiro", "Investimentos"],
    integrations: ["Pluggy", "Itaú", "Nubank", "Inter", "BTG"],
  },
  {
    num: "02",
    icon: Mail,
    name: "E-mail",
    tagline: "Sua caixa, finalmente sob controle.",
    description:
      "Múltiplas contas Gmail unificadas. A Pandora resume threads longas, sugere respostas, limpa newsletters em massa e cria tarefas a partir de e-mails importantes.",
    capabilities: ["Multi-conta Gmail", "Resumos IA", "Smart Cleanup", "Snooze inteligente", "Reply assistido"],
    integrations: ["Gmail", "Google Workspace"],
  },
  {
    num: "03",
    icon: CheckSquare,
    name: "Tarefas",
    tagline: "Kanban que não te abandona.",
    description:
      "Listas, projetos, subtarefas e tags. Sincroniza com Google Tasks em tempo real. Pomodoro embutido, time tracking individual e visualização Kanban ou lista.",
    capabilities: ["Kanban + Lista", "Subtarefas", "Pomodoro", "Time tracking", "Google Tasks sync"],
    integrations: ["Google Tasks"],
  },
  {
    num: "04",
    icon: Calendar,
    name: "Calendário",
    tagline: "Toda agenda, um único lugar.",
    description:
      "Google Calendar integrado com calendários secundários, eventos coloridos por categoria e detecção de conflitos. Crie eventos por linguagem natural via Pandora.",
    capabilities: ["Multi-calendário", "Conflitos auto", "Linguagem natural", "Categorias", "Convidados"],
    integrations: ["Google Calendar"],
  },
  {
    num: "05",
    icon: Users,
    name: "Contatos CRM",
    tagline: "Relacionamento com método.",
    description:
      "CRM pessoal com score de relacionamento. Saiba quem está esfriando, registre interações, vincule e-mails e tarefas. Sincronização bilateral com Google Contacts.",
    capabilities: ["Score de relacionamento", "Histórico de interações", "Pipelines", "Tags personalizadas", "Google sync"],
    integrations: ["Google Contacts"],
  },
  {
    num: "06",
    icon: MessageSquare,
    name: "WhatsApp",
    tagline: "Pessoal e Business, juntos.",
    description:
      "Conecte WhatsApp pessoal (Evolution API) e Business API. Conversas, contatos, automações e a Pandora respondendo por você quando autorizado.",
    capabilities: ["Pessoal + Business", "Pandora autônoma", "Auto-recuperação", "Multi-workspace", "Mídia integrada"],
    integrations: ["Evolution API", "Meta Business"],
  },
  {
    num: "07",
    icon: Zap,
    name: "Automações",
    tagline: "Se isto, então aquilo. Mas inteligente.",
    description:
      "11 templates prontos e construtor visual. E-mail chega → tarefa criada. Hábito falha → lembrete enviado. Engine proativo via pg_cron e barramento de eventos.",
    capabilities: ["11 templates", "Trigger → Action", "Agendamentos", "Eventos em tempo real", "Logs detalhados"],
    integrations: ["pg_cron", "Realtime"],
  },
  {
    num: "08",
    icon: FolderOpen,
    name: "Arquivos",
    tagline: "Storage nativo + Google Drive.",
    description:
      "Cloudflare R2 para uploads nativos, Google Drive integrado com explorador hierárquico. Categorização IA, OCR, versionamento e share links protegidos.",
    capabilities: ["Cloudflare R2", "Google Drive", "OCR", "Versionamento", "Share links"],
    integrations: ["Google Drive", "Cloudflare R2"],
  },
  {
    num: "09",
    icon: FileText,
    name: "Notas",
    tagline: "Editor TipTap com inteligência.",
    description:
      "Editor moderno com imagens inline, menções @ aos contatos, comandos slash, auto-save resiliente e organização por projetos. Sincroniza pensamentos sem fricção.",
    capabilities: ["TipTap rich-text", "Menções @", "Slash commands", "Auto-save visibility-aware", "Imagens inline"],
    integrations: ["Pandora IA"],
  },
  {
    num: "10",
    icon: Share2,
    name: "Redes Sociais",
    tagline: "Multi-plataforma, multi-conta.",
    description:
      "Publique e agende em Instagram, LinkedIn, X, Facebook e TikTok via GetLate. Análise de tendências, posts mais engajados e DMs unificadas no Inbox.",
    capabilities: ["5 plataformas", "Agendamento", "Análise de tendências", "DMs unificadas", "Multi-conta"],
    integrations: ["GetLate", "Instagram", "LinkedIn", "X"],
  },
  {
    num: "11",
    icon: Bot,
    name: "Pandora IA",
    tagline: "A inteligência por trás de tudo.",
    description:
      "Assistente unificada que opera no Chat, WhatsApp e MCP. Acessa todos os módulos, executa ferramentas via Composio, mantém contexto pessoal e responde proativamente.",
    capabilities: ["65+ ferramentas", "Multi-canal", "Contexto pessoal", "Modo MCP", "Workspace-aware"],
    integrations: ["Composio", "Lovable AI", "Anthropic"],
  },
];

function ModulesContent() {
  const { theme } = useWelcomeTheme();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -40]);

  useEffect(() => {
    document.title = "DESH — Módulos";
    document.documentElement.style.backgroundColor = "#050507";
    document.body.style.backgroundColor = "#050507";
    return () => {
      document.title = "DESH";
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  return (
    <div
      className="min-h-screen overflow-x-hidden relative"
      style={{ background: "#050507", color: theme.text }}
    >
      <ScrollProgressBar />
      <WelcomeNavbar />

      {/* Subtle grain texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.025]"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      <main className="relative z-[2]">
        {/* ─────────── HERO ─────────── */}
        <section className="pt-36 md:pt-48 pb-20 md:pb-28 px-6 md:px-12">
          <motion.div
            style={{ opacity: heroOpacity, y: heroY }}
            className="max-w-[1400px] mx-auto"
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-12">
              <div className="h-px w-12" style={{ background: "rgba(200,149,108,0.4)" }} />
              <span
                className="text-[10px] tracking-[0.25em] font-medium uppercase"
                style={{ color: "#C8956C", fontFamily: "'JetBrains Mono', monospace" }}
              >
                Índice · 11 módulos
              </span>
            </div>

            {/* Massive editorial title */}
            <h1
              className="font-bold text-[#F5F5F7] leading-[0.92] tracking-[-0.04em] mb-10"
              style={{
                fontSize: "clamp(3rem, 9vw, 8.5rem)",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Cada módulo,
              <br />
              <span className="italic font-light text-[#8E8E93]">uma decisão</span>
              <br />
              deliberada.
            </h1>

            {/* Subtitle + meta */}
            <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end mt-16">
              <p
                className="md:col-span-6 text-[#8E8E93] text-lg md:text-xl leading-[1.5] font-light"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Não somos um app que faz tudo mediocremente. Somos onze ferramentas
                construídas com obsessão, conectadas por uma inteligência que entende
                o todo.
              </p>

              <div className="md:col-span-6 md:col-start-8 grid grid-cols-3 gap-6">
                <Stat label="Módulos" value="11" />
                <Stat label="Integrações" value="20+" />
                <Stat label="Ferramentas IA" value="65+" />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Section divider */}
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* ─────────── INDEX (table of modules) ─────────── */}
        <section className="py-24 md:py-32 px-6 md:px-12">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid md:grid-cols-12 gap-8 mb-20">
              <div className="md:col-span-3">
                <span
                  className="text-[10px] tracking-[0.25em] font-medium uppercase"
                  style={{ color: "#C8956C", fontFamily: "'JetBrains Mono', monospace" }}
                >
                  § Índice
                </span>
              </div>
              <h2
                className="md:col-span-9 text-[#F5F5F7] font-light leading-[1.1] tracking-[-0.02em]"
                style={{
                  fontSize: "clamp(1.75rem, 3.5vw, 3rem)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Onze módulos. Um único organismo.
              </h2>
            </div>

            {/* Module list — editorial table */}
            <div>
              {MODULES.map((mod, i) => {
                const Icon = mod.icon;
                const isHovered = hoveredIdx === i;
                return (
                  <motion.a
                    key={mod.num}
                    href={`#${mod.num}`}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="group block border-t border-white/[0.06] last:border-b transition-colors duration-500"
                    style={{
                      background: isHovered ? "rgba(200,149,108,0.025)" : "transparent",
                    }}
                  >
                    <div className="grid grid-cols-12 gap-4 md:gap-8 items-center py-6 md:py-8">
                      {/* Number */}
                      <div className="col-span-2 md:col-span-1">
                        <span
                          className="text-[11px] tracking-[0.2em] font-medium"
                          style={{
                            color: isHovered ? "#C8956C" : "#48484A",
                            fontFamily: "'JetBrains Mono', monospace",
                            transition: "color 0.4s ease",
                          }}
                        >
                          {mod.num}
                        </span>
                      </div>

                      {/* Name */}
                      <div className="col-span-10 md:col-span-4">
                        <h3
                          className="font-light tracking-[-0.02em]"
                          style={{
                            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                            color: isHovered ? "#F5F5F7" : "#D1D1D6",
                            fontFamily: "'DM Sans', sans-serif",
                            transition: "color 0.4s ease",
                          }}
                        >
                          {mod.name}
                        </h3>
                      </div>

                      {/* Tagline */}
                      <div className="col-span-12 md:col-span-5 mt-2 md:mt-0">
                        <p
                          className="text-sm md:text-base font-light"
                          style={{
                            color: isHovered ? "#8E8E93" : "#636366",
                            fontFamily: "'DM Sans', sans-serif",
                            transition: "color 0.4s ease",
                          }}
                        >
                          {mod.tagline}
                        </p>
                      </div>

                      {/* Icon + arrow */}
                      <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-4">
                        <Icon
                          size={18}
                          style={{
                            color: isHovered ? "#C8956C" : "#48484A",
                            transition: "color 0.4s ease",
                          }}
                        />
                        <motion.div
                          animate={{ x: isHovered ? 4 : 0, opacity: isHovered ? 1 : 0.3 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ArrowUpRight
                            size={18}
                            style={{ color: isHovered ? "#C8956C" : "#48484A" }}
                          />
                        </motion.div>
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─────────── DETAIL CARDS ─────────── */}
        <section className="py-24 md:py-32 px-6 md:px-12">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid md:grid-cols-12 gap-8 mb-20">
              <div className="md:col-span-3">
                <span
                  className="text-[10px] tracking-[0.25em] font-medium uppercase"
                  style={{ color: "#C8956C", fontFamily: "'JetBrains Mono', monospace" }}
                >
                  § Detalhes
                </span>
              </div>
              <h2
                className="md:col-span-9 text-[#F5F5F7] font-light leading-[1.1] tracking-[-0.02em]"
                style={{
                  fontSize: "clamp(1.75rem, 3.5vw, 3rem)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                A engenharia por trás de cada módulo.
              </h2>
            </div>

            <div className="space-y-32 md:space-y-40">
              {MODULES.map((mod, i) => (
                <ModuleDetail key={mod.num} mod={mod} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ─────────── CTA ─────────── */}
        <section className="py-32 md:py-44 px-6 md:px-12 border-t border-white/[0.06]">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-8">
                <h2
                  className="text-[#F5F5F7] font-light leading-[1.05] tracking-[-0.03em]"
                  style={{
                    fontSize: "clamp(2.5rem, 6vw, 5rem)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Comece com<br />
                  <span className="italic" style={{ color: "#C8956C" }}>
                    cem créditos.
                  </span>
                </h2>
                <p
                  className="text-[#8E8E93] text-base md:text-lg mt-8 max-w-xl font-light"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Trinta dias. Sem cartão. Acesso completo a todos os onze módulos.
                </p>
              </div>

              <div className="md:col-span-4 flex flex-col gap-3 md:items-end">
                <Link
                  to="/auth?tab=signup"
                  className="group inline-flex items-center justify-between gap-6 px-7 py-5 rounded-full transition-all duration-500 hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentSecondary})`,
                    color: "#0A0A0F",
                    minWidth: "260px",
                  }}
                >
                  <span className="text-sm font-semibold tracking-wide">
                    Criar conta grátis
                  </span>
                  <ArrowUpRight size={18} className="transition-transform duration-500 group-hover:rotate-45" />
                </Link>
                <Link
                  to="/welcome"
                  className="text-xs text-[#636366] hover:text-[#8E8E93] transition-colors mt-2 tracking-wider uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  ← Voltar à página inicial
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <WelcomeFooter />
      <WelcomeChatBubble />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[#F5F5F7] font-light leading-none tracking-[-0.04em] mb-2"
        style={{
          fontSize: "clamp(2rem, 3.5vw, 3rem)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {value}
      </div>
      <div
        className="text-[10px] tracking-[0.2em] font-medium uppercase text-[#636366]"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {label}
      </div>
    </div>
  );
}

function ModuleDetail({ mod, index }: { mod: Module; index: number }) {
  const Icon = mod.icon;
  const isReverse = index % 2 === 1;

  return (
    <motion.article
      id={mod.num}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`grid md:grid-cols-12 gap-8 md:gap-16 items-start ${isReverse ? "md:[&>*:first-child]:order-2" : ""}`}
    >
      {/* Visual side */}
      <div className="md:col-span-5">
        <div
          className="aspect-[4/5] rounded-2xl relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Number watermark */}
          <div
            className="absolute top-8 left-8 font-light leading-none"
            style={{
              fontSize: "clamp(8rem, 18vw, 16rem)",
              color: "rgba(245,245,247,0.04)",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "-0.05em",
            }}
          >
            {mod.num}
          </div>

          {/* Centered icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(200,149,108,0.08)",
                border: "1px solid rgba(200,149,108,0.15)",
              }}
            >
              <Icon size={36} style={{ color: "#C8956C" }} />
            </div>
          </div>

          {/* Bottom label */}
          <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
            <span
              className="text-[10px] tracking-[0.25em] font-medium uppercase"
              style={{ color: "#636366", fontFamily: "'JetBrains Mono', monospace" }}
            >
              Módulo · {mod.num}
            </span>
            <Sparkles size={14} style={{ color: "rgba(200,149,108,0.4)" }} />
          </div>
        </div>
      </div>

      {/* Content side */}
      <div className="md:col-span-7">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px w-8" style={{ background: "rgba(200,149,108,0.4)" }} />
          <span
            className="text-[10px] tracking-[0.25em] font-medium uppercase"
            style={{ color: "#C8956C", fontFamily: "'JetBrains Mono', monospace" }}
          >
            {mod.name}
          </span>
        </div>

        {/* Tagline */}
        <h3
          className="text-[#F5F5F7] font-light leading-[1.05] tracking-[-0.025em] mb-8"
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {mod.tagline}
        </h3>

        {/* Description */}
        <p
          className="text-[#8E8E93] text-base md:text-lg leading-[1.6] font-light mb-12 max-w-xl"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {mod.description}
        </p>

        {/* Capabilities list */}
        <div className="mb-10">
          <div
            className="text-[10px] tracking-[0.25em] font-medium uppercase text-[#636366] mb-5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Recursos
          </div>
          <ul className="space-y-3">
            {mod.capabilities.map((cap) => (
              <li
                key={cap}
                className="flex items-baseline gap-4 text-[#D1D1D6] text-sm md:text-base font-light"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <span
                  className="text-[10px] mt-1 flex-shrink-0"
                  style={{
                    color: "#C8956C",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  ›
                </span>
                {cap}
              </li>
            ))}
          </ul>
        </div>

        {/* Integrations */}
        <div>
          <div
            className="text-[10px] tracking-[0.25em] font-medium uppercase text-[#636366] mb-4"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Integrações
          </div>
          <div className="flex flex-wrap gap-2">
            {mod.integrations.map((int) => (
              <span
                key={int}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#8E8E93",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {int}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function ModulesPage() {
  return (
    <WelcomeThemeProvider>
      <ModulesContent />
    </WelcomeThemeProvider>
  );
}
