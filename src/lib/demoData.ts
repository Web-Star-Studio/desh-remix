// Centralized demo data for all widgets
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const d = now.getDate();

function dateStr(offset: number) {
  const dt = new Date(y, m, d + offset);
  return dt.toISOString();
}


// ── Emails ──
export const DEMO_EMAILS = [
  { id: 0, from: "Carlos Mendes", fromEmail: "carlos@empresa.com", subject: "Re: Proposta aprovada ✅", time: "09:12", read: false, body: "A diretoria aprovou a proposta. Podemos seguir com a implementação.", labels: [], gmailId: "" },
  { id: 1, from: "Fernanda Silva", fromEmail: "fernanda@empresa.com", subject: "Fatura pendente - Março/2026", time: "08:45", read: false, body: "Segue em anexo a fatura referente ao mês de março.", labels: [], gmailId: "" },
  { id: 2, from: "LinkedIn", fromEmail: "noreply@linkedin.com", subject: "Você tem 5 novas conexões", time: "08:30", read: true, body: "Veja quem quer se conectar com você.", labels: [], gmailId: "" },
  { id: 3, from: "Pedro Almeida", fromEmail: "pedro@tech.com", subject: "Convite para evento de tecnologia", time: "07:55", read: false, body: "Gostaria de convidá-lo para o TechConf 2026 em São Paulo.", labels: [], gmailId: "" },
  { id: 4, from: "Ana Rodrigues", fromEmail: "ana@empresa.com", subject: "Atualização do projeto Alpha", time: "07:30", read: true, body: "O milestone 3 foi concluído ontem. Estamos 2 dias adiantados.", labels: [], gmailId: "" },
  { id: 5, from: "Nubank", fromEmail: "noreply@nubank.com.br", subject: "Sua fatura de fevereiro está disponível", time: "06:00", read: true, body: "O valor total da sua fatura é R$2.847,32.", labels: [], gmailId: "" },
  { id: 6, from: "Maria Costa", fromEmail: "maria@empresa.com", subject: "Reunião remarcada para quinta", time: "Ontem", read: true, body: "Precisei remarcar a reunião de quarta para quinta às 14h.", labels: [], gmailId: "" },
  { id: 7, from: "GitHub", fromEmail: "noreply@github.com", subject: "[desh-app] Pull request merged", time: "Ontem", read: true, body: "PR #142 foi merged no branch main.", labels: [], gmailId: "" },
];


// ── Messages ──
export const DEMO_MESSAGES = [
  { id: 0, from: "Carlos Mendes", msg: "Oi! Você viu o documento que enviei?", time: "09:45", unread: true, platform: "whatsapp" as const },
  { id: 1, from: "Fernanda Silva", msg: "Reunião confirmada para amanhã às 10h", time: "09:30", unread: true, platform: "whatsapp" as const },
  { id: 2, from: "#general", msg: "Deploy v2.4 feito com sucesso 🚀", time: "09:15", unread: false, platform: "slack" as const },
  { id: 3, from: "Pedro Almeida", msg: "Pode revisar o PR quando tiver um tempo?", time: "08:50", unread: true, platform: "teams" as const },
  { id: 4, from: "Ana Rodrigues", msg: "Adorei o novo design! Aprovado.", time: "08:20", unread: false, platform: "whatsapp" as const },
  { id: 5, from: "#projetos", msg: "Milestone 3 concluído! 🎉", time: "Ontem", unread: false, platform: "slack" as const },
];

// ── Weather ──
export const DEMO_WEATHER = {
  temperature: 28,
  humidity: 65,
  wind: 12,
  weatherCode: 2, // partly cloudy
  forecast: [
    { hour: "12h", temp: 29, code: 2 },
    { hour: "14h", temp: 31, code: 1 },
    { hour: "16h", temp: 30, code: 2 },
    { hour: "18h", temp: 27, code: 3 },
    { hour: "20h", temp: 24, code: 0 },
    { hour: "22h", temp: 22, code: 0 },
  ],
};

// ── Stocks ──
export const DEMO_STOCKS = [
  { symbol: "PETR4", price: "38.42", change: "+1.25%", up: true },
  { symbol: "VALE3", price: "62.87", change: "-0.48%", up: false },
  { symbol: "ITUB4", price: "34.15", change: "+0.92%", up: true },
  { symbol: "BBDC4", price: "13.28", change: "+0.35%", up: true },
  { symbol: "MGLU3", price: "8.74", change: "-2.15%", up: false },
  { symbol: "WEGE3", price: "42.56", change: "+1.78%", up: true },
];

// ── Files ──
export const DEMO_FILES = [
  { id: 0, name: "Relatório_Q4_2025.pdf", icon: "file", size: "2.4 MB", date: "15 fev" },
  { id: 1, name: "Planilha_Orçamento_2026.xlsx", icon: "file", size: "1.1 MB", date: "12 fev" },
  { id: 2, name: "Apresentação_Investidores.pptx", icon: "file", size: "8.7 MB", date: "10 fev" },
  { id: 3, name: "Contrato_Parceria.pdf", icon: "file", size: "540 KB", date: "08 fev" },
  { id: 4, name: "Logo_Redesign_Final.png", icon: "image", size: "3.2 MB", date: "05 fev" },
];

// ── News ──
export const DEMO_NEWS = [
  { title: "IA generativa atinge novo marco em produtividade empresarial", source: "TechCrunch", url: "#", time: "1h atrás", category: "tech", imageUrl: null, description: "Novas ferramentas de IA estão revolucionando a forma como empresas operam." },
  { title: "Ibovespa fecha em alta de 1,2% com otimismo global", source: "InfoMoney", url: "#", time: "2h atrás", category: "finance", imageUrl: null, description: "O principal índice da bolsa brasileira registrou ganhos pelo terceiro dia consecutivo." },
  { title: "Brasil lidera adoção de fintechs na América Latina", source: "Bloomberg", url: "#", time: "3h atrás", category: "finance", imageUrl: null, description: "Pix e Open Banking impulsionam a revolução financeira no país." },
  { title: "Nova versão do React traz melhorias significativas de performance", source: "Dev.to", url: "#", time: "4h atrás", category: "tech", imageUrl: null, description: "A equipe do React anunciou novas otimizações para renderização." },
  { title: "Startup brasileira capta R$50M em Série B", source: "Startups", url: "#", time: "5h atrás", category: "tech", imageUrl: null, description: "A rodada foi liderada por fundos internacionais." },
];


export const DEMO_PASSWORDS = [
  { id: "dp1", site: "Google", user: "joao@gmail.com", password: "G#k9$mP2xL!qW7", strong: true, category: "social" as const, createdAt: dateStr(-90), lastUsed: dateStr(-1) },
  { id: "dp2", site: "Netflix", user: "joao@gmail.com", password: "N3tf!x_2026#", strong: true, category: "streaming" as const, createdAt: dateStr(-60), lastUsed: dateStr(-3) },
  { id: "dp3", site: "Banco Inter", user: "joao.silva", password: "banco123", strong: false, category: "financeiro" as const, createdAt: dateStr(-180), lastUsed: dateStr(-7) },
  { id: "dp4", site: "GitHub", user: "joaodev", password: "Gh!tHub_S3cure#2026", strong: true, category: "dev" as const, createdAt: dateStr(-45), lastUsed: dateStr(0) },
  { id: "dp5", site: "Instagram", user: "joao.silva", password: "insta2024", strong: false, category: "social" as const, createdAt: dateStr(-200), lastUsed: dateStr(-14) },
  { id: "dp6", site: "AWS Console", user: "joao@company.com", password: "Aw$_Pr0d#2026!x", strong: true, category: "dev" as const, createdAt: dateStr(-30), lastUsed: dateStr(-2) },
];

// ── World Clocks ──
export const DEMO_WORLD_CLOCKS = [
  { id: "dwc1", city: "São Paulo", timezone: "America/Sao_Paulo", label: "🇧🇷" },
  { id: "dwc2", city: "Nova York", timezone: "America/New_York", label: "🇺🇸" },
  { id: "dwc3", city: "Tóquio", timezone: "Asia/Tokyo", label: "🇯🇵" },
];


// ── Health ──
export const DEMO_HEALTH: { date: string; steps: number; calories: number; sleep: number }[] = (() => {
  const entries: { date: string; steps: number; calories: number; sleep: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(y, m, d - i);
    entries.push({
      date: dt.toISOString().split("T")[0],
      steps: 5000 + Math.floor(Math.random() * 8000),
      calories: 1200 + Math.floor(Math.random() * 800),
      sleep: 5 + Math.round(Math.random() * 3 * 2) / 2,
    });
  }
  return entries;
})();

// ── Map Favorites ──
export const DEMO_MAP_FAVORITES = [
  { name: "Escritório TechCorp", lat: -23.5613, lng: -46.6560, address: "Av. Paulista, 1000 - São Paulo, SP" },
  { name: "Casa", lat: -23.5505, lng: -46.6333, address: "Rua Augusta, 500 - São Paulo, SP" },
  { name: "Academia SmartFit", lat: -23.5633, lng: -46.6530, address: "Rua Consolação, 200 - São Paulo, SP" },
];
