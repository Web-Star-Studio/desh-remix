import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  MessageSquare,
  Mic,
  Image as ImageIcon,
  Search,
  Calendar,
  Mail,
  CheckSquare,
  DollarSign,
  Users,
  FolderOpen,
  Zap,
  Shield,
  Sparkles,
  Cpu,
  Network,
  Globe,
  Lock,
  Layers,
  Workflow,
  Eye,
  Target,
  Clock,
  Phone,
} from "lucide-react";
import { ScrollProgressBar } from "@/components/landing/ui/ScrollProgressBar";
import WelcomeNavbar from "@/components/welcome/WelcomeNavbar";
import WelcomeFooter from "@/components/welcome/WelcomeFooter";
import WelcomeChatBubble from "@/components/welcome/WelcomeChatBubble";
import { WelcomeThemeProvider } from "@/components/welcome/WelcomeThemeContext";

/* ─────────────────────── Data ─────────────────────── */

type Capability = {
  num: string;
  icon: React.ElementType;
  title: string;
  tagline: string;
  description: string;
  examples: string[];
};

const CAPABILITIES: Capability[] = [
  {
    num: "01",
    icon: MessageSquare,
    title: "Conversa Natural",
    tagline: "Sem prompts, sem fricção.",
    description:
      "Fale como falaria com um chefe de gabinete. A Pandora interpreta intenção, contexto e urgência — não palavras-chave. Memória persistente entre sessões.",
    examples: [
      "Marca um café com Marina semana que vem de manhã",
      "Quanto gastei com restaurante em outubro?",
      "Resume o último e-mail do escritório",
    ],
  },
  {
    num: "02",
    icon: Workflow,
    title: "Execução Multi-passo",
    tagline: "Uma frase, dezenas de ações.",
    description:
      "A Pandora encadeia ferramentas autonomamente. Pede o orçamento por e-mail, cria a tarefa de follow-up, agenda o lembrete e arquiva o anexo no Drive — tudo em uma única instrução.",
    examples: [
      "Envia o contrato para o cliente e cria tarefa de cobrança em 3 dias",
      "Lê meus e-mails não lidos e me dá um resumo executivo",
      "Encontra um horário com a Ana entre quarta e sexta",
    ],
  },
  {
    num: "03",
    icon: Eye,
    title: "Inteligência Proativa",
    tagline: "Antes de você perguntar.",
    description:
      "Detecta padrões e sinaliza o que importa: e-mails urgentes não respondidos, conflitos de calendário, despesas anômalas, hábitos quebrados. Insights, não notificações.",
    examples: [
      "Você tem 3 reuniões sobrepostas amanhã",
      "Gasto com delivery 40% acima da média do mês",
      "Cliente X não responde há 12 dias",
    ],
  },
  {
    num: "04",
    icon: Phone,
    title: "Cross-channel Total",
    tagline: "WhatsApp, web, voz — mesma Pandora.",
    description:
      "Continue uma conversa no WhatsApp que começou no navegador. Mesma memória, mesmas ferramentas, mesma personalidade. 65+ ferramentas disponíveis em todos os canais.",
    examples: [
      "Comece a tarefa pelo celular, finalize pelo desktop",
      "Receba relatórios diários no WhatsApp",
      "Comandos por áudio em qualquer canal",
    ],
  },
  {
    num: "05",
    icon: Layers,
    title: "Skills Personalizadas",
    tagline: "Modele a IA ao seu fluxo.",
    description:
      "Crie skills lazy-loaded que carregam apenas quando relevantes. Defina como a Pandora deve se comportar para vendas, suporte, escrita ou pesquisa — sem inflar o token budget.",
    examples: [
      "Skill 'Comercial' carrega CRM e templates de proposta",
      "Skill 'Escrita' ativa estilo editorial e revisão",
      "12 templates prontos + criação custom",
    ],
  },
  {
    num: "06",
    icon: Search,
    title: "Pesquisa Profunda",
    tagline: "Web search nativa, com fonte.",
    description:
      "Pesquisas com SerpAPI integrado, citações verificáveis e síntese editorial. A Pandora distingue fato de opinião e cita as fontes que usou.",
    examples: [
      "Compara as 3 melhores corretoras para investimento exterior",
      "Pesquisa o histórico fiscal dessa empresa",
      "Resume as últimas notícias sobre o setor",
    ],
  },
  {
    num: "07",
    icon: ImageIcon,
    title: "Geração Visual",
    tagline: "Nano Banana, qualidade Pro.",
    description:
      "Geração e edição de imagens via Gemini 3 Pro Image. Crie thumbnails, mockups, posts sociais ou edite fotos com prompts em português — tudo dentro do chat.",
    examples: [
      "Gera um banner para a campanha de Black Friday",
      "Edita essa foto: deixa o céu mais dramático",
      "Cria 4 variações com sementes diferentes",
    ],
  },
  {
    num: "08",
    icon: Mic,
    title: "Voz & Transcrição",
    tagline: "Reuniões viram conhecimento.",
    description:
      "Transcrição com identificação de speakers, diarização e resumo executivo. Áudios do WhatsApp processados automaticamente. Voz de saída via ElevenLabs.",
    examples: [
      "Transcreve essa reunião de 1h e me dá os action items",
      "Lê meu briefing em voz alta",
      "Identifica quem falou o quê na call",
    ],
  },
];

type Tool = {
  icon: React.ElementType;
  category: string;
  count: string;
  examples: string[];
};

const TOOLS: Tool[] = [
  { icon: Mail, category: "Gmail", count: "12 tools", examples: ["Enviar", "Buscar", "Marcar", "Arquivar", "Rascunhos"] },
  { icon: Calendar, category: "Calendar", count: "9 tools", examples: ["Criar evento", "Encontrar horário livre", "Listar agenda", "Convidar"] },
  { icon: CheckSquare, category: "Tarefas", count: "8 tools", examples: ["Criar", "Concluir", "Subtarefas", "Sincronizar Google Tasks"] },
  { icon: DollarSign, category: "Finanças", count: "10 tools", examples: ["Saldo", "Transações", "Categorizar", "Projetar", "Metas"] },
  { icon: Users, category: "Contatos", count: "7 tools", examples: ["Buscar", "Criar", "Score", "Histórico", "Sync Google"] },
  { icon: FolderOpen, category: "Arquivos", count: "8 tools", examples: ["Upload", "Buscar", "OCR", "Compartilhar", "Drive sync"] },
  { icon: MessageSquare, category: "WhatsApp", count: "6 tools", examples: ["Enviar mensagem", "Listar contatos", "Mídia", "Grupos"] },
  { icon: Search, category: "Web Search", count: "3 tools", examples: ["Pesquisa", "Notícias", "Imagens"] },
  { icon: ImageIcon, category: "Visual", count: "2 tools", examples: ["Gerar imagem", "Editar imagem"] },
];

type Model = {
  name: string;
  provider: string;
  badge: string;
  description: string;
  use: string;
};

const MODELS: Model[] = [
  {
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    badge: "MCP Mode",
    description: "Modelo principal para Model Context Protocol — leitura imediata, escrita com confirmação.",
    use: "Operações sensíveis, contexto longo",
  },
  {
    name: "Gemini 3 Pro",
    provider: "Google",
    badge: "Reasoning",
    description: "Raciocínio multi-modal pesado, contexto extenso, análise de imagens e documentos.",
    use: "Análise complexa, visão computacional",
  },
  {
    name: "GPT-5",
    provider: "OpenAI",
    badge: "All-rounder",
    description: "Equilíbrio entre precisão e nuance. Tool calling robusto, multilíngue.",
    use: "Conversação geral, tool execution",
  },
  {
    name: "Gemini 3 Flash",
    provider: "Google",
    badge: "Fast",
    description: "Latência mínima para respostas rápidas, classificação e roteamento.",
    use: "Tarefas simples, alto volume",
  },
];

const PRINCIPLES = [
  {
    icon: Shield,
    title: "Workspace Isolation",
    description: "Cada perfil é uma sandbox. A Pandora nunca cruza dados entre workspaces sem permissão explícita.",
  },
  {
    icon: Lock,
    title: "Auditoria Completa",
    description: "Todo prompt, ferramenta e resposta é registrado em pandora_sessions. Observabilidade real-time.",
  },
  {
    icon: Cpu,
    title: "Lazy Loading",
    description: "Skills e ferramentas carregam só quando necessárias. Token budget controlado em 8k por contexto.",
  },
  {
    icon: Network,
    title: "Default Anchoring",
    description: "Contexto âncora no Workspace Principal evita confusões e hallucinations cross-profile.",
  },
];

/* ─────────────────────── UI Helpers ─────────────────────── */

function FloatingOrb({
  size = 400,
  color = "#C8956C",
  duration = 20,
  className = "",
}: { size?: number; color?: string; duration?: number; className?: string }) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}25 0%, transparent 70%)`,
        filter: "blur(40px)",
      }}
      animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ─────────────────────── Page ─────────────────────── */

function PandoraPageInner() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.12], [0, -50]);

  useEffect(() => {
    document.title = "Pandora IA · Sua chefe de gabinete digital | DESH";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Pandora IA: assistente proativa do DESH. 65+ ferramentas, multi-canal (web, WhatsApp, voz), 4 modelos de IA, skills personalizadas. Conheça tudo sobre a Pandora.");
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen text-[#F5F5F7]" style={{ background: "#0A0A0F" }}>
      <ScrollProgressBar />
      <WelcomeNavbar />

      {/* ── HERO ── */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-32 pb-24"
      >
        <FloatingOrb size={600} color="#C8956C" duration={22} className="top-0 -left-40" />
        <FloatingOrb size={500} color="#BF5AF2" duration={28} className="bottom-0 -right-32" />
        <FloatingOrb size={400} color="#64D2FF" duration={25} className="top-1/3 right-1/4" />

        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#C8956C 1px, transparent 1px), linear-gradient(90deg, #C8956C 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-10 backdrop-blur-xl"
            style={{
              background: "rgba(200,149,108,0.06)",
              border: "1px solid rgba(200,149,108,0.18)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C8956C] animate-pulse" />
            <span className="text-[11px] tracking-[0.25em] uppercase text-[#C8956C] font-mono">
              Pandora IA · v3
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="font-bold leading-[0.92] tracking-[-0.045em] mb-8"
            style={{
              fontSize: "clamp(3rem, 10vw, 9rem)",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Não é um chatbot.<br />
            <span className="italic font-light text-[#8E8E93]">É uma chefe</span><br />
            de gabinete.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-[#8E8E93] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-12"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            A Pandora opera seu DESH inteiro. Lê e-mails, agenda reuniões, controla finanças,
            executa pesquisas, gera imagens — em uma só conversa. No navegador. No WhatsApp. Por voz.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/auth?tab=signup"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #C8956C, #BF5AF2)",
                color: "#0A0A0F",
                boxShadow: "0 8px 32px rgba(200,149,108,0.25)",
              }}
            >
              Conversar com a Pandora
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/modules"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-[#F5F5F7] border border-white/[0.1] hover:bg-white/[0.04] transition-all"
            >
              Ver todos os módulos
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-white/[0.06]"
          >
            {[
              { value: "65+", label: "Ferramentas" },
              { value: "4", label: "Modelos IA" },
              { value: "3", label: "Canais" },
              { value: "12", label: "Skills templates" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div
                  className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #F5F5F7, #C8956C)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {s.value}
                </div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono mt-2">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── PHILOSOPHY ── */}
      <section className="relative py-28 md:py-40 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="grid md:grid-cols-12 gap-12 items-start"
          >
            <div className="md:col-span-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
                Filosofia
              </div>
              <h2
                className="font-bold leading-[1] tracking-[-0.03em]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontFamily: "'DM Sans', sans-serif" }}
              >
                Direta.<br />
                <span className="italic font-light text-[#8E8E93]">Discreta.</span><br />
                Decidida.
              </h2>
            </div>

            <div className="md:col-span-8 space-y-8">
              <p className="text-xl md:text-2xl text-[#F5F5F7] leading-[1.5] font-light" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                A Pandora não tagueia respostas com "Como modelo de IA…". Não pede confirmação para
                cada vírgula. Não enrola.
              </p>
              <p className="text-base text-[#8E8E93] leading-relaxed max-w-2xl">
                Foi desenhada para operar como uma chefe de gabinete sênior: entende contexto na primeira
                vez, age dentro do seu mandato e reporta o que importa. Quando precisa confirmar, faz uma
                pergunta — não três. Quando descobre algo proativo, traz a informação sem te interromper
                desnecessariamente.
              </p>
              <div className="pt-6 grid sm:grid-cols-2 gap-4">
                {[
                  "Sem jargão de IA",
                  "Confirma mudanças destrutivas",
                  "Memória persistente entre canais",
                  "Reporta erros com clareza",
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-[#8E8E93]">
                    <span className="w-1 h-1 rounded-full bg-[#C8956C]" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="relative py-28 md:py-36" style={{ background: "linear-gradient(180deg, #0A0A0F, #07070C, #0A0A0F)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-20 max-w-3xl"
          >
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
              Capacidades
            </div>
            <h2
              className="font-bold leading-[1] tracking-[-0.03em] mb-6"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              Oito superpoderes,<br />
              <span className="italic font-light text-[#8E8E93]">uma só conversa.</span>
            </h2>
            <p className="text-[#8E8E93] text-lg leading-relaxed">
              Cada capacidade da Pandora foi projetada para resolver um tipo de fricção específico no
              seu dia. Juntas, formam o sistema operacional da sua atenção.
            </p>
          </motion.div>

          <div className="space-y-px">
            {CAPABILITIES.map((cap, i) => {
              const Icon = cap.icon;
              const isAlt = i % 2 === 1;
              return (
                <motion.div
                  key={cap.num}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, delay: i * 0.05 }}
                  className="group relative grid md:grid-cols-12 gap-8 py-12 md:py-16 border-t border-white/[0.06] hover:border-[#C8956C]/20 transition-colors duration-500"
                >
                  {/* Number watermark */}
                  <div className={`md:col-span-2 ${isAlt ? "md:order-3" : ""}`}>
                    <div
                      className="text-7xl md:text-8xl font-bold tracking-[-0.05em] text-[#C8956C]/[0.15] group-hover:text-[#C8956C]/30 transition-colors duration-500"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {cap.num}
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`md:col-span-6 ${isAlt ? "md:order-2" : ""}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: "rgba(200,149,108,0.08)", border: "1px solid rgba(200,149,108,0.15)" }}
                      >
                        <Icon size={18} className="text-[#C8956C]" />
                      </div>
                      <div className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono">
                        Capability / {cap.num}
                      </div>
                    </div>
                    <h3
                      className="text-3xl md:text-4xl font-semibold mb-3 tracking-[-0.02em] leading-[1.05]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {cap.title}
                    </h3>
                    <p className="text-base italic text-[#C8956C]/80 mb-4 font-light">{cap.tagline}</p>
                    <p className="text-[#8E8E93] leading-relaxed text-base">{cap.description}</p>
                  </div>

                  {/* Examples */}
                  <div className={`md:col-span-4 space-y-2 ${isAlt ? "md:order-1" : ""}`}>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono mb-3">
                      Exemplos reais
                    </div>
                    {cap.examples.map((ex, j) => (
                      <div
                        key={j}
                        className="px-4 py-3 rounded-xl text-sm text-[#F5F5F7]/80 leading-snug"
                        style={{
                          background: "rgba(255,255,255,0.025)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span className="text-[#C8956C] mr-2 font-mono">›</span>
                        {ex}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TOOLS ARSENAL ── */}
      <section className="relative py-28 md:py-36 overflow-hidden">
        <FloatingOrb size={500} color="#BF5AF2" duration={30} className="top-1/4 -left-20" />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16 grid md:grid-cols-12 gap-8 items-end"
          >
            <div className="md:col-span-7">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
                Ferramentas
              </div>
              <h2
                className="font-bold leading-[1] tracking-[-0.03em]"
                style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
              >
                65+ ferramentas.<br />
                <span className="italic font-light text-[#8E8E93]">Zero configuração.</span>
              </h2>
            </div>
            <div className="md:col-span-5">
              <p className="text-[#8E8E93] leading-relaxed">
                A Pandora tem acesso nativo a todos os módulos do DESH. Cada ferramenta é registrada,
                tipada e auditada — e disponível em qualquer canal sem setup adicional.
              </p>
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOOLS.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.category}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.04 }}
                  className="group p-6 rounded-2xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
                      style={{ background: "rgba(200,149,108,0.1)", border: "1px solid rgba(200,149,108,0.2)" }}
                    >
                      <Icon size={20} className="text-[#C8956C]" />
                    </div>
                    <span className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono">
                      {t.count}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {t.category}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {t.examples.map((ex) => (
                      <span
                        key={ex}
                        className="text-[11px] px-2 py-1 rounded-md text-[#8E8E93] font-mono"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── MODELS ── */}
      <section className="relative py-28 md:py-36" style={{ background: "linear-gradient(180deg, #0A0A0F, #07070C)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16 max-w-3xl"
          >
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
              Engine
            </div>
            <h2
              className="font-bold leading-[1] tracking-[-0.03em] mb-6"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              4 modelos.<br />
              <span className="italic font-light text-[#8E8E93]">Roteamento inteligente.</span>
            </h2>
            <p className="text-[#8E8E93] text-lg leading-relaxed">
              A Pandora escolhe o melhor modelo para cada tarefa automaticamente. Análise visual pesada
              vai para Gemini Pro. Operações sensíveis com MCP usam Claude. Roteamento simples passa pelo
              Flash. Você não decide — ela decide.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            {MODELS.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="p-8 rounded-2xl backdrop-blur-xl group hover:border-[#C8956C]/20 transition-all duration-500"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono mb-2">
                      {m.provider}
                    </div>
                    <h3 className="text-2xl font-semibold tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {m.name}
                    </h3>
                  </div>
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 rounded-md font-mono"
                    style={{
                      background: "rgba(200,149,108,0.08)",
                      border: "1px solid rgba(200,149,108,0.2)",
                      color: "#C8956C",
                    }}
                  >
                    {m.badge}
                  </span>
                </div>
                <p className="text-[#8E8E93] text-sm leading-relaxed mb-4">{m.description}</p>
                <div className="pt-4 border-t border-white/[0.05] flex items-center gap-2 text-xs text-[#636366]">
                  <Target size={12} />
                  {m.use}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE PRINCIPLES ── */}
      <section className="relative py-28 md:py-36">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16 grid md:grid-cols-12 gap-8 items-end"
          >
            <div className="md:col-span-7">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
                Arquitetura
              </div>
              <h2
                className="font-bold leading-[1] tracking-[-0.03em]"
                style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
              >
                Construída sobre<br />
                <span className="italic font-light text-[#8E8E93]">princípios invioláveis.</span>
              </h2>
            </div>
            <div className="md:col-span-5">
              <p className="text-[#8E8E93] leading-relaxed">
                Sete regras invioláveis governam o comportamento da Pandora. Não são opcionais.
                Não podem ser desativadas. Garantem segurança, isolamento e auditoria.
              </p>
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.06)" }}>
            {PRINCIPLES.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="p-10 group hover:bg-white/[0.02] transition-colors duration-500"
                  style={{ background: "#0A0A0F" }}
                >
                  <Icon size={28} className="text-[#C8956C] mb-6" />
                  <h3 className="text-xl font-semibold mb-3 tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {p.title}
                  </h3>
                  <p className="text-[#8E8E93] text-sm leading-relaxed">{p.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CHANNELS ── */}
      <section className="relative py-28 md:py-36 overflow-hidden" style={{ background: "linear-gradient(180deg, #0A0A0F, #07070C)" }}>
        <FloatingOrb size={400} color="#30D158" duration={28} className="top-10 right-20" />
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16 max-w-3xl"
          >
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
              Canais
            </div>
            <h2
              className="font-bold leading-[1] tracking-[-0.03em]"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              Onde você está,<br />
              <span className="italic font-light text-[#8E8E93]">ela também está.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Globe,
                name: "Web",
                tag: "Comando central",
                desc: "Interface completa com chat lateral, ações inline e visualizações ricas. Markdown completo, código, imagens.",
                features: ["Chat embutido", "Comandos /", "Mentions @", "Histórico ilimitado"],
              },
              {
                icon: MessageSquare,
                name: "WhatsApp",
                tag: "Mobilidade total",
                desc: "Mesma Pandora, sem app. Áudios transcritos automaticamente, comandos /ws para trocar workspace, OTP de 6 dígitos para segurança.",
                features: ["Voz e texto", "Mídias", "Multi-workspace", "OTP 6 dígitos"],
              },
              {
                icon: Mic,
                name: "Voz",
                tag: "Mãos livres",
                desc: "Síntese de voz via ElevenLabs para respostas faladas. Transcrição com diarização para reuniões e ditados.",
                features: ["TTS premium", "STT com speakers", "Diarização", "Multi-idioma"],
              },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="p-8 rounded-3xl relative overflow-hidden group"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: "radial-gradient(circle, rgba(200,149,108,0.15), transparent 70%)" }}
                  />
                  <div className="relative z-10">
                    <Icon size={32} className="text-[#C8956C] mb-6" />
                    <div className="text-[10px] tracking-[0.2em] uppercase text-[#636366] font-mono mb-2">
                      {c.tag}
                    </div>
                    <h3 className="text-2xl font-semibold mb-4 tracking-[-0.01em]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {c.name}
                    </h3>
                    <p className="text-[#8E8E93] text-sm leading-relaxed mb-6">{c.desc}</p>
                    <div className="space-y-2 pt-4 border-t border-white/[0.05]">
                      {c.features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-xs text-[#8E8E93]">
                          <span className="w-1 h-1 rounded-full bg-[#C8956C]" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── DAY IN THE LIFE ── */}
      <section className="relative py-28 md:py-36">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16 text-center"
          >
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#C8956C] font-mono mb-6">
              Um dia com a Pandora
            </div>
            <h2
              className="font-bold leading-[1] tracking-[-0.03em] mb-6"
              style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              Da primeira xícara<br />
              <span className="italic font-light text-[#8E8E93]">ao último e-mail.</span>
            </h2>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[30px] md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#C8956C]/30 to-transparent md:-translate-x-px" />

            {[
              { time: "07:30", side: "left", title: "Briefing matinal", desc: "Pandora envia no WhatsApp: 3 reuniões hoje, 2 e-mails urgentes, saldo de R$ 12.4k, hábito de leitura ainda não feito." },
              { time: "09:15", side: "right", title: "Triage de e-mail", desc: "\"Resume e arquiva os 18 e-mails de newsletter. Os 3 do cliente Beta, marca para responder hoje.\"" },
              { time: "11:00", side: "left", title: "Agenda inteligente", desc: "\"Encontra um horário com Marina, Pedro e Ana entre quarta e sexta de tarde.\" — Pandora cruza 3 calendários e propõe 2 slots." },
              { time: "14:30", side: "right", title: "Análise financeira", desc: "\"Quanto gastei com restaurante este mês comparado à média?\" — Resposta com gráfico, anomalias destacadas, sugestão de orçamento." },
              { time: "17:45", side: "left", title: "Pesquisa profunda", desc: "\"Compara as 3 melhores ferramentas de CRM para B2B SaaS, foco em integrações.\" — Síntese editorial com fontes citadas." },
              { time: "20:00", side: "right", title: "Geração visual", desc: "\"Cria 4 thumbnails para o post de amanhã, estilo minimal, paleta laranja-âmbar.\" — Nano Banana Pro entrega em 30s." },
            ].map((moment, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: moment.side === "left" ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className={`relative pl-20 md:pl-0 mb-12 md:grid md:grid-cols-2 md:gap-16 ${moment.side === "right" ? "md:text-right" : ""}`}
              >
                {/* Dot */}
                <div className="absolute left-[22px] md:left-1/2 top-2 w-4 h-4 rounded-full md:-translate-x-1/2 z-10"
                  style={{ background: "#C8956C", boxShadow: "0 0 0 6px rgba(10,10,15,1), 0 0 20px rgba(200,149,108,0.4)" }}
                />

                <div className={moment.side === "right" ? "md:col-start-2" : ""}>
                  <div className="text-[10px] tracking-[0.2em] uppercase text-[#C8956C] font-mono mb-2 flex items-center gap-2 md:justify-start"
                    style={{ justifyContent: moment.side === "right" ? "flex-end" : "flex-start" }}>
                    <Clock size={12} />
                    {moment.time}
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {moment.title}
                  </h3>
                  <p className="text-[#8E8E93] text-sm leading-relaxed">{moment.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-28 md:py-40 overflow-hidden">
        <FloatingOrb size={700} color="#C8956C" duration={25} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Sparkles size={40} className="text-[#C8956C] mx-auto mb-8" />
            <h2
              className="font-bold leading-[0.95] tracking-[-0.04em] mb-8"
              style={{ fontSize: "clamp(2.5rem, 8vw, 7rem)", fontFamily: "'DM Sans', sans-serif" }}
            >
              Pare de operar<br />
              <span className="italic font-light text-[#8E8E93]">o seu próprio sistema.</span>
            </h2>
            <p className="text-[#8E8E93] text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              100 créditos de teste por 30 dias. Sem cartão. Conheça a Pandora em uma sessão e
              entenda por que o resto parece pré-histórico.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/auth?tab=signup"
                className="group inline-flex items-center gap-2 px-10 py-5 rounded-2xl font-semibold transition-all hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #C8956C, #BF5AF2)",
                  color: "#0A0A0F",
                  boxShadow: "0 8px 40px rgba(200,149,108,0.3)",
                }}
              >
                Começar grátis
                <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                to="/welcome"
                className="inline-flex items-center gap-2 px-6 py-5 rounded-2xl text-[#F5F5F7] hover:text-[#C8956C] transition-all"
              >
                Voltar ao DESH
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <WelcomeFooter />
      <WelcomeChatBubble />
    </div>
  );
}

export default function PandoraPage() {
  return (
    <WelcomeThemeProvider>
      <PandoraPageInner />
    </WelcomeThemeProvider>
  );
}
