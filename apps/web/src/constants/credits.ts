/** Credit costs per action (aligned with backend supabase/functions/_shared/credits.ts) */
export const CREDIT_COSTS = {
  // Lovable AI Gateway
  AI_CHAT: 1,
  AI_CHAT_MCP: 2,
  AI_SUMMARY: 2,
  AI_TASKS: 1,
  AI_CALENDAR: 1,
  AI_CONTACTS: 1,
  AI_EMAIL: 1,
  AI_FILES: 1,
  AI_NOTES: 1,
  AI_MESSAGES: 1,
  AI_WEEK_PLANNER: 1,
  AI_MAP: 1,
  AI_PROACTIVE: 1,
  AI_AUTOMATION: 1,
  AI_STOCK_ANALYSIS: 1,
  AI_FINANCE: 1,
  AI_INBOX: 1,
  AI_OCR: 1,
  AI_FILE_CATEGORIZE: 1,

  // Perplexity
  WEB_SEARCH: 1,
  DEEP_RESEARCH: 22,

  // SerpAPI
  SERP_SEARCH: 2,
  SERP_NEWS: 2,
  SERP_IMAGES: 2,
  SERP_SHOPPING: 2,
  SERP_TRENDS: 2,
  SERP_MONITOR_CHECK: 2,
  SERP_FINANCE: 2,
  SERP_FLIGHTS: 2,
  SERP_HOTELS: 2,
  SERP_JOBS: 2,
  SERP_EVENTS: 2,
  SERP_SCHOLAR: 2,
  SERP_YOUTUBE: 2,
  SERP_MAPS: 2,
  SERP_PATENTS: 2,

  // ElevenLabs TTS
  ELEVENLABS_TTS: 18,

  // Image Generation
  AI_IMAGE_GENERATION: 1,
  AI_IMAGE_GENERATION_LEONARDO: 4,

  // WhatsApp
  WHATSAPP_SEND: 1,
  AI_WHATSAPP_REPLY: 1,
  AI_WHATSAPP_MCP: 2,
  WHATSAPP_FULL_SYNC: 4,

  // Open Banking
  OPEN_BANKING_SYNC: 8,

  // Misc
  DATA_EXPORT: 1,
  PDF_REPORT: 1,
  MORNING_BRIEFING: 2,

  // Social Media — now flat-rate via subscription (R$49,90/mês)
  // Kept at 0 for display reference only

  // WhatsApp Business (Zernio)
  WA_CONNECT: 1,
  WA_BROADCAST_CREATE: 1,
  WA_BROADCAST_SEND: 3,
  WA_BROADCAST_SCHEDULE: 1,
  WA_TEMPLATE_CREATE: 1,
  WA_CONTACT_CREATE: 1,
  WA_CONTACT_IMPORT: 2,
} as const;

/** Average price per credit in BRL (based on Starter package: R$450 / 1000 credits) */
export const PRICE_PER_CREDIT_BRL = 0.45;

/** Credit usage table for display on pricing page */
export const CREDIT_TABLE = [
  { action: "Mensagem AI Chat", credits: CREDIT_COSTS.AI_CHAT },
  { action: "Mensagem AI Chat (MCP/Avançado)", credits: CREDIT_COSTS.AI_CHAT_MCP },
  { action: "Resumo/Análise AI", credits: CREDIT_COSTS.AI_SUMMARY },
  { action: "Planejamento de Tarefas AI", credits: CREDIT_COSTS.AI_TASKS },
  { action: "Calendário AI", credits: CREDIT_COSTS.AI_CALENDAR },
  { action: "Contatos AI", credits: CREDIT_COSTS.AI_CONTACTS },
  { action: "Composição de Email AI", credits: CREDIT_COSTS.AI_EMAIL },
  { action: "Arquivos AI", credits: CREDIT_COSTS.AI_FILES },
  { action: "Notas AI", credits: CREDIT_COSTS.AI_NOTES },
  { action: "Mensagens AI", credits: CREDIT_COSTS.AI_MESSAGES },
  { action: "Week Planner AI", credits: CREDIT_COSTS.AI_WEEK_PLANNER },
  { action: "Mapa AI", credits: CREDIT_COSTS.AI_MAP },
  { action: "Insights Proativos AI", credits: CREDIT_COSTS.AI_PROACTIVE },
  { action: "Automação AI", credits: CREDIT_COSTS.AI_AUTOMATION },
  { action: "Análise de Ações AI", credits: CREDIT_COSTS.AI_STOCK_ANALYSIS },
  { action: "Análise Financeira AI", credits: CREDIT_COSTS.AI_FINANCE },
  { action: "Análise Inbox AI", credits: CREDIT_COSTS.AI_INBOX },
  { action: "OCR de Arquivo", credits: CREDIT_COSTS.AI_OCR },
  { action: "Categorização de Arquivo AI", credits: CREDIT_COSTS.AI_FILE_CATEGORIZE },
  { action: "Busca Web (Perplexity)", credits: CREDIT_COSTS.WEB_SEARCH },
  { action: "Pesquisa Profunda", credits: CREDIT_COSTS.DEEP_RESEARCH },
  { action: "Busca SERP (qualquer modo)", credits: CREDIT_COSTS.SERP_SEARCH },
  { action: "Monitor de Busca (cron)", credits: CREDIT_COSTS.SERP_MONITOR_CHECK },
  { action: "Narração ElevenLabs", credits: CREDIT_COSTS.ELEVENLABS_TTS },
  { action: "Geração de Imagem AI", credits: CREDIT_COSTS.AI_IMAGE_GENERATION },
  { action: "Geração de Imagem Leonardo AI", credits: CREDIT_COSTS.AI_IMAGE_GENERATION_LEONARDO },
  { action: "Envio WhatsApp", credits: CREDIT_COSTS.WHATSAPP_SEND },
  { action: "Resposta AI WhatsApp", credits: CREDIT_COSTS.AI_WHATSAPP_REPLY },
  { action: "WhatsApp MCP (Avançado)", credits: CREDIT_COSTS.AI_WHATSAPP_MCP },
  { action: "Sincronização completa WhatsApp", credits: CREDIT_COSTS.WHATSAPP_FULL_SYNC },
  { action: "Sincronização Open Banking", credits: CREDIT_COSTS.OPEN_BANKING_SYNC },
  { action: "Exportação de Dados", credits: CREDIT_COSTS.DATA_EXPORT },
  { action: "Relatório PDF", credits: CREDIT_COSTS.PDF_REPORT },
  { action: "Briefing Matinal", credits: CREDIT_COSTS.MORNING_BRIEFING },
  { action: "Broadcast WhatsApp Business", credits: CREDIT_COSTS.WA_BROADCAST_SEND },
] as const;

/** Low balance threshold for warnings */
export const LOW_BALANCE_THRESHOLD = 50;

/** Monthly credit reference for profile display */
export const MONTHLY_CREDITS = 500;
