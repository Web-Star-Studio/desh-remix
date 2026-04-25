import { useState, useMemo, useCallback } from "react";
import {
  BookOpen, Layers, Plug, CreditCard, Shield, Database,
  Globe, MessageSquare, Brain, Calendar, Mail, FileText, Search,
  Map, BarChart3, Zap, Webhook, Users, Bot, ChevronRight,
  Smartphone, Share2, Bell, Palette, FolderOpen, DollarSign,
  Briefcase, Headphones, Image, TrendingUp, Lock, Server,
  Cpu, Monitor, AlertTriangle, Settings, Printer, Copy, Check,
  ArrowUp, Workflow, Key, Activity
} from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/constants/app";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  content: DocBlock[];
}

interface DocBlock {
  heading?: string;
  text?: string;
  list?: string[];
  table?: { headers: string[]; rows: string[][] };
  code?: string;
  note?: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const sections: DocSection[] = [
  {
    id: "overview",
    title: "Visão Geral",
    icon: BookOpen,
    color: "text-blue-400",
    content: [
      {
        text: `**${APP_NAME}** (v${APP_VERSION}) é um dashboard inteligente para organizar a vida pessoal com IA. A plataforma unifica produtividade, finanças, comunicação e integrações em uma interface única, alimentada pela assistente virtual **Pandora**.`,
      },
      {
        heading: "Stack Tecnológico",
        table: {
          headers: ["Camada", "Tecnologia"],
          rows: [
            ["Frontend", "React 18 + TypeScript + Vite + Tailwind CSS"],
            ["UI Components", "shadcn/ui + Radix UI + Framer Motion"],
            ["State", "TanStack Query + React Context + useReducer"],
            ["Backend", "Lovable Cloud (Supabase)"],
            ["Edge Functions", "Deno (44 funções ativas)"],
            ["AI Gateway", "Lovable AI (Gemini, GPT-5, Claude)"],
            ["Integrações", "Composio (16+ toolkits)"],
            ["Pagamentos", "Stripe (créditos pay-per-use)"],
            ["Mapas", "Mapbox GL"],
            ["Busca", "SerpAPI + Perplexity"],
          ],
        },
      },
      {
        heading: "Modelo de Monetização",
        text: "Sistema pay-per-use baseado em créditos. Novos usuários recebem **100 créditos de teste válidos por 30 dias**. Pacotes adicionais são gerenciados dinamicamente via tabela `credit_packages` no banco de dados e processados via Stripe.",
      },
    ],
  },
  {
    id: "architecture",
    title: "Arquitetura",
    icon: Layers,
    color: "text-purple-400",
    content: [
      {
        heading: "Estrutura de Diretórios",
        code: `src/
├── pages/           → 34 páginas (lazy-loaded)
├── components/      → Componentes por módulo
├── hooks/           → 171 hooks customizados (22 domínios)
├── contexts/        → 9 contextos React
├── constants/       → Configurações centralizadas
├── types/           → Tipagem TypeScript
├── lib/             → Utilitários
└── integrations/    → Cliente Supabase (auto-gerado)

supabase/
├── functions/       → 44 Edge Functions
│   └── _shared/     → 63 módulos compartilhados
└── migrations/      → Migrações SQL`,
      },
      {
        heading: "Contextos React",
        list: [
          "**AuthContext** — Autenticação e sessão do usuário",
          "**WorkspaceContext** — Workspace ativo e isolamento de dados",
          "**DashboardContext** — Estado global do dashboard (widgets, dados)",
          "**ThemeContext** — Tema, wallpaper e personalização visual",
          "**ConnectionsContext** — Status das integrações Composio",
          "**NotificationsContext** — Sistema de notificações in-app",
          "**PlatformIntegrationsContext** — Integrações de plataforma",
          "**WhatsappSessionContext** — Sessão WhatsApp Web",
          "**DemoContext** — Modo demonstração",
        ],
      },
      {
        heading: "Padrão de Isolamento por Workspace",
        text: "Todo dado é isolado por workspace usando `entityId` composto: `${userId}_${workspaceId}`. O hook `useComposioWorkspaceId` centraliza a resolução do ID efetivo para todas as chamadas de proxy.",
      },
    ],
  },
  {
    id: "modules",
    title: "Módulos do Sistema",
    icon: FolderOpen,
    color: "text-green-400",
    content: [
      {
        heading: "Módulos Principais",
        table: {
          headers: ["Módulo", "Rota", "Descrição"],
          rows: [
            ["Dashboard", "/dashboard", "Widgets configuráveis com drag & resize"],
            ["AI (Pandora)", "/ai", "Chat com IA, projetos, agentes customizados"],
            ["Tarefas", "/tasks", "Kanban, prioridades, projetos, subtasks"],
            ["Notas", "/notes", "Editor rich-text (TipTap), tags, pastas"],
            ["Calendário", "/calendar", "Sync Google Calendar, criação de eventos"],
            ["E-mail", "/email", "Gmail integrado, IA para composição/limpeza"],
            ["Mensagens", "/messages", "WhatsApp Web + Business API (Zernio)"],
            ["Contatos", "/contacts", "CRM pessoal, sync Google Contacts"],
            ["Finanças", "/finances", "Transações, orçamentos, metas, Open Finance"],
            ["Arquivos", "/files", "Upload, pastas, OCR, categorização AI"],
            ["Busca", "/search", "Web search com streaming (SERP + Perplexity)"],
            ["Social", "/social", "Gerenciamento de redes sociais"],
            ["Automações", "/automations", "Regras trigger→action"],
            ["Inbox", "/inbox", "Central de comunicações"],
            ["Integrações", "/integrations", "Catálogo de conexões Composio"],
          ],
        },
      },
    ],
  },
  {
    id: "pandora",
    title: "Pandora IA",
    icon: Brain,
    color: "text-pink-400",
    content: [
      {
        text: "A Pandora é a assistente de IA central do DESH, operando em múltiplas superfícies (Chat, WhatsApp, MCP) com personalidade consistente definida em `_shared/pandora-prompt.ts`.",
      },
      {
        heading: "Modos de Operação",
        table: {
          headers: ["Modo", "Modelo", "Descrição"],
          rows: [
            ["Clássico", "Gemini / GPT-5", "125+ ferramentas internas via pandora-chat"],
            ["MCP", "Claude Sonnet 4.5", "Composio nativo (Gmail, Calendar, Tasks, Drive)"],
            ["WhatsApp", "Gemini", "Via pandora-whatsapp, mesma personalidade"],
          ],
        },
      },
      {
        heading: "Ferramentas (124+)",
        list: [
          "**CRM**: buscar/criar/editar contatos, interações",
          "**Tarefas**: listar/criar/editar/completar/deletar tasks",
          "**Notas**: buscar/criar/editar notas",
          "**Calendário**: buscar eventos, verificar disponibilidade, criar/editar",
          "**E-mail**: buscar, ler, compor, criar rascunho",
          "**Finanças**: transações, orçamentos, metas, recorrências",
          "**Arquivos**: listar, buscar, resumir, categorizar",
          "**Social**: criar posts, analytics, templates",
          "**Automações**: listar, ativar/desativar regras",
          "**Sistema**: busca web, clima, ações, notícias",
        ],
      },
      {
        heading: "Autonomia Híbrida",
        text: "Ações de **leitura** são executadas imediatamente. Ações de **escrita ou destrutivas** (enviar e-mails, deletar eventos) exigem confirmação explícita do usuário. Custo: **3-5 créditos** por interação (3 clássico, 5 MCP).",
      },
      {
        heading: "Execução Assíncrona (Tool Worker)",
        text: "Ações pesadas são processadas via `tool-worker` e tabela `tool_jobs` com execução híbrida e feedback Realtime no frontend via hook `useToolJobQueue`.",
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrações (Composio)",
    icon: Plug,
    color: "text-cyan-400",
    content: [
      {
        text: "Todas as integrações externas são gerenciadas via **Composio**, que centraliza OAuth, refresh de tokens e execução de ações. O roteamento passa pelo `composio-proxy` edge function.",
      },
      {
        heading: "Toolkits Ativos",
        table: {
          headers: ["Toolkit", "Ações Principais", "Status"],
          rows: [
            ["Gmail", "fetch, send, draft, labels, search, modify", "✅ Produção"],
            ["Google Calendar", "find, create, update, delete, freebusy", "✅ Produção"],
            ["Google Tasks", "list, create, update, delete", "✅ Produção"],
            ["Google Drive", "list, search, upload, download", "✅ Produção"],
            ["Google Contacts", "list, create, update", "✅ Produção"],
            ["Google Docs", "create, get, update, search", "✅ Produção"],
            ["Google Sheets", "create, read, update, append", "✅ Produção"],
            ["Slack", "send message, list channels", "✅ Produção"],
            ["Notion", "search, get page, create", "✅ Produção"],
            ["GitHub", "repos, issues, PRs", "✅ Produção"],
            ["Trello", "boards, cards, lists", "✅ Produção"],
            ["Dropbox", "list, search, upload, download", "✅ Produção"],
            ["Twitter/X", "post, search, timeline", "✅ Produção"],
            ["LinkedIn", "post, profile", "✅ Produção"],
            ["Todoist", "tasks, projects", "✅ Produção"],
            ["Spotify", "playback, playlists", "✅ Produção (custom auth)"],
          ],
        },
      },
      {
        heading: "Proxy Route Mapping",
        text: "O `composio-proxy` mapeia ~125 ações em 12+ toolkits com normalização automática (camelCase→snake_case, objetos aninhados→planos, decodificação RFC2822). Prioriza endpoints granulares para evitar conflitos de substring.",
      },
      {
        heading: "Hooks de Integração",
        list: [
          "`useComposioProxy` — Wrapper central para chamadas ao proxy",
          "`useComposioConnection` — Status de conexão por toolkit",
          "`useComposioWorkspaceId` — Resolução do entityId composto",
          "`useComposioSlack` / `useComposioNotion` / `useComposioGithub` — Hooks especializados",
        ],
      },
    ],
  },
  {
    id: "edge-functions",
    title: "Edge Functions",
    icon: Server,
    color: "text-orange-400",
    content: [
      {
        text: "44 Edge Functions em Deno, organizadas por domínio. Todas seguem padrão com JSDoc, helpers centralizados em `_shared/utils.ts`, timeouts de 25s e controllers de aborto.",
      },
      {
        heading: "Funções por Categoria",
        table: {
          headers: ["Categoria", "Funções", "Descrição"],
          rows: [
            ["AI Router", "ai-router (12 módulos: calendar, tasks, notes, week-planner, automation, email, messages, inbox, contacts, social, finance, files)", "IA unificada via _shared/ai-*.ts"],
            ["Chat & MCP", "chat, pandora-mcp, welcome-chat, ai-proactive-insights, tool-worker", "Pandora e IA avançada"],
            ["Composio", "composio-proxy, composio-webhook, integrations-connect", "Proxy e gestão de integrações"],
            ["Gmail", "gmail-gateway, gmail-webhook", "Sync e notificações Gmail"],
            ["WhatsApp", "whatsapp-proxy, whatsapp-web-proxy, whatsapp-webhook, whatsapp-gateway-callback, whatsapp-embedded-signup, pandora-whatsapp", "Mensagens e Business API"],
            ["Finanças", "finance-sync, financial-webhook, sync-financial-data, pluggy-proxy", "Open Finance"],
            ["Busca", "search-web, serp-proxy, deep-research", "Web search e monitoring"],
            ["Mídia", "media-gen, files-storage, drive-cross-copy", "Geração de imagens, PDFs, TTS"],
            ["Billing", "billing, stripe-webhook", "Checkout e webhooks Stripe"],
            ["Email Sistema", "email-system, email-automation-runner, email-unsubscribe, auth-email-hook", "E-mails transacionais"],
            ["Dados", "data-io, demo-seed, db-maintenance", "Import/export e manutenção"],
            ["Widgets", "widgets-proxy", "Dados para widgets do dashboard"],
            ["Social", "composio-proxy (social toolkits)", "Redes sociais via Composio"],
            ["Mapas", "mapbox-proxy", "Geocoding e autocomplete"],
            ["Auth", "auth-phone-otp, facebook-auth", "OTP telefone e OAuth Facebook"],
            ["Automação", "automation-listener", "Listener de eventos de automação"],
            ["Processamento", "process-archived-users, send-notification-email", "Jobs de background"],
          ],
        },
      },
      {
        heading: "Módulos Compartilhados (_shared/) — 63 módulos",
        list: [
          "`utils.ts` — CORS headers, auth helpers, response builders",
          "`credits.ts` — Custos por ação e dedução de créditos",
          "`ai-utils.ts` — Gateway AI, parse de respostas, tool calls",
          "`pandora-prompt.ts` — Prompt unificado da Pandora",
          "`pandora-response-cleaner.ts` / `pandora-session.ts` — Limpeza de respostas e gestão de sessão",
          "`pandora-tools/` — Registry de 124+ ferramentas da Pandora",
          "`composio-client.ts` / `mcp-composio.ts` — Cliente Composio e MCP server",
          "`r2-client.ts` — Upload para Cloudflare R2",
          "`pluggy-utils.ts` + 4 handlers — Open Finance (balance, enrich, insights, payments)",
          "`serp-search-handler.ts` / `serp-monitor-handler.ts` — Busca SERP e monitoramento",
          "`email-notification.ts` / `email-automation.ts` / `email-unsub.ts` — E-mails transacionais",
          "`whatsapp-*.ts` (8 módulos) — Auth, contacts, messages, sessions, sync, webhook, utils, evolution",
          "`tool-registry.ts` / `event-emitter.ts` — Registry de tools e event bus",
          "`billing-*.ts` (3 módulos) — Checkout, coupons e details handler",
          "`data-export.ts` / `data-import.ts` — Import/export de dados",
        ],
      },
    ],
  },
  {
    id: "credits",
    title: "Sistema de Créditos",
    icon: CreditCard,
    color: "text-amber-400",
    content: [
      {
        text: "Modelo pay-per-use. Cada ação consome uma quantidade específica de créditos. O sistema usa a função RPC `consume_credits` para dedução atômica com validação de saldo e status de assinatura.",
      },
      {
        heading: "Tabela de Custos",
        table: {
          headers: ["Ação", "Créditos"],
          rows: [
            ["Busca (SERP/News/Images/etc.)", "1"],
            ["Mensagem WhatsApp", "1.5"],
            ["AI Chat (Pandora clássica)", "3"],
            ["AI Calendar / Email / Files / Notes / Map", "3"],
            ["AI Contacts / Messages / Week Planner / Stock", "4"],
            ["AI Pandora MCP / Summary / Finance / WhatsApp Reply / Briefing", "5"],
            ["Social: Post / Relatório PDF", "5"],
            ["AI Image Generation", "8"],
            ["AI Image (Leonardo) / ElevenLabs TTS / Open Banking", "10"],
            ["WhatsApp Full Sync", "15"],
            ["Deep Research", "25"],
          ],
        },
      },
      {
        heading: "Fluxo de Créditos",
        list: [
          "Signup → trigger `handle_new_user_trial` → 100 créditos de teste (válidos por 30 dias)",
          "Dedução via `consume_credits` RPC (valida saldo + subscription)",
          "Compra de pacotes via Stripe Checkout → `stripe-webhook` → `add_credits`",
          "Auto-purchase: se saldo < threshold → compra automática do pacote configurado",
          "Cupons: `redeem_coupon` RPC com validação de uso único e expiração",
          "Admin: `admin_grant_credits` para concessão manual",
        ],
      },
    ],
  },
  {
    id: "auth",
    title: "Autenticação & Segurança",
    icon: Shield,
    color: "text-red-400",
    content: [
      {
        heading: "Autenticação",
        list: [
          "Login com e-mail/senha via Supabase Auth",
          "Verificação de e-mail obrigatória (auto-confirm desabilitado)",
          "Sessão gerenciada via `AuthContext` + `useAuthSession`",
          "Profiles criados automaticamente via trigger `handle_new_user`",
        ],
      },
      {
        heading: "Roles & Permissões",
        list: [
          "Roles: `admin`, `moderator`, `user` (enum `app_role`)",
          "Tabela separada `user_roles` (nunca no profile — evita privilege escalation)",
          "Função `has_role()` (SECURITY DEFINER) para checagem sem recursão RLS",
          "Primeiro usuário recebe `admin` automaticamente",
          "RLS ativo em todas as tabelas com policies baseadas em `auth.uid()`",
        ],
      },
      {
        heading: "Moderação Admin",
        list: [
          "`admin_suspend_user` / `admin_unsuspend_user` — Suspensão temporária",
          "`admin_ban_user` / `admin_unban_user` — Banimento permanente",
          "`admin_archive_user` / `admin_unarchive_user` — Arquivamento com expiração",
          "`safe_update_profile` trigger — Impede alteração de campos admin por usuários comuns",
          "`admin_logs` — Auditoria completa de ações administrativas",
        ],
      },
      {
        heading: "API Keys (Gateway)",
        text: "Usuários podem gerar API keys pessoais (`desh_` + 32 hex) com hash SHA-256 via `generate_gateway_api_key`. Revogação via `revoke_gateway_api_key`.",
      },
    ],
  },
  {
    id: "database",
    title: "Banco de Dados",
    icon: Database,
    color: "text-teal-400",
    content: [
      {
        heading: "Tabelas Principais (114)",
        table: {
          headers: ["Grupo", "Tabelas"],
          rows: [
            ["Core", "profiles, user_roles, user_data, workspaces, workspace_documents, user_workspace_preferences"],
            ["AI", "ai_conversations, ai_agents, ai_projects, ai_memories, ai_knowledge_base, ai_insights, ai_skills, tool_jobs"],
            ["Pandora", "pandora_interaction_logs, pandora_processing_locks, pandora_sessions, pandora_tool_calls, pandora_wa_audit_log"],
            ["Produtividade", "tasks, task_subtasks, contacts, contact_interactions, calendar_events_cache, emails_cache, email_snoozes"],
            ["Finanças", "finance_transactions, finance_recurring, finance_budgets, finance_goals, financial_accounts, financial_connections, financial_insights, financial_investments, financial_investment_transactions, financial_loans, financial_payment_*, financial_sync_logs, financial_transactions_unified, financial_webhook_logs"],
            ["Arquivos", "files, file_folders, file_links, file_share_links, file_inbox, user_files, user_folders"],
            ["WhatsApp", "whatsapp_conversations, whatsapp_messages, whatsapp_web_sessions, whatsapp_connections, whatsapp_presence, whatsapp_ai_settings, whatsapp_session_logs, whatsapp_sync_jobs, whatsapp_web_session_logs"],
            ["Social", "social_profiles, social_posts, social_accounts, social_analytics_cache, social_ai_insights, social_alerts, social_brand_profiles, social_competitors, social_metric_snapshots, social_subscriptions, social_templates"],
            ["Billing", "user_credits, user_subscriptions, credit_transactions, credit_packages, coupons, coupon_redemptions, billing_preferences"],
            ["Automação", "automation_rules, automation_logs, automation_events"],
            ["Integrações", "connections, composio_action_logs, composio_user_emails, platform_integrations"],
            ["Social (Amizade)", "friendships, friend_requests, workspace_shares, widget_shares"],
            ["Admin", "admin_logs, broadcasts, broadcast_dismissals, error_reports"],
            ["Email Sistema", "email_templates, email_automations, email_send_log, email_rate_limits, email_cleanup_sessions, unsubscribe_history"],
            ["Gmail", "gmail_labels_cache, gmail_messages_cache, gmail_sync_state"],
            ["Logging", "user_activity_logs, pandora_interaction_logs, search_history, search_projects, webhook_events, gateway_api_key_logs"],
            ["Auth", "phone_authorization_otps, user_gateway_api_keys, provider_settings, quick_replies"],
            ["Temas", "shared_themes, profile_documents, notification_preferences"],
            ["SERP", "serp_monitors, serp_monitor_results"],
          ],
        },
      },
      {
        heading: "Manutenção Automática",
        text: "A função `run_db_maintenance()` executa limpeza periódica de: locks Pandora (60s), rate limits (24h), webhook events (7d), session logs (30d), search history (90d), action logs (30d), activity logs (90d), interaction logs (60d), snoozes restaurados (7d) e error reports (30-90d).",
      },
    ],
  },
  {
    id: "search",
    title: "Busca & Pesquisa",
    icon: Search,
    color: "text-indigo-400",
    content: [
      {
        text: "A busca utiliza orquestração Gemini para motores SerpAPI e Perplexity, com detecção de intenção e formatação contextual.",
      },
      {
        heading: "Features",
        list: [
          "Detecção de intenção (comparação, tutorial, reviews) com regras de formatação",
          "Streaming com contador de palavras e timer",
          "Limite de 500 chars por query, 20 req/min por usuário",
          "Histórico em IndexedDB com debouncing 500ms",
          "Autocomplete com navegação por teclado",
          "Sugestões de acompanhamento contextuais",
          "Classificação granular de erros (402, 429, 504)",
          "16 motores SERP: Web, News, Images, Shopping, Trends, Finance, Flights, Hotels, Jobs, Events, Scholar, YouTube, Maps, Patents",
          "Monitors: alertas de busca com verificação periódica",
        ],
      },
    ],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-400",
    content: [
      {
        heading: "WhatsApp Web (Pessoal)",
        text: "Conexão via QR code com sessão gerenciada em `whatsapp_web_sessions`. Sync de conversas e mensagens via `whatsapp-web-proxy`. Suporte a Pandora AI para respostas automáticas.",
      },
      {
        heading: "WhatsApp Business (Zernio)",
        list: [
          "**Broadcasts**: Campanhas em massa com tracking de entrega",
          "**Templates**: CRUD com monitoramento de aprovação Meta",
          "**Contatos**: CRM com tags, grupos e importação CSV",
          "**Perfil**: Edição de informações oficiais do negócio",
          "**Números**: Compra e verificação de phone numbers",
        ],
      },
      {
        heading: "Sessão Auto-Expiry",
        text: "Função `expire_inactive_whatsapp_sessions` expira sessões sem heartbeat por mais de 5 minutos. Status logs via trigger `log_whatsapp_web_session_status_change`.",
      },
    ],
  },
  {
    id: "finance",
    title: "Finanças & Open Finance",
    icon: DollarSign,
    color: "text-yellow-400",
    content: [
      {
        heading: "Módulos Financeiros",
        list: [
          "**Transações**: CRUD manual + sync automático via Open Banking",
          "**Recorrências**: Despesas/receitas fixas com dia do mês",
          "**Orçamentos**: Limites mensais por categoria",
          "**Metas**: Objetivos de poupança com progresso visual",
          "**Contas bancárias**: Saldos sincronizados via Pluggy",
          "**Análise de ações**: Consulta e análise via AI",
        ],
      },
      {
        heading: "Open Finance (Pluggy)",
        text: "Integração via Pluggy para sincronização de contas e transações bancárias. Webhooks para item, transações e pagamentos processados em `financial-webhook`. Connect token gerenciado em `pluggy-proxy`.",
      },
    ],
  },
  {
    id: "social",
    title: "Social Media",
    icon: Share2,
    color: "text-rose-400",
    content: [
      {
        heading: "Funcionalidades",
        list: [
          "Gerenciamento multi-plataforma (Instagram, Facebook, Twitter, LinkedIn)",
          "Criação e agendamento de posts com AI",
          "Analytics e métricas de engajamento com seletor de período (7d, 30d, 90d)",
          "Gráficos de tendência temporal (evolução de seguidores e engajamento) via `social_metric_snapshots`",
          "Detalhes inline expansíveis por plataforma (substituiu sidebar Sheet)",
          "Comparação de plataformas com ranking visual e barras de progresso",
          "Upload de mídia com preview",
          "Fila de publicação (queue management)",
          "Inbox social: mensagens e comentários",
          "Melhor horário para postar (AI analysis)",
          "Templates de post reutilizáveis",
          "Insights de IA renderizados em Markdown com histórico persistido em `social_ai_insights`",
          "Funil de conversão de anúncios e sistema de alertas proativos (ROAS, orçamento, quedas)",
          "Conexão via Composio + Facebook SDK (Instagram Business)",
          "Métricas animadas com contadores progressivos (useCountUp)",
          "Perfis de marca (`social_brand_profiles`) e monitoramento de concorrentes (`social_competitors`)",
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notificações & E-mail",
    icon: Bell,
    color: "text-violet-400",
    content: [
      {
        heading: "Sistema de Notificações",
        list: [
          "In-app via `NotificationsContext`",
          "Toast notifications via sonner",
          "Sound alerts configuráveis",
          "Preferências por tipo em `notification_preferences`",
        ],
      },
      {
        heading: "E-mails Transacionais",
        list: [
          "Templates HTML gerenciados em `email_templates`",
          "Automações por trigger (onboarding, inatividade, etc.)",
          "Rate limiting por tipo e usuário",
          "Log completo em `email_send_log`",
          "Hook de autenticação (`auth-email-hook`) para customização",
          "Unsubscribe com token via `email-unsubscribe`",
        ],
      },
    ],
  },
  {
    id: "social-friends",
    title: "Amizade & Social",
    icon: Users,
    color: "text-lime-400",
    content: [
      {
        heading: "Sistema de Amizade",
        list: [
          "Friend code único (gerado via trigger `generate_friend_code`)",
          "Busca por e-mail ou código (`find_user_by_email`, `find_user_by_friend_code`)",
          "Solicitações com accept/reject (`friend_requests`)",
          "Tabela bidirecional `friendships`",
          "Compartilhamento de workspaces entre amigos",
        ],
      },
    ],
  },
  {
    id: "workspace-sharing",
    title: "Workspaces & Compartilhamento",
    icon: Users,
    color: "text-sky-400",
    content: [
      {
        heading: "Workspaces",
        list: [
          "Cada usuário tem um workspace padrão ('Principal') criado via trigger",
          "Múltiplos workspaces com ícone, cor e ordenação",
          "Dados isolados por workspace_id em todas as tabelas relevantes",
          "`ensure_default_workspace` garante workspace para usuários legados",
        ],
      },
      {
        heading: "Compartilhamento",
        text: "9 módulos compartilháveis: Tarefas, Notas, Calendário, Contatos, Hábitos, Metas, Transações, Recorrências e Orçamentos. Permissões granulares (view/edit) com validação via `create_workspace_share` (SECURITY DEFINER).",
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    icon: Webhook,
    color: "text-fuchsia-400",
    content: [
      {
        heading: "Endpoints de Webhook",
        table: {
          headers: ["Fonte", "Edge Function", "Eventos"],
          rows: [
            ["Stripe", "stripe-webhook", "checkout.session.completed, invoice.paid"],
            ["Composio", "composio-webhook", "Notificações de ações e conexões"],
            ["Gmail", "gmail-webhook", "Push notifications de novos e-mails"],
            ["WhatsApp (Zernio)", "whatsapp-webhook", "Mensagens recebidas/status"],
            ["WhatsApp Gateway", "whatsapp-gateway-callback", "Callback de sessão"],
            ["Pluggy", "financial-webhook", "Item, transações, pagamentos"],
          ],
        },
      },
      {
        heading: "Monitoramento",
        text: "Todos os eventos são registrados em `webhook_events` com status, tempo de execução, mensagens de erro e payload JSON. O painel admin unifica visualização e reprocessamento.",
      },
    ],
  },
  {
    id: "admin-panel",
    title: "Painel Admin",
    icon: Lock,
    color: "text-red-300",
    content: [
      {
        heading: "Abas Disponíveis",
        table: {
          headers: ["Aba", "Funcionalidade"],
          rows: [
            ["Métricas", "Dashboard com stats de usuários, dados e conexões + gráfico de crescimento"],
            ["Usuários", "Listagem completa com detalhes, roles, suspensão, ban, créditos"],
            ["Logs", "Auditoria de ações admin com filtros, busca e exportação CSV"],
            ["Avisos", "Broadcasts globais para todos os usuários"],
            ["Faturamento", "Pacotes de créditos, cupons e gestão Stripe"],
            ["Integrações", "Adoção de Composio por toolkit com métricas"],
            ["Webhooks", "Eventos Composio + Pluggy com reprocessamento"],
            ["Pandora IA", "Logs de interações, ferramentas mais usadas, latência"],
            ["E-mail", "Templates, automações e logs de envio"],
            ["Blog", "CRUD de artigos com editor rich-text"],
            ["Composio Docs", "Documentação interativa de 28+ ações mapeadas"],
            ["Erros", "Error reports com severidade e resolução"],
            ["Documentação", "Esta página — documentação completa do sistema"],
          ],
        },
      },
    ],
  },
  {
    id: "ai-models",
    title: "Modelos de IA",
    icon: Cpu,
    color: "text-violet-300",
    content: [
      {
        text: "O DESH utiliza o **Lovable AI Gateway** para acessar múltiplos modelos sem necessidade de API keys individuais. O roteamento é feito via `_shared/ai-utils.ts`.",
      },
      {
        heading: "Modelos Disponíveis",
        table: {
          headers: ["Modelo", "Provider", "Uso Principal"],
          rows: [
            ["google/gemini-3-flash-preview", "Google", "Modelo padrão para maioria das funções AI (rápido, balanceado)"],
            ["google/gemini-2.5-flash", "Google", "Busca web, tarefas simples, resumos"],
            ["google/gemini-2.5-pro", "Google", "Raciocínio complexo, análise de imagens, deep research"],
            ["google/gemini-2.5-flash-lite", "Google", "Classificação, OCR, categorização (mais barato)"],
            ["openai/gpt-5", "OpenAI", "Alternativa premium para raciocínio avançado"],
            ["openai/gpt-5-mini", "OpenAI", "Custo-benefício intermediário"],
            ["openai/gpt-5-nano", "OpenAI", "Alta velocidade, tarefas simples"],
            ["claude-sonnet-4-5", "Anthropic", "Modo MCP exclusivo (tool calling nativo)"],
          ],
        },
      },
      {
        heading: "Mapeamento Modelo → Função",
        table: {
          headers: ["Edge Function", "Modelo Padrão", "Justificativa"],
          rows: [
            ["chat (Pandora)", "gemini-3-flash-preview", "Balanceamento velocidade/qualidade"],
            ["pandora-mcp", "claude-sonnet-4-5", "MCP nativo com tool calling"],
            ["deep-research", "gemini-2.5-pro", "Contexto grande, raciocínio complexo"],
            ["ai-router (tasks/notes/calendar)", "gemini-3-flash-preview", "Resposta rápida para módulos"],
            ["ai-router (email/contacts)", "gemini-3-flash-preview", "Composição e análise de texto"],
            ["ai-router (finance)", "gemini-3-flash-preview", "Análise financeira e recomendações"],
            ["ai-router (files OCR)", "gemini-2.5-flash-lite", "Processamento eficiente de arquivos"],
            ["search-web / serp-proxy", "gemini-2.5-flash", "Orquestração de busca rápida"],
            ["media-gen (smart-prompt)", "gemini-2.5-flash", "Otimização de prompts de imagem"],
            ["ai-proactive-insights", "gemini-2.5-flash", "Insights periódicos automatizados"],
            ["widgets-proxy (briefing)", "gemini-3-flash-preview", "Resumo matinal personalizado"],
          ],
        },
      },
      {
        heading: "Gateway AI",
        code: `// Chamada padrão via ai-utils.ts
const response = await callAI(apiKey, messages, {
  model: "google/gemini-3-flash-preview",
  temperature: 0.7,
  maxTokens: 4096,
  timeoutMs: 55000,
});

// URL do gateway
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";`,
      },
    ],
  },
  {
    id: "hooks-reference",
    title: "Hooks Reference",
    icon: Workflow,
    color: "text-orange-300",
    content: [
      {
        text: "O projeto possui **171 hooks customizados** em 22 domínios funcionais. Abaixo os hooks mais críticos e suas responsabilidades.",
      },
      {
        heading: "Core & Infraestrutura",
        table: {
          headers: ["Hook", "Responsabilidade"],
          rows: [
            ["useAuth (context)", "Sessão, login, logout, dados do usuário"],
            ["useAuthSession", "Gerenciamento de sessão persistente"],
            ["useAdminRole", "Verificação de role admin"],
            ["useEdgeFn", "Wrapper para invocar edge functions com retry e error handling"],
            ["useSubscription", "Status de assinatura e saldo de créditos"],
            ["useCreditError", "Interceptação e tratamento de erros 402"],
            ["useErrorReporter", "Captura e envio de erros para error_reports"],
            ["useActivityLog", "Registro de atividade do usuário"],
            ["useWorkspaceFilter", "Filtragem de dados por workspace ativo"],
            ["useOnlineStatus", "Detecção de conectividade"],
            ["useReducedMotion", "Respeito a preferências de acessibilidade"],
          ],
        },
      },
      {
        heading: "Composio & Integrações",
        table: {
          headers: ["Hook", "Responsabilidade"],
          rows: [
            ["useComposioProxy", "Wrapper central para composio-proxy com workspace injection"],
            ["useComposioConnection", "Status de conexão por toolkit"],
            ["useComposioWorkspaceId", "Resolução do entityId composto"],
            ["useGoogleData", "Chamadas one-off à API Google via proxy"],
            ["useGoogleServiceData", "Cache e sync de dados Google por serviço"],
            ["useCalendarSync", "Sync full + incremental do Google Calendar"],
            ["useGmailSync", "Sync de e-mails com cache local"],
            ["useMultiDriveData", "Listagem multi-conta do Google Drive"],
            ["useDriveUpload", "Upload de arquivos para Google Drive"],
            ["useComposioSlack / Notion / Github", "Hooks especializados por toolkit"],
          ],
        },
      },
      {
        heading: "Dados & CRUD",
        table: {
          headers: ["Hook", "Responsabilidade"],
          rows: [
            ["useDbTasks", "CRUD de tarefas com workspace filter"],
            ["useDbContacts", "CRUD de contatos com sync Google"],
            ["useDbFinances", "Transações, recorrências, orçamentos"],
            ["useNotesLogic", "Lógica completa de notas (auto-save, tags, pastas)"],
            ["useCalendarEvents", "Eventos locais + Google Calendar"],
            ["useFileStorage", "Upload, download e gestão de arquivos"],
            ["useFinanceExtended", "Metas, análises e estatísticas financeiras"],
            
          ],
        },
      },
      {
        heading: "AI & Chat",
        table: {
          headers: ["Hook", "Responsabilidade"],
          rows: [
            ["useAIConversations", "CRUD de conversas com Pandora"],
            ["useAIAgents", "Agentes customizados do usuário"],
            ["useAIProjects", "Projetos AI com conversas agrupadas"],
            ["useAIToolExecution", "Execução de ferramentas AI no frontend"],
            ["useToolJobQueue", "Fila de jobs assíncronos (tool-worker)"],
            ["usePandoraMCP", "Modo MCP com Claude + Composio"],
            ["useSearchLogic", "Lógica de busca web com streaming"],
            ["useSerpSearch", "Chamadas diretas ao SERP proxy"],
          ],
        },
      },
      {
        heading: "Comunicação",
        table: {
          headers: ["Hook", "Responsabilidade"],
          rows: [
            ["useWhatsappConversations", "Conversas WhatsApp Web"],
            ["useWhatsappMessages", "Mensagens + sync via proxy"],
            ["useWhatsappWebSession", "QR code, status, heartbeat"],
            ["useEmailActions", "Ações Gmail (star, archive, trash)"],
            ["useEmailBatchActions", "Ações em lote no inbox"],
            ["useEmailSnooze", "Snooze de e-mails com restauração"],
            ["useLateInboxConversations / Messages", "Inbox social via Late proxy"],
            ["useSocialPosts / Queue / Analytics / Trend", "Gestão de posts, métricas e tendências temporais"],
          ],
        },
      },
    ],
  },
  {
    id: "data-flows",
    title: "Fluxos de Dados",
    icon: Activity,
    color: "text-cyan-300",
    content: [
      {
        heading: "Fluxo de Autenticação",
        code: `AuthPage → supabase.auth.signUp/signInWithPassword
  → trigger: handle_new_user → profiles
  → trigger: handle_new_user_role → user_roles
  → trigger: handle_new_user_trial → user_subscriptions + user_credits (100)
  → trigger: handle_new_user_workspace → workspaces ("Principal")
  → trigger: handle_new_user_notification_prefs → notification_preferences
  → redirect → /welcome → /dashboard`,
      },
      {
        heading: "Fluxo de Chat (Pandora)",
        code: `ChatPanel → useAIConversations.sendMessage()
  → edge: chat (POST)
    → buildSystemPrompt() (pandora-prompt.ts)
    → callAI() (ai-utils.ts) → Lovable AI Gateway
    → Tool calls? → executeTools() → callAI() again
    → Ação pesada? → tool_jobs INSERT → trigger dispatch_tool_job → tool-worker
  → Response → save to ai_conversations.messages
  → Realtime subscription (tool_jobs) → UI update`,
      },
      {
        heading: "Fluxo de Integração (Composio)",
        code: `IntegrationsPage → useComposioConnection.connect()
  → edge: integrations-connect (POST { toolkit })
    → Composio API → initiateConnection()
    → redirectUrl → OAuth popup
    → Composio callback → connection stored
  → Frontend polls status → "ACTIVE"
  → useComposioProxy.callComposioProxy({ service, path })
    → edge: composio-proxy
      → resolve entityId (userId_workspaceId)
      → normalize params → Composio executeAction()
      → log to composio_action_logs
    → Response → Frontend`,
      },
      {
        heading: "Fluxo de Pagamento",
        code: `BillingPage → edge: billing (POST { action: "create_checkout" })
  → Stripe Checkout Session → redirect
  → Pagamento → stripe-webhook (POST)
    → checkout.session.completed
    → add_credits() RPC → user_credits + credit_transactions
  → Frontend polls balance → UI update`,
      },
      {
        heading: "Fluxo de Busca Web",
        code: `SearchPage → useSearchLogic.search()
  → edge: serp-proxy (POST { action: "search", params })
    → deductCredits() (1 crédito)
    → SerpAPI fetch → raw results
    → AI orchestration (Gemini) → formatted streaming
  → Frontend SSE → progressive render
  → Save to search_history`,
      },
      {
        heading: "Fluxo de Automação",
        code: `AutomationsPage → useAutomations.create()
  → INSERT automation_rules
  → useAutomationEngine → avalia triggers periodicamente:
    - schedule: cron-like check
    - event: listener via Realtime
  → Trigger matched → execute action
    → composio-proxy / internal tools
    → INSERT automation_logs
  → UI notification`,
      },
    ],
  },
  {
    id: "env-secrets",
    title: "Variáveis & Secrets",
    icon: Key,
    color: "text-amber-300",
    content: [
      {
        heading: "Variáveis de Ambiente (Frontend)",
        table: {
          headers: ["Variável", "Uso"],
          rows: [
            ["VITE_SUPABASE_URL", "URL do projeto Supabase (auto-gerada)"],
            ["VITE_SUPABASE_PUBLISHABLE_KEY", "Chave anon pública (auto-gerada)"],
            ["VITE_SUPABASE_PROJECT_ID", "ID do projeto para referência"],
          ],
        },
      },
      {
        note: "O arquivo .env é auto-gerenciado pelo Lovable Cloud. NUNCA edite manualmente.",
      },
      {
        heading: "Secrets (Edge Functions)",
        table: {
          headers: ["Secret", "Usado por", "Descrição"],
          rows: [
            ["SUPABASE_URL", "Todas", "URL do projeto (auto)"],
            ["SUPABASE_SERVICE_ROLE_KEY", "Todas", "Chave admin (auto)"],
            ["LOVABLE_API_KEY", "AI functions", "Gateway AI Lovable"],
            ["COMPOSIO_API_KEY", "composio-proxy, integrations-connect, pandora-mcp", "API Composio"],
            ["STRIPE_SECRET_KEY", "billing, stripe-webhook", "Stripe API"],
            ["STRIPE_WEBHOOK_SECRET", "stripe-webhook", "Validação de webhook"],
            ["SERP_API_KEY", "serp-proxy", "SerpAPI"],
            ["PERPLEXITY_API_KEY", "search-web", "Perplexity AI"],
            ["MAPBOX_SECRET_TOKEN", "mapbox-proxy", "Mapbox API"],
            ["PLUGGY_CLIENT_ID / SECRET", "pluggy-proxy, finance-sync", "Open Finance Pluggy"],
            ["ELEVENLABS_API_KEY", "media-gen (TTS)", "ElevenLabs TTS"],
            ["LEONARDO_API_KEY", "media-gen (image)", "Leonardo AI"],
            ["R2_ACCESS_KEY_ID / SECRET", "files-storage", "Cloudflare R2 Storage"],
            ["RESEND_API_KEY", "email-system, send-notification-email", "Resend (e-mails transacionais)"],
            ["ZERNIO_API_KEY", "whatsapp-proxy", "WhatsApp Business API"],
            ["LATE_API_KEY", "late-proxy", "Late.so (Social inbox)"],
            ["FACEBOOK_APP_ID / SECRET", "facebook-auth", "Facebook OAuth"],
          ],
        },
      },
    ],
  },
  {
    id: "error-handling",
    title: "Tratamento de Erros",
    icon: AlertTriangle,
    color: "text-red-300",
    content: [
      {
        heading: "Erros HTTP Padronizados",
        table: {
          headers: ["Status", "Significado", "Tratamento no Frontend"],
          rows: [
            ["400", "Parâmetros inválidos", "Toast com mensagem de validação"],
            ["401", "Não autenticado", "Redirect para /auth"],
            ["402", "Créditos insuficientes", "Modal de compra de créditos (useCreditError)"],
            ["403", "Não autorizado (role)", "Toast de permissão negada"],
            ["404", "Recurso não encontrado", "Fallback ou mensagem contextual"],
            ["429", "Rate limit excedido", "Toast com retry timer"],
            ["500", "Erro interno", "Toast genérico + log em error_reports"],
            ["504", "Timeout", "Toast com sugestão de retry"],
          ],
        },
      },
      {
        heading: "Error Reporting",
        list: [
          "`useErrorReporter` captura erros não tratados (window.onerror, unhandledrejection)",
          "Erros são enviados para a tabela `error_reports` com: mensagem, stack, URL, user_agent, severity",
          "Painel admin (aba Erros) permite visualizar, filtrar e resolver error reports",
          "Edge functions usam try-catch com logging estruturado",
        ],
      },
      {
        heading: "Retry & Resilience",
        list: [
          "`useEdgeFn` implementa retry automático com backoff exponencial",
          "Composio proxy retorna errors estruturados (NOT_CONNECTED, TOKEN_EXPIRED)",
          "AI gateway timeout: 55s com AbortController",
          "Webhook reprocessamento via painel admin para eventos falhados",
          "Gmail watch handler retorna graceful fallback (200 + reason) em vez de 500",
        ],
      },
    ],
  },
  {
    id: "pwa-performance",
    title: "PWA & Performance",
    icon: Monitor,
    color: "text-green-300",
    content: [
      {
        heading: "Progressive Web App",
        list: [
          "Configuração via `vite-plugin-pwa` em `vite.config.ts`",
          "Service Worker para cache offline de assets estáticos",
          "Manifest com ícones e splash screens",
          "`PWAUpdatePrompt` componente para atualizar app em produção",
          "Safe area insets para dispositivos com notch (iOS)",
        ],
      },
      {
        heading: "Otimizações de Performance",
        list: [
          "**Code Splitting**: Todas as 34 páginas são lazy-loaded via `React.lazy`",
          "**Route Prefetch**: SideNav prefetches rotas adjacentes on hover",
          "**Memoization**: `React.memo` em componentes pesados, `useMemo`/`useCallback` em hooks",
          "**Virtual Lists**: Listas grandes com paginação no servidor (limit 50-200)",
          "**Image Lazy Loading**: `loading='lazy'` em todas as imagens de avatar/mídia",
          "**Debouncing**: Inputs de busca com 300-500ms debounce",
          "**IndexedDB**: Cache de histórico de busca e dados offline",
          "**Realtime**: Subscriptions apenas em tabelas críticas (tool_jobs, whatsapp_messages)",
          "**Edge Function Init**: Clientes Supabase inicializados no nível superior (não por request)",
          "**Select Columns**: Queries com colunas explícitas em vez de `select('*')` para reduzir payload",
        ],
      },
      {
        heading: "Limites Conhecidos",
        list: [
          "Supabase: limite padrão de 1000 rows por query",
          "Edge Functions: timeout de 60s (configurado para 25-55s internamente)",
          "AI Gateway: timeout de 55s por chamada",
          "Rate limits: 20 buscas/min, rate limits por tipo de email",
          "File upload: limite de tamanho por plano (Supabase Storage)",
        ],
      },
    ],
  },
  {
    id: "design-system",
    title: "Design System",
    icon: Palette,
    color: "text-pink-300",
    content: [
      {
        heading: "Fundamentos",
        list: [
          "**Framework**: Tailwind CSS com tokens semânticos em `index.css`",
          "**Componentes**: shadcn/ui com customizações via `class-variance-authority`",
          "**Animações**: Framer Motion para transições de página e interações",
          "**Ícones**: Lucide React (462+ ícones)",
          "**Tipografia**: System fonts com fallbacks",
        ],
      },
      {
        heading: "Tokens CSS",
        code: `/* index.css — Tokens semânticos (HSL) */
:root {
  --background: ...;      /* Fundo principal */
  --foreground: ...;      /* Texto principal */
  --primary: ...;         /* Cor de ação/destaque */
  --primary-foreground: ; /* Texto sobre primary */
  --secondary: ...;       /* Cor secundária */
  --muted: ...;           /* Elementos discretos */
  --accent: ...;          /* Detalhes de interface */
  --destructive: ...;     /* Ações perigosas */
  --border: ...;          /* Bordas */
  --ring: ...;            /* Focus rings */
}`,
      },
      {
        heading: "Componentes Comuns",
        table: {
          headers: ["Componente", "Uso"],
          rows: [
            ["PageLayout", "Wrapper de página com wallpaper, safe-area, max-width"],
            ["PageHeader", "Cabeçalho com ícone, título, subtítulo e actions"],
            ["glass-card", "Classe utilitária para cards com efeito glassmorphism"],
            ["Button (shadcn)", "Botões com variantes: default, destructive, outline, ghost"],
            ["Dialog / Sheet", "Modais e drawers para formulários e detalhes"],
            ["Tabs", "Navegação por abas em painéis complexos"],
            ["Toast (sonner)", "Notificações temporárias de feedback"],
          ],
        },
      },
      {
        heading: "Temas",
        text: "O sistema suporta temas via `ThemeContext` com variáveis CSS em `index.css`. Inclui editor de temas (`/themes`) para personalização de cores, wallpapers e aparência. Dark mode via `next-themes` com detecção automática de preferência do sistema.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: Settings,
    color: "text-gray-300",
    content: [
      {
        heading: "Problemas Comuns",
        table: {
          headers: ["Problema", "Causa Provável", "Solução"],
          rows: [
            ["Tela branca após login", "Workspace padrão não criado", "Executar ensure_default_workspace() via SQL"],
            ["'Créditos insuficientes' inesperado", "Subscription inativa ou saldo zerado", "Verificar user_subscriptions.status e user_credits.balance"],
            ["Integração Google 'not connected'", "entityId incorreto ou token expirado", "Reconectar via /integrations, verificar composio_action_logs"],
            ["Edge function 500", "Secret não configurado ou timeout", "Verificar logs da função, confirmar secrets no Vault"],
            ["WhatsApp desconectado", "Sessão expirada (>5min sem heartbeat)", "Reconectar via QR code, verificar whatsapp_web_sessions"],
            ["Busca sem resultados", "SERP_API_KEY inválido ou rate limit", "Verificar secret, checar serp_search logs"],
            ["E-mail não enviado", "RESEND_API_KEY ausente ou rate limit", "Verificar email_send_log para detalhes do erro"],
            ["Pandora não responde", "LOVABLE_API_KEY expirado ou timeout", "Verificar logs do chat edge function"],
            ["Dados não aparecem", "Workspace filter ativo", "Verificar workspace_id no contexto do usuário"],
            ["RLS blocking queries", "Policy faltando ou auth.uid() null", "Verificar policies da tabela + token de autenticação"],
          ],
        },
      },
      {
        heading: "Diagnóstico Rápido",
        list: [
          "**Logs Edge Functions**: Aba 'Erros' no painel admin ou logs do Supabase",
          "**Composio Actions**: Aba 'Composio Docs' para testar ações diretamente",
          "**Webhooks**: Aba 'Webhooks' para ver eventos recentes e reprocessar falhas",
          "**Pandora Logs**: Aba 'Pandora IA' para ver ferramentas chamadas e latência",
          "**User Details**: Modal de usuário na aba 'Usuários' para ver dados completos",
          "**DB Maintenance**: Executar `run_db_maintenance()` para limpeza de dados antigos",
          "**Credit Audit**: Tabela `credit_transactions` para rastrear dedução/adição",
        ],
      },
      {
        heading: "Contatos de Suporte Técnico",
        list: [
          "**Composio**: docs.composio.dev — Problemas com OAuth, actions, toolkits",
          "**Stripe**: dashboard.stripe.com — Problemas com pagamentos, webhooks",
          "**Pluggy**: docs.pluggy.ai — Problemas com Open Finance",
          "**SerpAPI**: serpapi.com — Problemas com busca",
          "**Mapbox**: docs.mapbox.com — Problemas com mapas e geocoding",
          "**Resend**: resend.com — Problemas com e-mails transacionais",
        ],
      },
    ],
  },
  {
    id: "shared-modules",
    title: "Módulos Compartilhados",
    icon: FolderOpen,
    color: "text-teal-300",
    content: [
      {
        text: "O diretório `_shared/` contém **63 módulos** reutilizados por múltiplas edge functions. Organizados por domínio funcional.",
      },
      {
        heading: "Infraestrutura",
        table: {
          headers: ["Módulo", "Exports Principais", "Usado por"],
          rows: [
            ["utils.ts", "corsHeaders, handleCors(), jsonResponse(), errorResponse()", "Todas as edge functions"],
            ["auth.ts", "verifyAuth() — JWT + fallback getUser", "Todas as funções autenticadas"],
            ["credits.ts", "deductCredits(), insufficientCreditsResponse(), CREDIT_COSTS", "Todas as funções com custo"],
            ["ai-utils.ts", "callAI(), getApiKey(), parseJsonFromAI(), parseToolCallResult(), aiErrorResponse()", "Todas as funções AI"],
            ["r2-client.ts", "uploadToR2(), downloadFromR2(), deleteFromR2()", "files-storage, media-gen"],
            ["composio-client.ts", "getComposioAccessToken(), initiateConnection(), getConnectedToolkits()", "composio-proxy, pandora-mcp"],
          ],
        },
      },
      {
        heading: "AI por Módulo (Handlers)",
        table: {
          headers: ["Módulo", "Ações Suportadas"],
          rows: [
            ["ai-tasks.ts", "Listar, criar, editar, completar, deletar tarefas com contexto"],
            ["ai-notes.ts", "Buscar, criar, editar notas com sugestões de tags"],
            ["ai-calendar.ts", "Buscar eventos, verificar disponibilidade, criar/editar eventos"],
            ["ai-email.ts", "Resumir, classificar, compor, responder e-mails"],
            ["ai-contacts.ts", "Buscar, criar, editar contatos e interações"],
            ["ai-finance.ts", "Análise de gastos, orçamentos, metas, recomendações"],
            ["ai-files.ts", "Listar, buscar, resumir, categorizar arquivos"],
            ["ai-messages.ts", "Contextualizar conversas WhatsApp para IA"],
            
            ["ai-inbox.ts", "Priorização e triagem de inbox"],
            ["ai-social.ts", "Criação de posts, análise de engajamento"],
            ["ai-automation.ts", "Sugestão e criação de regras de automação"],
            ["ai-week-planner.ts", "Planejamento semanal com eventos e tarefas"],
          ],
        },
      },
      {
        heading: "Finanças & Pluggy",
        table: {
          headers: ["Módulo", "Responsabilidade"],
          rows: [
            ["pluggy-utils.ts", "Helpers para API Pluggy (headers, parsing)"],
            ["pluggy-balance-handler.ts", "Sync de saldos bancários"],
            ["pluggy-enrich-handler.ts", "Enriquecimento de transações (categorização)"],
            ["pluggy-insights-handler.ts", "Insights financeiros automatizados"],
            ["pluggy-payments-handler.ts", "Processamento de pagamentos Open Finance"],
            ["finance-connect-token-handler.ts", "Geração de connect token Pluggy"],
            ["finance-sync-handler.ts", "Sync completo de dados financeiros"],
          ],
        },
      },
      {
        heading: "Mídia & Geração",
        table: {
          headers: ["Módulo", "Responsabilidade"],
          rows: [
            ["media-image.ts", "Geração de imagens via AI (DALL-E style)"],
            ["media-leonardo.ts", "Geração premium via Leonardo AI"],
            ["media-nano-banana.ts", "Geração alternativa (NanoBanana)"],
            ["media-pdf.ts", "Geração de relatórios PDF"],
            ["media-tts.ts", "Text-to-Speech via ElevenLabs"],
            ["media-smart-prompt.ts", "Otimização de prompts de imagem via AI"],
          ],
        },
      },
      {
        heading: "Widgets & Sistema",
        table: {
          headers: ["Módulo", "Responsabilidade"],
          rows: [
            ["widget-weather-handler.ts", "Dados de clima para dashboard"],
            ["widget-news-handler.ts", "Feed de notícias"],
            ["widget-stocks-handler.ts", "Cotações de ações"],
            ["widget-briefing-handler.ts", "Morning briefing personalizado"],
            ["pandora-prompt.ts", "System prompt builder com contexto do usuário"],
            ["chat-deep-research.ts", "Pesquisa profunda multi-fonte"],
            ["chat-proactive.ts", "Insights proativos periódicos"],
            ["chat-welcome.ts", "Onboarding chat inicial"],
          ],
        },
      },
      {
        heading: "Email & Billing",
        table: {
          headers: ["Módulo", "Responsabilidade"],
          rows: [
            ["email-notification.ts", "Templates e envio de e-mails transacionais"],
            ["email-automation.ts", "Execução de automações de e-mail"],
            ["email-unsub.ts", "Lógica de unsubscribe com token"],
            ["gmail-sync-handler.ts", "Sync incremental/full do Gmail"],
            ["gmail-watch-handler.ts", "Gerenciamento de push notifications Gmail"],
            ["billing-checkout.ts", "Criação de sessão Stripe Checkout"],
            ["billing-coupons.ts", "Validação e resgate de cupons"],
            ["billing-details-handler.ts", "Detalhes de faturamento do usuário"],
            ["serp-search-handler.ts", "Busca SERP com parsing de resultados"],
            ["serp-monitor-handler.ts", "Verificação periódica de monitors SERP"],
            
            ["data-export.ts / data-import.ts", "Export/import de dados do usuário"],
          ],
        },
      },
    ],
  },
  {
    id: "pages-reference",
    title: "Páginas",
    icon: Monitor,
    color: "text-blue-300",
    content: [
      {
        text: "Todas as 34 páginas são carregadas via `React.lazy` para code splitting. O roteamento é definido em `App.tsx` com `react-router-dom`.",
      },
      {
        heading: "Páginas Públicas",
        table: {
          headers: ["Página", "Rota", "Descrição"],
          rows: [
            ["LandingPage", "/", "Landing page com features, pricing e CTA"],
            ["AuthPage", "/auth", "Login, signup, reset de senha"],
            ["PricingPage", "/pricing", "Tabela de preços e pacotes"],
            ["PrivacyPage", "/privacy", "Política de privacidade"],
            ["TermsPage", "/terms", "Termos de uso"],
            ["SharedFilePage", "/share/:token", "Acesso público a arquivo compartilhado"],
          ],
        },
      },
      {
        heading: "Páginas Autenticadas (Core)",
        table: {
          headers: ["Página", "Rota", "Módulo"],
          rows: [
            ["WelcomePage", "/welcome", "Onboarding inicial"],
            ["Index (Dashboard)", "/dashboard", "Dashboard principal"],
            ["AIPage", "/ai", "Pandora Chat + Agentes + Projetos"],
            ["TasksPage", "/tasks", "Kanban de tarefas"],
            ["NotesPage", "/notes", "Editor de notas TipTap"],
            ["CalendarPage", "/calendar", "Calendário com Google sync"],
            ["EmailPage", "/email", "Gmail integrado"],
            ["MessagesPage", "/messages", "WhatsApp Web pessoal"],
            ["ContactsPage", "/contacts", "CRM de contatos"],
            ["FinancesPage", "/finances", "Dashboard financeiro"],
            ["FilesPage", "/files", "Gerenciador de arquivos"],
            ["SearchPage", "/search", "Busca web com streaming"],
            
            ["SocialPage", "/social", "Redes sociais multi-plataforma"],
            ["InboxPage", "/inbox", "Central de comunicações"],
            ["AutomationsPage", "/automations", "Regras de automação"],
          ],
        },
      },
      {
        heading: "Páginas de Configuração",
        table: {
          headers: ["Página", "Rota", "Função"],
          rows: [
            ["ProfilePage", "/profile", "Edição de perfil do usuário"],
            ["SettingsPage", "/settings", "Configurações gerais"],
            ["BillingPage", "/billing", "Créditos, planos e faturas"],
            ["IntegrationsPage", "/integrations", "Catálogo de conexões Composio"],
            ["WorkspacesPage", "/workspaces", "CRUD de workspaces"],
            ["WidgetsPage", "/widgets", "Configuração de widgets do dashboard"],
            ["NotificationsPage", "/notifications", "Central de notificações"],
            ["WhatsappSettingsPage", "/whatsapp-settings", "Config WhatsApp Web"],
            ["WhatsappBusinessPage", "/whatsapp-business", "WhatsApp Business (Zernio)"],
            ["ActivityLogsPage", "/activity", "Logs de atividade"],
            ["PandoraDebugPage", "/pandora-debug", "Debug da Pandora IA"],
            ["AdminPage", "/admin", "Painel administrativo (admin only)"],
          ],
        },
      },
    ],
  },
  {
    id: "api-reference",
    title: "API Reference",
    icon: Server,
    color: "text-emerald-300",
    content: [
      {
        text: "Todas as edge functions são invocadas via `supabase.functions.invoke()`. Abaixo os contratos de request/response dos endpoints mais utilizados.",
      },
      {
        heading: "composio-proxy",
        code: `// Request
POST { service, path, method?, data?, params?, workspace_id? }

// Response (sucesso)
{ ...response_data }

// Response (erro)
{ error: "not_connected" | "token_expired" | "action_failed", message? }

// Exemplos de chamadas:
{ service: "gmail", path: "messages.list", params: { maxResults: 50, q: "is:unread" } }
{ service: "googlecalendar", path: "events.list", params: { timeMin, timeMax } }
{ service: "gmail", path: "messages.send", method: "POST", data: { to, subject, body } }`,
      },
      {
        heading: "chat (Pandora)",
        code: `// Request
POST { messages: Message[], conversationId?, agentId?, model? }

// Response
{ response: string, tool_results?: any[], tokens_used?: number }

// Message format
{ role: "user" | "assistant", content: string, timestamp?: string }`,
      },
      {
        heading: "billing",
        code: `// Create checkout
POST { action: "create_checkout", packageId: string, successUrl?, cancelUrl? }
→ { url: string }

// Get details
POST { action: "get_details" }
→ { subscription, credits, transactions[], packages[] }

// Redeem coupon
POST { action: "redeem_coupon", code: string }
→ { success: boolean, credits_granted?: number }`,
      },
      {
        heading: "integrations-connect",
        code: `// Initiate connection
POST { action: "connect", toolkit: string }
→ { redirectUrl: string, connectionId: string }

// List connections
POST { action: "list" }
→ { connections: { toolkit, connectionId, status, connectedAt }[] }

// Disconnect
POST { action: "disconnect", toolkit: string }
→ { success: boolean }`,
      },
      {
        heading: "files-storage",
        code: `// Upload
POST (multipart/form-data) { file, folder_id?, workspace_id? }
→ { id, name, storage_path, mime_type, size_bytes }

// Download
POST { action: "download", fileId: string }
→ { url: string, expires_in: number }

// OCR
POST { action: "ocr", fileId: string }
→ { text: string, confidence: number }`,
      },
      {
        heading: "serp-proxy",
        code: `// Search
POST { action: "search", params: { q, engine?, num? } }
→ { results: { title, link, snippet }[], answer?: string }

// Engines: google, news, images, shopping, youtube, maps, scholar,
//          patents, finance, flights, hotels, jobs, events, trends`,
      },
      {
        heading: "Módulos AI (padrão comum)",
        code: `// Todos os módulos AI seguem o mesmo contrato:
POST { action: string, context?: any, prompt?: string }
→ { result: string | object, tokens_used?: number }

// Ações variam por módulo:
// tasks-ai:    "suggest", "breakdown", "prioritize"
// notes-ai:    "summarize", "expand", "suggest_tags"
// email-ai:    "compose", "reply", "summarize", "classify"
// calendar-ai: "suggest_time", "create_event", "summarize_day"
// finance-ai:  "analyze", "categorize", "forecast"`,
      },
    ],
  },
  {
    id: "rls-policies",
    title: "RLS & Policies",
    icon: Lock,
    color: "text-red-200",
    content: [
      {
        text: "Row Level Security (RLS) está habilitado em **todas as tabelas** do sistema. As policies seguem padrões consistentes para isolamento de dados por usuário e workspace.",
      },
      {
        heading: "Padrões de Policy",
        table: {
          headers: ["Padrão", "SQL", "Uso"],
          rows: [
            ["Owner-only", "auth.uid() = user_id", "Maioria das tabelas (tasks, notes, contacts, etc.)"],
            ["Workspace-scoped", "user_id = auth.uid() AND workspace_id = ?", "Dados com multi-workspace"],
            ["Role-based", "has_role(auth.uid(), 'admin')", "admin_logs, broadcasts, blog_posts"],
            ["Public read", "true (SELECT only)", "blog_posts (published), changelogs, credit_packages"],
            ["Friendship-based", "user_id IN (SELECT friend_ids())", "workspace_shares, widget_shares"],
          ],
        },
      },
      {
        heading: "Função has_role() (SECURITY DEFINER)",
        code: `-- Evita recursão RLS ao checar roles
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;`,
      },
      {
        heading: "Tabelas Sem RLS (Públicas)",
        list: [
          "`credit_packages` — Pacotes de crédito visíveis a todos",
          "`changelogs` — Atualizações públicas do sistema",
          "`blog_posts` (published=true) — Artigos publicados",
        ],
      },
      {
        heading: "Triggers de Segurança",
        list: [
          "`safe_update_profile` — Bloqueia alteração de is_admin, is_suspended, is_banned por usuários comuns",
          "`prevent_role_self_assignment` — Impede auto-atribuição de roles",
          "`log_admin_action` — Registra toda ação admin em admin_logs",
          "`handle_new_user_role` — Primeiro usuário recebe 'admin', demais recebem 'user'",
        ],
      },
    ],
  },
  {
    id: "deployment",
    title: "Deploy & Infraestrutura",
    icon: ArrowUp,
    color: "text-green-200",
    content: [
      {
        heading: "Ambiente de Deploy",
        table: {
          headers: ["Componente", "Serviço", "Detalhes"],
          rows: [
            ["Frontend", "Lovable (Vite build)", "Deploy automático a cada push, CDN global"],
            ["Edge Functions", "Supabase Edge (Deno)", "Deploy automático, runtime Deno isolado"],
            ["Banco de Dados", "Supabase Postgres", "Managed Postgres com backups diários"],
            ["Autenticação", "Supabase Auth", "JWT com GoTrue, refresh automático"],
            ["Storage", "Supabase Storage + Cloudflare R2", "Arquivos grandes em R2, thumbnails em Storage"],
            ["DNS", "Lovable Cloud", "SSL automático, custom domain opcional"],
          ],
        },
      },
      {
        heading: "Pipeline de Build",
        code: `1. Push no repositório (ou edit no Lovable)
2. Vite build (TypeScript → JavaScript, tree-shaking, code-splitting)
3. Edge Functions deploy automático (Deno bundle)
4. Migrações SQL aplicadas automaticamente
5. Preview URL atualizada em ~30s
6. Publish → domínio personalizado`,
      },
      {
        heading: "Migrações SQL",
        list: [
          "Armazenadas em `supabase/migrations/` (read-only via Lovable)",
          "Executadas em ordem cronológica via timestamp",
          "Nunca incluem ALTER DATABASE (não permitido)",
          "Triggers de validação em vez de CHECK constraints (imutabilidade)",
          "Nunca modificam schemas reservados (auth, storage, realtime, vault)",
        ],
      },
      {
        heading: "Monitoramento",
        list: [
          "**Error Reports**: Tabela `error_reports` com captura automática (useErrorReporter)",
          "**Composio Logs**: `composio_action_logs` com latência e status por ação",
          "**Webhook Events**: `webhook_events` com payload, status e retry",
          "**Email Logs**: `email_send_log` com status de entrega",
          "**Activity Logs**: `user_activity_logs` para auditoria de uso",
          "**Admin Panel**: Dashboard centralizado com métricas em tempo real",
        ],
      },
    ],
  },
  {
    id: "glossary",
    title: "Glossário",
    icon: BookOpen,
    color: "text-gray-400",
    content: [
      {
        heading: "Termos do Sistema",
        table: {
          headers: ["Termo", "Definição"],
          rows: [
            ["Pandora", "Assistente de IA do DESH, opera em chat, WhatsApp e MCP"],
            ["entityId", "Identificador composto userId_workspaceId para isolamento Composio"],
            ["Composio", "Plataforma de integração que centraliza OAuth e ações de APIs externas"],
            ["MCP", "Model Context Protocol — protocolo para ferramentas nativas de IA"],
            ["Tool Worker", "Edge function que executa ferramentas AI pesadas de forma assíncrona"],
            ["Créditos", "Unidade de consumo pay-per-use (cada ação custa X créditos)"],
            ["Workspace", "Espaço isolado de dados do usuário (suporta multi-workspace)"],
            ["RLS", "Row Level Security — políticas de acesso a nível de linha no Postgres"],
            ["Glass Card", "Componente UI com efeito glassmorphism (blur + transparência)"],
            ["Edge Function", "Função serverless em Deno executada no edge (Supabase)"],
            ["SERP", "Search Engine Results Page — resultados de busca via SerpAPI"],
            ["Pluggy", "Provedor de Open Finance para sync bancário no Brasil"],
            ["Zernio", "Provedor da API WhatsApp Business"],
            ["Late.so", "Plataforma de social inbox (comentários e mensagens de redes sociais)"],
            ["R2", "Cloudflare R2 — object storage compatível com S3"],
            ["TipTap", "Editor rich-text usado nas notas (extensível, baseado em ProseMirror)"],
            ["Lovable AI Gateway", "Proxy unificado para múltiplos modelos de IA sem API keys individuais"],
            ["Friend Code", "Código único de 8 caracteres para adicionar amigos no sistema"],
            
            ["Smart Folder", "Pasta inteligente que agrupa arquivos automaticamente por regras"],
            ["Deep Research", "Pesquisa profunda multi-fonte com raciocínio avançado (25 créditos)"],
            ["Morning Briefing", "Resumo matinal automático com agenda, tarefas e insights"],
          ],
        },
      },
      {
        heading: "Siglas",
        table: {
          headers: ["Sigla", "Significado"],
          rows: [
            ["RPC", "Remote Procedure Call (funções Postgres chamáveis via API)"],
            ["RLS", "Row Level Security"],
            ["JWT", "JSON Web Token (autenticação)"],
            ["OCR", "Optical Character Recognition (extração de texto de imagens)"],
            ["TTS", "Text-to-Speech (conversão de texto em áudio)"],
            ["PWA", "Progressive Web App"],
            ["SSE", "Server-Sent Events (streaming unidirecional)"],
            ["CRUD", "Create, Read, Update, Delete"],
            ["CRM", "Customer Relationship Management"],
            ["CDN", "Content Delivery Network"],
          ],
        },
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

const RenderBlock = ({ block }: { block: DocBlock }) => (
  <div className="space-y-2">
    {block.heading && (
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mt-4 first:mt-0">
        <ChevronRight className="w-3.5 h-3.5 text-primary" />
        {block.heading}
      </h4>
    )}
    {block.text && (
      <p
        className="text-xs text-muted-foreground leading-relaxed pl-5"
        dangerouslySetInnerHTML={{
          __html: block.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>'),
        }}
      />
    )}
    {block.list && (
      <ul className="space-y-1 pl-5">
        {block.list.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span
              dangerouslySetInnerHTML={{
                __html: item.replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong class="text-foreground font-semibold">$1</strong>'
                ).replace(
                  /`(.*?)`/g,
                  '<code class="bg-muted px-1 py-0.5 rounded text-[10px] font-mono text-foreground">$1</code>'
                ),
              }}
            />
          </li>
        ))}
      </ul>
    )}
    {block.table && (
      <div className="overflow-x-auto pl-5">
        <table className="w-full text-xs border-collapse rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-primary/10">
              {block.table.headers.map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-semibold text-foreground border-b border-border/30">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-muted-foreground border-b border-border/10">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {block.code && (
      <pre className="bg-muted/50 rounded-lg p-3 ml-5 overflow-x-auto text-[10px] font-mono text-foreground leading-relaxed border border-border/20">
        {block.code}
      </pre>
    )}
    {block.note && (
      <div className="ml-5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300">
        ⚠️ {block.note}
      </div>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

const SystemDocsTab = () => {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(() => {
    const text = sections.map(s => {
      const lines = [`# ${s.title}\n`];
      s.content.forEach(b => {
        if (b.heading) lines.push(`## ${b.heading}`);
        if (b.text) lines.push(b.text.replace(/\*\*/g, ""));
        if (b.list) b.list.forEach(l => lines.push(`- ${l.replace(/\*\*/g, "").replace(/`/g, "")}`));
        if (b.table) {
          lines.push(b.table.headers.join(" | "));
          b.table.rows.forEach(r => lines.push(r.join(" | ")));
        }
        if (b.code) lines.push(b.code);
        lines.push("");
      });
      return lines.join("\n");
    }).join("\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) return sections;
    const term = searchTerm.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.content.some(
          (b) =>
            b.heading?.toLowerCase().includes(term) ||
            b.text?.toLowerCase().includes(term) ||
            b.list?.some((l) => l.toLowerCase().includes(term)) ||
            b.table?.rows.some((r) => r.some((c) => c.toLowerCase().includes(term)))
        )
    );
  }, [searchTerm]);

  const currentSection = filteredSections.find((s) => s.id === activeSection) || filteredSections[0];

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* Sidebar */}
      <div className="w-56 shrink-0 space-y-2">
        <div className="glass-card rounded-xl p-2 flex gap-1">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar na documentação..."
            className="flex-1 bg-white/[0.06] rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 border border-border/20"
          />
          <button
            onClick={handleCopyAll}
            title="Copiar toda a documentação"
            className="shrink-0 p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <nav className="glass-card rounded-xl p-1.5 space-y-0.5 max-h-[calc(100vh-280px)] overflow-y-auto">
          {filteredSections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                  activeSection === s.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${activeSection === s.id ? "text-primary" : s.color}`} />
                {s.title}
              </button>
            );
          })}
        </nav>
        <div className="glass-card rounded-xl p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Estatísticas</p>
          <div className="text-xs text-foreground space-y-0.5">
            <p>📄 {sections.length} seções</p>
            <p>🔧 68 edge functions</p>
            <p>📦 54 módulos _shared</p>
            <p>🪝 145+ hooks</p>
            <p>📑 43 páginas</p>
            <p>📊 60+ tabelas DB</p>
            <p>🔌 16 toolkits Composio</p>
            <p>🤖 124+ ferramentas AI</p>
            <p>🧠 8 modelos AI</p>
            <p>🔑 17+ secrets</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 glass-card rounded-2xl p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
        {currentSection ? (
          <div>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/20">
              <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center`}>
                <currentSection.icon className={`w-5 h-5 ${currentSection.color}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground">{currentSection.title}</h2>
                <p className="text-[10px] text-muted-foreground">
                  {APP_NAME} v{APP_VERSION} — Seção {filteredSections.indexOf(currentSection) + 1} de {filteredSections.length}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg">
                {currentSection.content.length} blocos
              </span>
            </div>
            <div className="space-y-4">
              {currentSection.content.map((block, i) => (
                <RenderBlock key={i} block={block} />
              ))}
            </div>

            {/* Prev/Next navigation */}
            {(() => {
              const idx = filteredSections.indexOf(currentSection);
              const prev = idx > 0 ? filteredSections[idx - 1] : null;
              const next = idx < filteredSections.length - 1 ? filteredSections[idx + 1] : null;
              return (
                <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/20">
                  {prev ? (
                    <button
                      onClick={() => setActiveSection(prev.id)}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                      {prev.title}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button
                      onClick={() => setActiveSection(next.id)}
                      className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      {next.title}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : <div />}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma seção encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemDocsTab;
