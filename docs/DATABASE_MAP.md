# 🗄️ DESH — Mapa Completo do Banco de Dados

> **Gerado em:** 2026-03-29  
> **Objetivo:** Fonte única de verdade para auditoria e refatoração.  
> **Total de tabelas:** 108  

---

## Índice

1. [Legenda](#legenda)
2. [IA & Pandora](#ia--pandora)
3. [Tarefas & Notas](#tarefas--notas)
4. [Contatos](#contatos)
5. [E-mail / Gmail](#e-mail--gmail)
6. [Calendário](#calendário)
7. [WhatsApp](#whatsapp)
8. [Finanças (Manual)](#finanças-manual)
9. [Finanças (Pluggy / Open Finance)](#finanças-pluggy--open-finance)
10. [Arquivos](#arquivos)
11. [Automações](#automações)
12. [Social Media](#social-media)
13. [Gamificação & Social](#gamificação--social)
14. [Workspaces & Compartilhamento](#workspaces--compartilhamento)
15. [Billing & Créditos](#billing--créditos)
16. [Admin & Logs](#admin--logs)
17. [Auth & Perfis](#auth--perfis)
18. [Integrações & Composio](#integrações--composio)
19. [CMS & Público](#cms--público)
20. [Busca & SERP](#busca--serp)
21. [Notificações & Comunicação](#notificações--comunicação)
22. [Diversos](#diversos)
23. [⚠️ PROBLEMAS ENCONTRADOS](#️-problemas-encontrados)

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| 🔒 | RLS ativa |
| ⚠️ | Sem triggers (pode indicar falta de `updated_at` automático) |
| 📝 | INSERT |
| ✏️ | UPDATE |
| 🗑️ | DELETE |
| 👁️ | SELECT |
| **EF:** | Edge Function |
| **Hook:** | React Hook |
| **Comp:** | React Component |
| **RPC:** | Database Function / RPC |
| **Trigger:** | DB Trigger |

---

## IA & Pandora

### `ai_agents` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAIAgents (📝✏️🗑️) |
| **Lê** | **Hook:** useAIAgents (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Apenas 1 fonte de escrita — limpo. |

### `ai_conversations` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAIConversations (📝✏️🗑️) |
| **Lê** | **Hook:** useAIConversations (👁️), **Comp:** AIPage |
| **Índices** | `id` (PK), `user_id`, `(user_id, updated_at DESC)` |
| **Observações** | Bem isolado. Coluna `messages` é JSON array — pode crescer indefinidamente. |

### `ai_memories` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAIToolExecution (📝🗑️), **EF:** pandora-whatsapp (📝🗑️), **Comp:** ContextPanel (🗑️) |
| **Lê** | **EF:** pandora-mcp, pandora-whatsapp, **Hook:** useAIToolExecution, **Comp:** AIPage, ContextPanel |
| **Índices** | `id` (PK), `user_id`, `(user_id, category)` ×2 (duplicado!) |
| **Observações** | ⚠️ Índice `idx_ai_memories_category` e `idx_ai_memories_user_cat` são idênticos — remover um. 3 fontes de escrita. |

### `ai_knowledge_base` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | Nenhuma referência direta encontrada no código |
| **Lê** | Nenhuma referência direta encontrada no código |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ **Tabela aparentemente não utilizada no código.** Pode ser acessada via RPCs não mapeadas ou planejada para uso futuro. |

### `ai_insights` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** ai-proactive-insights (📝), _shared/serp-monitor-handler (📝) |
| **Lê** | **Hook:** useProactiveInsights (👁️✏️), **Comp/Context:** NotificationsContext (👁️) |
| **Índices** | `id` (PK), `(user_id, dismissed, expires_at)` |
| **Observações** | Escrita por EFs, leitura/dismiss no frontend. |

### `ai_projects` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAIProjects (📝✏️🗑️) |
| **Lê** | **Hook:** useAIProjects (👁️), smartCommandsData (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo, 1 fonte de escrita. |

### `tool_jobs` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** tool-worker (✏️), **Hook:** useToolJobQueue (📝), **Trigger:** dispatch_tool_job (lê e invoca EF) |
| **Lê** | **EF:** tool-worker (👁️), **Hook:** useToolJobQueue (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Trigger `dispatch_tool_job` auto-invoca tool-worker via HTTP. |

### `pandora_processing_locks` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** pandora-whatsapp (📝🗑️), whatsapp-web-proxy (📝🗑️) |
| **Lê** | **EF:** whatsapp-web-proxy (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Locks efêmeros, limpados por `cleanup_pandora_locks()` RPC e `run_db_maintenance()`. |

### `pandora_interaction_logs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** pandora-mcp (📝), pandora-whatsapp (📝) |
| **Lê** | **EF:** pandora-mcp (👁️), pandora-whatsapp (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Apenas EFs escrevem/lêem. Limpado por `run_db_maintenance()` (>60 dias). |

---

## Tarefas & Notas

### `tasks` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbTasks, useAIToolExecution (📝✏️🗑️), **Comp:** QuickAddPopup, ContactExportModal, DashboardContext (📝), **EF:** demo-seed, pandora-whatsapp (📝✏️🗑️) |
| **Lê** | **Hook:** useAIToolExecution, useDbTasks, **Comp:** CommandPalette, DailySummaryWidget, DeshLinkPicker, DashboardContext, **EF:** ai-proactive-insights, _shared/widget-briefing-handler, _shared/ai-files, pandora-whatsapp, send-notification-email |
| **Índices** | `id` (PK), `user_id`, `(user_id, workspace_id)`, `(user_id, status)` |
| **Observações** | ⚠️ **6+ fontes de escrita** — alto risco de inconsistência. |

### `task_subtasks` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbTasks (📝✏️🗑️) |
| **Lê** | **Hook:** useDbTasks (👁️) |
| **Índices** | `id` (PK), `task_id` |
| **Observações** | Limpo, 1 fonte de escrita. |

### `user_data` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAIToolExecution (📝✏️), **Comp:** ProfileWidget, CalendarPage, HabitsPage, NoteEditor + muitos (📝✏️🗑️), **EF:** demo-seed, tool-worker, pandora-whatsapp, _shared/gmail-watch-handler |
| **Lê** | **Hook/Comp:** ~20+ componentes e hooks, **EF:** pandora-mcp, pandora-whatsapp, ai-proactive-insights, _shared/* |
| **Índices** | `id` (PK), `user_id`, `(user_id, data_type)` |
| **Observações** | ⚠️ **Tabela "coringa"** — armazena notes, calendar, habits, profile_extended, focus_timer, pomodoro, bookmarks e muito mais via `data_type`. **10+ fontes de escrita.** Principal candidata a decomposição. |

---

## Contatos

### `contacts` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbContacts (📝✏️🗑️), useAIToolExecution (📝✏️🗑️), **Comp:** QuickAddPopup (📝), **EF:** pandora-whatsapp (📝✏️🗑️), whatsapp-web-proxy (✏️), demo-seed (📝🗑️) |
| **Lê** | **Hook:** useDbContacts, useAIToolExecution, **Comp:** CommandPalette, MessagesWidget, DeshLinkPicker, MentionExtension, **EF:** pandora-whatsapp, tool-worker, ai-proactive-insights, _shared/ai-files, whatsapp-web-proxy |
| **Índices** | `id` (PK), `user_id`, `contact_type`, `google_resource_name` (partial), `(user_id, workspace_id)` |
| **Observações** | ⚠️ **6+ fontes de escrita.** Campo `email` (singular) coexiste com `emails` (JSON array) — dados duplicados. Mesmo para `phone` vs `phones`. |

### `contact_interactions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbContacts (📝🗑️), **EF:** pandora-whatsapp (📝), tool-worker (📝) |
| **Lê** | **Hook:** useDbContacts (👁️), **EF:** pandora-whatsapp (👁️) |
| **Índices** | `id` (PK), `user_id`, `(contact_id, interaction_date DESC)` |
| **Observações** | 3 fontes de escrita. |

---

## E-mail / Gmail

### `gmail_messages_cache` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/gmail-sync-handler (📝✏️ — bulk upsert), gmail-webhook (📝✏️) |
| **Lê** | **EF:** tool-worker (👁️), pandora-whatsapp (👁️), **Hook:** useGmailSync (👁️ via EF) |
| **Índices** | `id` (PK), `(user_id, gmail_id)` UNIQUE, `(user_id, internal_date DESC)`, `(user_id, is_unread)` |
| **Observações** | Escrita apenas por EFs (sync). Frontend lê via hooks que chamam EFs. |

### `gmail_sync_state` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/gmail-sync-handler (✏️), gmail-webhook (✏️) |
| **Lê** | **EF:** _shared/gmail-sync-handler (👁️), gmail-webhook (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Apenas EFs. Controla paginação e historyId do sync. |

### `gmail_labels_cache` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | Nenhuma referência encontrada no código |
| **Lê** | Nenhuma referência encontrada no código |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ **Tabela aparentemente não utilizada.** |

### `emails_cache` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/composio-gmail-handler (📝✏️) |
| **Lê** | **Hook:** useGmailSync (👁️ — 4 refs no frontend), **EF:** composio-gmail-handler (👁️) |
| **Índices** | `id` (PK), `(user_id, gmail_id)` UNIQUE |
| **Observações** | Cache Composio-based — coexiste com `gmail_messages_cache`. ⚠️ **Dados possivelmente duplicados entre as duas tabelas de cache.** |

### `email_snoozes` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useEmailSnooze (📝✏️) |
| **Lê** | **Hook:** useEmailSnooze (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()`. |

### `email_cleanup_sessions` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useEmailCleanup (📝✏️) |
| **Lê** | **Hook:** useEmailCleanup (👁️), **Comp:** EmailCleanupPanel (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

### `email_rate_limits` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** send-notification-email (📝✏️) |
| **Lê** | **EF:** send-notification-email (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()` (>24h). Apenas EFs. |

### `email_send_log` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** send-notification-email (📝) |
| **Lê** | **RPC:** admin_get_email_stats (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Append-only log. |

### `email_automations` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** EmailNotificationsTab (📝✏️) |
| **Lê** | **Comp:** EmailNotificationsTab (👁️), **EF:** send-notification-email (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Admin-only. |

### `email_templates` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** EmailNotificationsTab (📝✏️) |
| **Lê** | **Comp:** EmailNotificationsTab (👁️), **EF:** send-notification-email (👁️) |
| **Índices** | `id` (PK), `slug` UNIQUE |
| **Observações** | Admin-only. |

---

## Calendário

### `calendar_events_cache` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** composio-webhook (📝 via upsert), _shared/composio-calendar-handler (📝✏️) |
| **Lê** | **Hook:** useCalendarEventsCache (👁️), **Comp:** CalendarPage (👁️) |
| **Índices** | `id` (PK), `(user_id, event_id)` UNIQUE, `(user_id, start_at DESC)` |
| **Observações** | Limpo — EFs escrevem, frontend lê. |

---

## WhatsApp

### `whatsapp_connections` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useWhatsappConnections (📝✏️🗑️), **Comp:** PrivacySection (🗑️) |
| **Lê** | **Hook:** useWhatsappConnections (👁️), **EF:** whatsapp-proxy, whatsapp-webhook |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | WhatsApp Business (Meta API). |

### `whatsapp_conversations` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-webhook (📝✏️), whatsapp-web-proxy (📝✏️), whatsapp-gateway-callback (📝✏️), whatsapp-proxy (📝) |
| **Lê** | **EF:** whatsapp-web-proxy (👁️), pandora-whatsapp (👁️), whatsapp-gateway-callback (👁️), **Hook:** useWhatsappConversations (👁️) |
| **Índices** | `id` (PK), `(user_id, contact_phone)`, `(user_id, last_message_at DESC)` |
| **Observações** | ⚠️ **4+ fontes de escrita** entre EFs de diferentes canais (Web, Business, Gateway). |

### `whatsapp_messages` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-webhook (📝), whatsapp-web-proxy (📝✏️), whatsapp-proxy (📝), pandora-whatsapp (📝), whatsapp-gateway-callback (📝) |
| **Lê** | **EF:** whatsapp-web-proxy (👁️), pandora-whatsapp (👁️), **Hook:** useWhatsappMessages (👁️), **RPC:** get_last_messages |
| **Índices** | `id` (PK), `conversation_id`, `(conversation_id, sent_at DESC)` |
| **Observações** | ⚠️ **5 fontes de escrita.** Maior risco de duplicação de mensagens. |

### `whatsapp_web_sessions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-web-proxy (📝✏️), whatsapp-gateway-callback (✏️), **Hook:** useWhatsappWebSessions (📝✏️🗑️) |
| **Lê** | **EF:** whatsapp-web-proxy (👁️), whatsapp-gateway-callback (👁️), **Hook:** useWhatsappWebSessions (👁️) |
| **Índices** | `id` (PK), `(user_id, session_id)` |
| **Observações** | Expirada por RPC `expire_inactive_whatsapp_sessions()`. |

### `whatsapp_ai_settings` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook/Comp:** WhatsApp settings UI (✏️) |
| **Lê** | **EF:** chat, pandora-whatsapp, whatsapp-web-proxy (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Configurações de modelo IA por usuário. |

### `whatsapp_sync_jobs` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-web-proxy (📝✏️) |
| **Lê** | **EF:** whatsapp-web-proxy (👁️), **Hook:** useWhatsappSync (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Apenas EF whatsapp-web-proxy escreve. |

### `whatsapp_presence` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-web-proxy (📝✏️) |
| **Lê** | **Hook:** useWhatsappPresence (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Dados efêmeros de presença. |

### `whatsapp_session_logs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-web-proxy (📝) |
| **Lê** | Nenhuma referência no frontend |
| **Índices** | `id` (PK) |
| **Observações** | Log-only, limpado por `run_db_maintenance()` (>30 dias). |

### `whatsapp_web_session_logs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** whatsapp-web-proxy (📝) |
| **Lê** | Nenhuma referência no frontend |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ **Parece duplicar** `whatsapp_session_logs`. Ambos são limpados por `run_db_maintenance()`. |

---

## Finanças (Manual)

### `finance_transactions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbFinances (📝✏️🗑️), useAIToolExecution (📝🗑️✏️), **Comp:** QuickAddPopup (📝), **EF:** pandora-whatsapp (📝), _shared/ai-finance (✏️), demo-seed (📝🗑️) |
| **Lê** | **Hook:** useDbFinances, useAIToolExecution, useAnalytics, **Comp:** DailySummaryWidget, **EF:** ai-proactive-insights, _shared/widget-briefing-handler, _shared/ai-files, pandora-whatsapp |
| **Índices** | `id` (PK), `user_id`, `(user_id, date DESC)`, `(user_id, workspace_id)` |
| **Observações** | ⚠️ **6+ fontes de escrita.** Coexiste com `financial_transactions_unified` (Pluggy). |

### `finance_budgets` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbFinances (📝✏️🗑️), useAIToolExecution (📝🗑️✏️), **EF:** pandora-whatsapp (📝) |
| **Lê** | **Hook:** useDbFinances, useAIToolExecution, **EF:** ai-proactive-insights, pandora-whatsapp |
| **Índices** | `id` (PK), `(user_id, category)` |
| **Observações** | 3 fontes de escrita. |

### `finance_goals` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbFinances (📝✏️🗑️), useAIToolExecution (📝✏️), **EF:** pandora-whatsapp (📝✏️), demo-seed (📝🗑️) |
| **Lê** | **Hook:** useDbFinances, useAIToolExecution, **Comp:** DeshLinkPicker, **EF:** ai-proactive-insights, _shared/widget-briefing-handler, pandora-whatsapp |
| **Índices** | `id` (PK), `user_id`, `(user_id, workspace_id)` |
| **Observações** | ⚠️ **4+ fontes de escrita.** |

### `finance_recurring` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useDbFinances (📝✏️🗑️), useAIToolExecution (📝🗑️✏️), **EF:** pandora-whatsapp (📝🗑️✏️) |
| **Lê** | **Hook:** useDbFinances, useAIToolExecution, **EF:** pandora-whatsapp |
| **Índices** | `id` (PK), `user_id`, `(user_id, workspace_id)` |
| **Observações** | 3 fontes de escrita. |

---

## Finanças (Pluggy / Open Finance)

### `financial_connections` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** sync-financial-data (📝✏️), financial-webhook (✏️), **Hook:** useFinance (📝✏️🗑️) |
| **Lê** | **Hook:** useFinance (👁️), **EF:** sync-financial-data (👁️), financial-webhook (👁️) |
| **Índices** | `id` (PK), `user_id`, `(user_id, provider_item_id)` UNIQUE |
| **Observações** | Conexões Pluggy/Open Finance. |

### `financial_accounts` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** sync-financial-data (📝✏️), financial-webhook (✏️) |
| **Lê** | **Hook:** useFinance (👁️), useAIToolExecution (👁️) |
| **Índices** | `id` (PK), `user_id`, `(user_id, provider_account_id)` UNIQUE |
| **Observações** | Limpo. |

### `financial_transactions_unified` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** sync-financial-data (📝), financial-webhook (📝✏️), _shared/pluggy-enrich-handler (✏️) |
| **Lê** | **Hook:** useFinance (👁️), useAIToolExecution (👁️), **EF:** _shared/pluggy-enrich-handler (👁️) |
| **Índices** | `id` (PK), `(user_id, provider_transaction_id)` UNIQUE, `(user_id, date DESC)` |
| **Observações** | Transações Pluggy. Coexiste com `finance_transactions` (manual). |

### `financial_investments` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** sync-financial-data (📝✏️) |
| **Lê** | **Hook:** useFinance (👁️), useAIToolExecution (👁️), useFinanceExtended (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `financial_loans` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** sync-financial-data (📝✏️) |
| **Lê** | **Hook:** useFinanceExtended (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `financial_investment_transactions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | Nenhuma referência de escrita encontrada |
| **Lê** | **Hook:** useFinanceExtended (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ Lida mas nunca escrita diretamente — pode ser populada por trigger ou processo não mapeado. |

### `financial_insights` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/pluggy-insights-handler (📝✏️) |
| **Lê** | **Hook:** usePluggyInsights (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `financial_payment_recipients` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/pluggy-payments-handler (📝✏️) |
| **Lê** | **EF:** _shared/pluggy-payments-handler (👁️), **Hook:** usePluggyPayments (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `financial_payment_requests` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/pluggy-payments-handler (📝✏️), financial-webhook (✏️) |
| **Lê** | **EF:** financial-webhook (👁️), _shared/pluggy-payments-handler (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `financial_payment_intents` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** financial-webhook (📝✏️) |
| **Lê** | Nenhuma referência de leitura direta |
| **Índices** | `id` (PK) |
| **Observações** | Escrita apenas pelo webhook. |

### `financial_scheduled_payments` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** financial-webhook (📝✏️) |
| **Lê** | Nenhuma referência de leitura direta |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ Escrita mas nunca lida diretamente — pode estar sem UI. |

### `financial_sync_logs` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** sync-financial-data (📝) |
| **Lê** | **Hook:** useFinance (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()` (>30 dias). |

### `financial_webhook_logs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** financial-webhook (📝) |
| **Lê** | Nenhuma referência direta |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()` (>30 dias). Log-only. |

---

## Arquivos

### `files` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useFileManager (📝✏️🗑️), **EF:** _shared/ai-files (📝✏️), composio-drive-handler, file-process (✏️) |
| **Lê** | **Hook:** useFileManager (👁️), **EF:** _shared/ai-files (👁️), **RPC:** get_file_storage_stats |
| **Índices** | `id` (PK), `user_id`, `folder_id`, `(user_id, is_trashed)`, `content_hash`, `(user_id, workspace_id)` |
| **Observações** | ⚠️ **4+ fontes de escrita.** Trigger `set_file_extension` auto-seta extensão. |

### `file_folders` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useFileManager (📝✏️🗑️), **EF:** _shared/ai-files (📝) |
| **Lê** | **Hook:** useFileManager (👁️), **Comp:** FileExplorer (👁️) |
| **Índices** | `id` (PK), `user_id`, `parent_id`, `(user_id, workspace_id)` |
| **Observações** | Limpo. |

### `file_links` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useFileLinks (📝🗑️), **EF:** _shared/ai-files (📝) |
| **Lê** | **Hook:** useFileLinks (👁️), **Comp:** FileLinksPanel (👁️) |
| **Índices** | `id` (PK), `file_id`, `(entity_type, entity_id)` |
| **Observações** | Limpo. |

### `file_inbox` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/ai-files (📝✏️), file-inbox-receive (📝) |
| **Lê** | **Hook:** useFileInbox (👁️), **EF:** _shared/ai-files (👁️) |
| **Índices** | `id` (PK), `user_id`, `status` |
| **Observações** | Limpo. |

### `file_share_links` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useFileShareLinks (📝✏️🗑️) |
| **Lê** | **Hook:** useFileShareLinks (👁️), **EF:** file-share-access (👁️) |
| **Índices** | `id` (PK), `token` UNIQUE, `file_id` |
| **Observações** | Limpo. |

### `user_files` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useUserFiles (📝✏️🗑️) |
| **Lê** | **Hook:** useUserFiles (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | ⚠️ **Possível duplicação** com tabela `files`. Verificar se ambas são necessárias. |

### `user_folders` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useUserFiles (📝✏️🗑️) |
| **Lê** | **Hook:** useUserFiles (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | ⚠️ **Possível duplicação** com tabela `file_folders`. |

---

## Automações

### `automation_rules` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAutomations (📝✏️🗑️), useAIToolExecution (📝✏️🗑️), useAutomationEngine (✏️) |
| **Lê** | **Hook:** useAutomations (👁️), useAutomationEngine (👁️), useAIToolExecution (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | 3 fontes de escrita. |

### `automation_logs` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useAutomationEngine (📝) |
| **Lê** | **Hook:** useAutomations (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

---

## Social Media

### `social_accounts` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSocialAccounts (📝✏️🗑️) |
| **Lê** | **Hook:** useSocialAccounts (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `social_posts` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSocialPosts (📝✏️🗑️) |
| **Lê** | **Hook:** useSocialPosts (👁️) |
| **Índices** | `id` (PK), `user_id`, `(user_id, scheduled_for)` |
| **Observações** | Limpo. |

### `social_profiles` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSocialProfiles (📝✏️🗑️) |
| **Lê** | **Hook:** useSocialProfiles (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `social_templates` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSocialTemplates (📝✏️🗑️) |
| **Lê** | **Hook:** useSocialTemplates (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

### `social_competitors` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSocialCompetitors (📝✏️🗑️) |
| **Lê** | **Hook:** useSocialCompetitors (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `social_brand_profiles` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSocialBrandProfile (📝✏️) |
| **Lê** | **Hook:** useSocialBrandProfile (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `social_subscriptions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** social-subscription (📝✏️) |
| **Lê** | **Hook:** useSocialSubscription (👁️), **EF:** social-subscription (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

---

## Gamificação & Social

### `gamification_state` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useGamification (✏️), **EF:** (via trigger) |
| **Lê** | **Hook:** useGamification (👁️), **RPC:** admin_get_user_details |
| **Índices** | `id` (PK), `user_id` UNIQUE |
| **Observações** | Limpo. |

### `xp_log` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useGamification (📝) |
| **Lê** | **Hook:** useGamification (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Append-only. |

### `friend_requests` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** send_friend_request (📝), accept_friend_request (✏️), reject_friend_request (✏️), cancel_friend_request (🗑️) |
| **Lê** | **Hook:** useFriends (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Toda escrita via RPCs seguras — bom padrão. |

### `friendships` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** accept_friend_request (📝), remove_friend (🗑️) |
| **Lê** | **Hook:** useFriends (👁️), RPCs diversas |
| **Índices** | `id` (PK), `(user_id, friend_id)` UNIQUE |
| **Observações** | Trigger `cascade_revoke_shares_on_unfriend` ao deletar. |

### `coop_missions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useCoopMissions (📝✏️) |
| **Lê** | **Hook:** useCoopMissions (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

### `coop_mission_members` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** accept_mission_invite (📝), **Hook:** useCoopMissions (✏️) |
| **Lê** | **Hook:** useCoopMissions (👁️) |
| **Índices** | `id` (PK), `mission_id` |
| **Observações** | Limpo. |

### `coop_mission_invites` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useCoopMissions (📝✏️) |
| **Lê** | **Hook:** useCoopMissions (👁️) |
| **Índices** | `id` (PK), `mission_id` |
| **Observações** | Limpo. |

---

## Workspaces & Compartilhamento

### `workspaces` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Context:** WorkspaceContext (📝✏️🗑️), **Trigger:** handle_new_user_workspace (📝), **RPC:** ensure_default_workspace (📝), **EF:** demo-seed (📝🗑️) |
| **Lê** | **Context:** WorkspaceContext (👁️), **Hook:** useWorkspaceShares, useAIToolExecution, **EF:** pandora-mcp, _shared/composio-client, _shared/gmail-* |
| **Índices** | `id` (PK), `user_id`, `(user_id, is_default)` |
| **Observações** | ⚠️ **4+ fontes de escrita** (incluindo triggers/RPCs). Auto-criado ao registrar usuário. |

### `workspace_shares` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** create_workspace_share, accept/reject/revoke/delete_workspace_share, update_workspace_share_* |
| **Lê** | **Hook:** useWorkspaceShares (👁️), **RPC:** get_shared_workspace_data |
| **Índices** | `id` (PK), `owner_id`, `shared_with` |
| **Observações** | Toda escrita via RPCs SECURITY DEFINER — excelente padrão. |

### `widget_shares` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useWidgetShares (📝), **RPC:** accept/reject/revoke/delete_widget_share, update_widget_share_permission |
| **Lê** | **Hook:** useWidgetShares (👁️), **RPC:** get_shared_widget_data |
| **Índices** | `id` (PK), `owner_id`, `shared_with` |
| **Observações** | Similar a workspace_shares — bom padrão. |

### `shared_themes` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSharedThemes (📝✏️🗑️) |
| **Lê** | **Hook:** useSharedThemes (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

---

## Billing & Créditos

### `user_credits` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** add_credits (✏️), handle_new_user_trial (📝), **EF:** stripe-webhook (via RPC) |
| **Lê** | **Hook:** useCredits (👁️), **EF:** consume-credits (👁️), **RPC:** admin_get_user_details |
| **Índices** | `id` (PK), `user_id` UNIQUE |
| **Observações** | Escrita centralizada via `add_credits()` RPC — bom. |

### `credit_transactions` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** add_credits (📝), **EF:** consume-credits (📝), handle_new_user_trial (📝) |
| **Lê** | **Hook:** useCredits (👁️), **RPC:** admin_get_user_details |
| **Índices** | `id` (PK) |
| **Observações** | Append-only log — bom. |

### `credit_packages` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/billing-details-handler (✏️ — sync Stripe), admin (📝✏️) |
| **Lê** | **Hook:** useCreditPackages (👁️), **EF:** stripe-webhook, consume-credits |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

### `billing_preferences` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useBillingPreferences (📝✏️) |
| **Lê** | **Hook:** useBillingPreferences (👁️) |
| **Índices** | `id` (PK), `user_id` UNIQUE |
| **Observações** | Limpo. |

### `coupons` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** admin CouponsTab (📝✏️🗑️), **RPC:** redeem_coupon (✏️), **EF:** stripe-webhook |
| **Lê** | **Comp:** admin CouponsTab (👁️), **RPC:** redeem_coupon |
| **Índices** | `id` (PK), `code` UNIQUE |
| **Observações** | Limpo. |

### `coupon_redemptions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** redeem_coupon (📝) |
| **Lê** | **RPC:** redeem_coupon (👁️) |
| **Índices** | `id` (PK), `(coupon_id, user_id)` UNIQUE |
| **Observações** | Limpo — toda lógica na RPC. |

### `user_subscriptions` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Trigger:** handle_new_user_trial (📝), **EF:** stripe-webhook (✏️) |
| **Lê** | **Hook:** useSubscription (👁️), **EF:** consume-credits (👁️), **RPC:** admin_get_user_details |
| **Índices** | `id` (PK), `user_id` UNIQUE |
| **Observações** | Limpo. |

---

## Admin & Logs

### `admin_logs` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** stripe-webhook (📝), process-archived-users (📝), _shared/billing-details-handler (📝), whatsapp-web-proxy (📝), **Comp:** PrivacySection (📝), **Hook:** useAdminData (📝), **RPC:** admin_grant_credits, admin_unarchive_user |
| **Lê** | **Hook:** useAdminData (👁️), **RPC:** admin_get_user_details |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ **7+ fontes de escrita** — esperado para tabela de log admin. |

### `error_reports` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useErrorReporter (📝), **Comp:** admin ErrorReportsTab (✏️) |
| **Lê** | **Comp:** admin ErrorReportsTab (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()`. |

### `user_activity_logs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useActivityLog (📝) |
| **Lê** | **RPC:** admin_get_user_details |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()` (>90 dias). |

### `webhook_events` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** composio-webhook (📝), gmail-webhook (📝), whatsapp-webhook (📝) |
| **Lê** | **Comp:** admin WebhooksTab (👁️✏️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpado por `run_db_maintenance()` (>7 dias). |

### `gateway_api_key_logs` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** gateway-proxy (📝) |
| **Lê** | Nenhuma referência no frontend |
| **Índices** | `id` (PK) |
| **Observações** | Log-only para uso da API gateway. |

---

## Auth & Perfis

### `profiles` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Trigger:** handle_new_user (📝), **Context:** AuthContext (✏️), **EF:** process-archived-users (✏️), **RPC:** admin_suspend/unsuspend/ban/unban/archive/unarchive_user |
| **Lê** | **Context:** AuthContext (👁️), **Hook:** useAdminData, **EF:** pandora-mcp, **RPC:** get_profiles_with_email, admin_get_pending_deletions |
| **Índices** | `id` (PK), `user_id` UNIQUE, `friend_code` UNIQUE |
| **Observações** | Trigger `safe_update_profile` protege campos admin de modificação por usuários normais. |

### `user_roles` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Trigger:** handle_new_user_role (📝), **RPC:** admin_set_user_role (✏️📝), admin_bulk_set_role (📝🗑️) |
| **Lê** | **RPC:** has_role (👁️ — usado em todas as policies admin) |
| **Índices** | `id` (PK), `(user_id, role)` UNIQUE |
| **Observações** | Arquitetura correta — roles em tabela separada com RPC `has_role()` SECURITY DEFINER. |

### `notification_preferences` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Trigger:** handle_new_user_notification_prefs (📝), **Hook:** useNotificationPreferences (✏️) |
| **Lê** | **Hook:** useNotificationPreferences (👁️), **EF:** send-notification-email |
| **Índices** | `id` (PK), `user_id` UNIQUE |
| **Observações** | Limpo. |

### `user_gateway_api_keys` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **RPC:** generate_gateway_api_key (📝), revoke_gateway_api_key (✏️) |
| **Lê** | **Hook:** useGatewayApiKeys (👁️), **EF:** gateway-proxy (👁️) |
| **Índices** | `id` (PK), `user_id`, `key_hash` UNIQUE |
| **Observações** | Limpo — RPCs SECURITY DEFINER. |

### `profile_documents` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | Nenhuma referência encontrada |
| **Lê** | Nenhuma referência encontrada |
| **Índices** | `id` (PK) |
| **Observações** | ⚠️ **Tabela aparentemente não utilizada.** |

---

## Integrações & Composio

### `connections` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useComposioConnections (📝✏️🗑️), **EF:** composio-connect (📝✏️) |
| **Lê** | **Hook:** useComposioConnections (👁️), **RPC:** admin_get_user_details |
| **Índices** | `id` (PK), `user_id`, `workspace_id` |
| **Observações** | Limpo. |

### `composio_user_emails` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** composio-connect (📝), composio-webhook (📝✏️) |
| **Lê** | **EF:** tool-worker (👁️), pandora-whatsapp (👁️), pandora-mcp (👁️), _shared/gmail-* (👁️) |
| **Índices** | `id` (PK), `(email, toolkit)` UNIQUE |
| **Observações** | Mapeamento email↔toolkit para verificar conexões. |

### `composio_action_logs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** composio-proxy (📝) |
| **Lê** | **Comp:** admin ComposioTab (👁️) |
| **Índices** | `id` (PK), `(user_id, created_at DESC)`, `(service, created_at DESC)`, `(action, created_at DESC)` |
| **Observações** | Limpado por `run_db_maintenance()` (>30 dias). Bons índices. |

### `_archived_google_connections` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | Nenhuma referência ativa |
| **Lê** | Nenhuma referência ativa |
| **Índices** | `id` (PK), `(user_id, google_user_id)` UNIQUE, `user_id`, `workspace_id` |
| **Observações** | ⚠️ **Tabela arquivada** — migrada de `google_connections` para Composio. Pode ser removida. |

### `platform_integrations` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** admin IntegrationsTab (📝✏️) |
| **Lê** | **Comp:** admin IntegrationsTab (👁️), IntegrationsPage (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Catálogo de integrações disponíveis. |

### `provider_settings` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useProviderSettings (📝✏️) |
| **Lê** | **Hook:** useProviderSettings (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

---

## CMS & Público

### `blog_posts` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** admin BlogTab (📝✏️🗑️) |
| **Lê** | **Comp:** admin BlogTab (👁️), **Lib:** blogApi (👁️) |
| **Índices** | `id` (PK), `slug` UNIQUE |
| **Observações** | Limpo — admin-only. |

### `changelogs` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** admin ChangelogsTab (📝✏️🗑️) |
| **Lê** | **Comp:** ChangelogPage (👁️) |
| **Índices** | `id` (PK), `(published_at DESC)` |
| **Observações** | Limpo. |

---

## Busca & SERP

### `search_history` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSearchHistory (📝✏️🗑️) |
| **Lê** | **Hook:** useSearchHistory (👁️) |
| **Índices** | `id` (PK), `user_id`, `(user_id, created_at DESC)` |
| **Observações** | Limpado por `run_db_maintenance()` (>90 dias, não favoritos). |

### `search_projects` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSearchProjects (📝✏️🗑️) |
| **Lê** | **Hook:** useSearchProjects (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `serp_monitors` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useSerpMonitors (📝✏️🗑️), **EF:** _shared/serp-monitor-handler (✏️) |
| **Lê** | **Hook:** useSerpMonitors (👁️), **EF:** _shared/serp-monitor-handler (👁️) |
| **Índices** | `id` (PK), `user_id` |
| **Observações** | Limpo. |

### `serp_monitor_results` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** _shared/serp-monitor-handler (📝) |
| **Lê** | **Hook:** useSerpMonitors (👁️) |
| **Índices** | `id` (PK), `monitor_id`, `(monitor_id, checked_at DESC)` |
| **Observações** | Limpo. |

---

## Notificações & Comunicação

### `broadcasts` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Comp:** admin BroadcastsTab (📝✏️🗑️) |
| **Lê** | **Comp:** admin BroadcastsTab (👁️), **Context:** NotificationsContext (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Admin-only para escrita. |

### `broadcast_dismissals` 🔒

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Context:** NotificationsContext (📝🗑️) |
| **Lê** | **Context:** NotificationsContext (👁️) |
| **Índices** | `id` (PK), `(broadcast_id, user_id)` UNIQUE |
| **Observações** | Limpo. |

### `quick_replies` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **Hook:** useQuickReplies (📝✏️🗑️) |
| **Lê** | **Hook:** useQuickReplies (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

### `unsubscribe_history` 🔒 ⚠️(sem trigger)

| Aspecto | Detalhes |
|---------|---------|
| **Escreve** | **EF:** unsubscribe (📝) |
| **Lê** | **Comp:** admin EmailNotificationsTab (👁️) |
| **Índices** | `id` (PK) |
| **Observações** | Limpo. |

---

## Diversos

Tabelas não cobertos nas seções acima:

| Tabela | RLS | Escreve | Lê | Observação |
|--------|-----|---------|-----|-----------|
| `quick_replies` | 🔒 | useQuickReplies | useQuickReplies | Limpo |

---

## ⚠️ PROBLEMAS ENCONTRADOS

### 1. Tabelas com 4+ fontes de escrita (risco de inconsistência)

| Tabela | Fontes de escrita | Risco |
|--------|------------------|-------|
| `user_data` | ~10+ (hooks, comps, EFs, pandora) | 🔴 CRÍTICO — tabela "coringa" |
| `tasks` | 6+ (hooks, comps, EFs, pandora) | 🔴 ALTO |
| `contacts` | 6+ (hooks, comps, EFs, pandora) | 🔴 ALTO |
| `finance_transactions` | 6+ (hooks, comps, EFs, pandora) | 🔴 ALTO |
| `whatsapp_messages` | 5 EFs diferentes | 🟡 MÉDIO |
| `whatsapp_conversations` | 4 EFs diferentes | 🟡 MÉDIO |
| `admin_logs` | 7+ (esperado para logs) | 🟢 OK |
| `workspaces` | 4+ (inclui triggers) | 🟡 MÉDIO |
| `finance_goals` | 4+ | 🟡 MÉDIO |
| `files` | 4+ | 🟡 MÉDIO |

### 2. Tabelas aparentemente não utilizadas

| Tabela | Observação |
|--------|-----------|
| `ai_knowledge_base` | Sem referência de leitura ou escrita no código |
| `gmail_labels_cache` | Sem referência no código |
| `profile_documents` | Sem referência no código |
| `_archived_google_connections` | Tabela legacy — migrada para Composio |
| `financial_investment_transactions` | Lida mas nunca escrita diretamente |
| `financial_scheduled_payments` | Escrita mas nunca lida |
| `financial_payment_intents` | Escrita mas nunca lida no frontend |

### 3. Dados duplicados entre tabelas

| Duplicação | Detalhes |
|-----------|---------|
| `emails_cache` vs `gmail_messages_cache` | Dois caches de email — um via Composio, outro via sync direto. Devem ser unificados. |
| `user_files` vs `files` | Dois sistemas de arquivos. `user_files` parece legacy. |
| `user_folders` vs `file_folders` | Dois sistemas de pastas. `user_folders` parece legacy. |
| `whatsapp_session_logs` vs `whatsapp_web_session_logs` | Dois logs de sessão WA — possivelmente unificáveis. |
| `contacts.email` vs `contacts.emails` | Campo singular e JSON array coexistem — dados potencialmente dessincronizados. |
| `contacts.phone` vs `contacts.phones` | Mesmo problema. |
| `finance_transactions` vs `financial_transactions_unified` | Transações manuais vs Pluggy — esperado mas pode confundir em relatórios. |

### 4. Índices duplicados

| Tabela | Índices duplicados |
|--------|-------------------|
| `ai_memories` | `idx_ai_memories_category` e `idx_ai_memories_user_cat` são idênticos em `(user_id, category)` |

### 5. Tabela `user_data` — principal dívida técnica

A tabela `user_data` é usada como armazenamento genérico para **12+ tipos de dados diferentes**:
- `notes`, `calendar`, `habits`, `profile_extended`, `focus_timer`, `pomodoro`, `bookmarks`, `goals`, `kanban_config`, `widget_config`, `theme`, `reading_list`, etc.

**Riscos:**
- Impossível criar índices eficientes por tipo
- RLS genérica sem granularidade
- Schema-less (coluna `data` é JSONB livre)
- 10+ fontes de escrita sem validação de schema

**Recomendação:** Decompor em tabelas dedicadas para os tipos mais usados (notes, calendar, habits).

### 6. Tabelas sem RLS mas com `rowsecurity = true`

Todas as 108 tabelas têm RLS **habilitada** (`rowsecurity = true`). ✅

> **Nota:** Ter RLS habilitada não garante que policies existam. Tabelas marcadas com ⚠️(sem trigger) podem ter policies permissivas. Verificar policies individuais é recomendado como próximo passo.

### 7. Próximos passos recomendados

1. **Auditar policies RLS** — verificar se cada tabela tem policies adequadas (não apenas `true`)
2. **Unificar caches de email** — `emails_cache` e `gmail_messages_cache`
3. **Remover tabelas não utilizadas** — `ai_knowledge_base`, `gmail_labels_cache`, `profile_documents`, `_archived_google_connections`
4. **Remover índice duplicado** — `idx_ai_memories_category` em `ai_memories`
5. **Decompor `user_data`** — tabelas dedicadas para notes, calendar, habits
6. **Unificar sistema de arquivos** — `user_files`/`user_folders` vs `files`/`file_folders`
7. **Centralizar escrita de `tasks`/`contacts`** — criar service layer ou RPCs

---

*Documento gerado automaticamente via auditoria de código. Última atualização: 2026-03-29.*
