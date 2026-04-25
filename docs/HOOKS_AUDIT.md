# 🪝 DESH — Auditoria de Hooks Customizados

> **Gerado em:** 2026-03-29  
> **Total de hooks:** 150  
> **Total de linhas:** ~24.500  
> **Hooks não utilizados:** 13  
> **Hooks com acesso direto ao Supabase:** 66  

---

## Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Hooks Não Utilizados](#-hooks-não-utilizados)
3. [AI / Pandora](#ai--pandora-7-hooks-3502l)
4. [Email](#email-16-hooks-3422l)
5. [WhatsApp](#whatsapp-11-hooks-2128l)
6. [Finance](#finance-7-hooks-1899l)
7. [Calendar](#calendar-5-hooks-1098l)
8. [Integrations](#integrations-11-hooks-1854l)
9. [Social Media](#social-media-13-hooks-1681l)
10. [Search](#search-7-hooks-1440l)
11. [Automations](#automations-2-hooks-1007l)
12. [Files](#files-4-hooks-958l)
13. [Media / Audio](#media--audio-6-hooks-943l)
14. [Notes](#notes-3-hooks-795l)
15. [Workspace](#workspace-4-hooks-694l)
16. [Contacts](#contacts-2-hooks-370l)
17. [Auth & Billing](#auth--billing-5-hooks-346l)
18. [Admin](#admin-2-hooks-140l)
19. [General / Utilities](#general--utilities-39-hooks-4519l)
20. [Social / Gamification](#social--gamification-1-hook-161l)
21. [UI Utilities](#ui-utilities-2-hooks-205l)
22. [Tabela de Consolidação](#-tabela-de-consolidação)
23. [Violações de Camada](#-violações-de-camada)
24. [Top 10 Maiores Hooks](#-top-10-maiores-hooks)

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Total de hooks | 150 |
| Hooks não utilizados (0 importers) | 13 (8.7%) |
| Hooks com 1 só importer | 52 (34.7%) |
| Hooks com acesso direto ao Supabase | 66 (44%) |
| Hook mais usado | `use-toast` (132 importers) |
| Hook mais extenso | `useAIToolExecution` (2.784 linhas) |
| Módulo mais fragmentado | Email (16 hooks) |

---

## ❌ Hooks Não Utilizados

Hooks com **zero importações** em todo o projeto:

| Hook | Linhas | Supabase Direto | Recomendação |
|------|--------|-----------------|-------------|
| `use-mobile` (.tsx) | 19 | ❌ | ⚠️ Verificar — pode estar importado como `use-mobile` vs `useMobile` |
| `useActivityLog` | 37 | ✅ | 🗑️ Remover — substituído ou nunca ativado |
| `useComposioGithub` | 102 | ❌ | 🗑️ Remover — integração GitHub nunca implementada |
| `useComposioNotion` | 87 | ❌ | 🗑️ Remover — integração Notion nunca implementada |
| `useComposioSlack` | 76 | ❌ | 🗑️ Remover — integração Slack nunca implementada |
| `useEmailPageState` | 243 | ❌ | 🗑️ Remover — substituído por state inline no EmailPage |
| `useFacebookSDK` | 69 | ❌ | 🗑️ Remover — SDK Facebook nunca ativado |
| `useGoogleConnection` | 27 | ❌ | 🗑️ Remover — legacy, migrado para useComposioConnection |
| `useGoogleNewDataNotifier` (.tsx) | 177 | ❌ | 🗑️ Remover — notificador que nunca foi integrado |
| `useMultiDriveData` | 133 | ❌ | 🗑️ Remover — multi-drive nunca ativado |
| `useTwitterEngagement` | 54 | ❌ | 🗑️ Remover — engagement Twitter nunca ativado |
| `useWhatsappConnections` | 111 | ✅ | ⚠️ Verificar — pode estar sendo usado via re-export |
| `useWidgetShares` | 197 | ✅ | ⚠️ Verificar — pode estar sendo usado em contexto não mapeado |

**Economia potencial: ~1.332 linhas removidas**

---

## AI / Pandora (7 hooks, 3.502L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useAIAgents` | 125 | 6 | — | ✅ | CRUD de agentes IA customizados |
| `useAIConversations` | 87 | 6 | — | ✅ | CRUD de conversas com Pandora |
| `useAIProjects` | 58 | 4 | — | ✅ | CRUD de projetos IA |
| `useAIToolExecution` | 2.784 | 2 | useComposioWorkspaceId, useEdgeFn, useGoogleServiceData | ✅ | **MONSTER HOOK** — executa 65+ tools da Pandora |
| `usePandoraLanding` | 111 | 2 | — | ❌ | Animação/estado da landing Pandora |
| `usePandoraMCP` | 113 | 1 | — | ❌ | Chama Pandora via MCP mode |
| `useToolJobQueue` | 224 | 2 | — | ✅ | Polling de tool_jobs para execução async |

### Problemas Identificados
- 🔴 **`useAIToolExecution` (2.784L)** é o maior hook do projeto. Contém lógica de 65+ tools inline. Deve ser decomposto em sub-módulos por domínio (tasks, finance, email, etc.).
- `useAIAgents`, `useAIConversations`, `useAIProjects` são 3 hooks CRUD simples e similares — poderiam ser **1 hook genérico** ou usar TanStack Query factories.

### Recomendação
| Ação | Hooks | Resultado |
|------|-------|----------|
| 🔧 Decompor | `useAIToolExecution` | Extrair para `src/lib/ai-tools/` com sub-módulos por domínio |
| 🔀 Considerar merge | `useAIAgents` + `useAIConversations` + `useAIProjects` | Factory hook `useAICrud<T>(table)` |

---

## Email (16 hooks, 3.422L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useAutoSaveDraft` | 65 | 1 | — | ❌ | Auto-save de rascunhos com debounce |
| `useEmailAI` | 653 | 5 | useEdgeFn, useCreditError | ❌ | IA para emails (sugestões, resumo, resposta) |
| `useEmailActions` | 353 | 1 | useEdgeFn, useComposioWorkspaceId | ❌ | Archive, trash, star, mark read via Composio |
| `useEmailBatchActions` | 200 | 1 | useEdgeFn, useComposioWorkspaceId | ❌ | Ações em lote (batch archive, trash) |
| `useEmailKeyboard` | 111 | 1 | — | ❌ | Atalhos de teclado no email |
| `useEmailPageState` | 243 | **0** ❌ | useEmailAI, usePersistedWidget | ❌ | Estado da página email — **NÃO USADO** |
| `useEmailSnooze` | 97 | 1 | useEdgeFn, useComposioWorkspaceId | ✅ | Snooze de emails |
| `useEmailTemplates` | 277 | 2 | — | ✅ | CRUD de templates de email |
| `useGmailSync` | 107 | 2 | — | ❌ | Trigger de sync Gmail via EF |
| `useInboxAI` | 123 | 4 | useCreditError | ❌ | IA na inbox (classificação, prioridade) |
| `useInboxAutomation` | 132 | 1 | — | ✅ | Regras automáticas de inbox |
| `useLateInboxActions` | 53 | 1 | useLateProxy | ❌ | Ações na inbox Late |
| `useLateInboxComments` | 102 | 2 | useLateProxy | ❌ | Comentários Late na inbox |
| `useLateInboxConversations` | 122 | 2 | useLateProxy | ❌ | Conversas Late na inbox |
| `useLateInboxMessages` | 126 | 1 | useLateProxy | ❌ | Mensagens Late na inbox |
| `useSmartUnsubscribe` | 658 | 2 | useEdgeFn, useComposioWorkspaceId | ✅ | Unsubscribe inteligente com detecção de links |

### Problemas Identificados
- 🔴 **16 hooks para Email** — módulo mais fragmentado do projeto
- `useEmailActions` e `useEmailBatchActions` fazem praticamente o mesmo (ações via Composio), um para individual e outro para batch
- `useEmailPageState` não é utilizado por nenhum componente
- `useInboxAI` e `useEmailAI` têm overlap significativo (ambos fazem IA em emails)
- 4 hooks `useLateInbox*` para integração Late — poderiam ser 1

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔀 Merge | `useEmailActions` + `useEmailBatchActions` + `useEmailSnooze` | `useEmailOperations` |
| 🔀 Merge | `useEmailAI` + `useInboxAI` | `useEmailIntelligence` |
| 🔀 Merge | `useLateInboxActions` + `useLateInboxComments` + `useLateInboxConversations` + `useLateInboxMessages` | `useLateInbox` |
| 🗑️ Remover | `useEmailPageState` | — |
| ✅ Manter | `useGmailSync`, `useAutoSaveDraft`, `useEmailKeyboard`, `useEmailTemplates`, `useSmartUnsubscribe`, `useInboxAutomation` | — |

**De 16 → 9 hooks**

---

## WhatsApp (11 hooks, 2.128L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useConversationSentiment` | 43 | 2 | — | ❌ | Análise de sentimento de conversas |
| `useConversationSort` | 48 | 1 | — | ❌ | Ordenação customizada de conversas |
| `useMessageActions` | 97 | 1 | useWhatsappMessages | ✅ | Ações em mensagens (delete, forward) |
| `useMessageDrafts` | 84 | 1 | — | ❌ | Rascunhos de mensagens WA |
| `useMessagesKeyboard` | 63 | 1 | — | ❌ | Atalhos de teclado em mensagens |
| `useMessagesPageState` | 74 | 2 | — | ❌ | Estado da página de mensagens |
| `useMessagesSyncEngine` | 321 | 1 | — | ✅ | Engine de sync de mensagens WA Web |
| `useMultiWhatsappSessions` | 162 | 1 | — | ✅ | Gerencia múltiplas sessões WA Web |
| `useWhatsappAISettings` | 56 | 2 | — | ✅ | Preferências de IA no WhatsApp |
| `useWhatsappConversations` | 208 | 4 | — | ✅ | CRUD de conversas WA |
| `useWhatsappMessages` | 293 | 2 | — | ✅ | Leitura/envio de mensagens WA |
| `useWhatsappPresence` | 85 | 1 | — | ✅ | Status online/offline de contatos |
| `useWhatsappWebSession` | 527 | 3 | — | ✅ | Gerencia sessão WA Web (QR, connect) |
| `useZernioWhatsApp` | 67 | 2 | useEdgeFn | ❌ | Envio via Zernio (WA Business) |

> **Nota:** `useConversationSentiment`, `useConversationSort`, `useMessageActions`, `useMessageDrafts`, `useMessagesKeyboard`, `useMessagesPageState` estão classificados aqui mas aparecem em "General" no scan por naming.

### Problemas Identificados
- `useMessageActions` e `useWhatsappMessages` têm overlap (ambos manipulam mensagens)
- `useMessagesPageState` é muito fino — poderia ser state local
- `useMultiWhatsappSessions` e `useWhatsappWebSession` gerenciam sessões de formas diferentes

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔀 Merge | `useWhatsappMessages` + `useMessageActions` | `useWhatsappMessages` (expandido) |
| 🔀 Merge | `useWhatsappWebSession` + `useMultiWhatsappSessions` | `useWhatsappSession` |
| 🔀 Merge | `useConversationSentiment` + `useConversationSort` | `useConversationUtils` |
| ✅ Manter | `useWhatsappConversations`, `useMessagesSyncEngine`, `useWhatsappAISettings`, `useWhatsappPresence`, `useZernioWhatsApp` | — |

**De 14 → 9 hooks**

---

## Finance (7 hooks, 1.899L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useDbFinances` | 533 | 7 | useWorkspaceFilter | ✅ | CRUD finanças manuais (transações, metas, recorrentes, orçamentos) |
| `useFinance` | 368 | 3 | — | ✅ | Finanças Pluggy (conexões, contas, transações unificadas) |
| `useFinanceAI` | 154 | 2 | useDbFinances | ❌ | IA financeira (categorização, análise) |
| `useFinanceExtended` | 122 | 3 | — | ✅ | Investimentos e empréstimos Pluggy |
| `useFinanceWidgetPrefs` | 155 | 2 | — | ✅ | Preferências de widget financeiro |
| `usePluggyInsights` | 320 | 6 | useEdgeFn | ✅ | Insights Pluggy (gastos, alertas) |
| `usePluggyPayments` | 247 | 1 | — | ✅ | Pagamentos via Pluggy (Pix, TED) |

### Problemas Identificados
- `useDbFinances` (533L) é monolítico — gerencia 4 entidades (transações, metas, recorrentes, orçamentos)
- `useFinance` e `useFinanceExtended` gerenciam dados Pluggy de forma fragmentada
- `useFinanceWidgetPrefs` faz acesso direto ao Supabase para preferências simples

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔧 Decompor | `useDbFinances` (533L) | `useTransactions` + `useFinanceGoals` + `useRecurring` + `useBudgets` |
| 🔀 Merge | `useFinance` + `useFinanceExtended` | `usePluggyData` |
| ✅ Manter | `useFinanceAI`, `usePluggyInsights`, `usePluggyPayments`, `useFinanceWidgetPrefs` | — |

**De 7 → 8 hooks (mas cada um menor e focado)**

---

## Calendar (5 hooks, 1.098L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useCalendarEvents` | 323 | 3 | useEdgeFn, useComposioWorkspaceId | ❌ | CRUD eventos (local + Google Calendar) |
| `useCalendarKeyboard` | 122 | 1 | — | ❌ | Atalhos de teclado no calendário |
| `useCalendarRsvp` | 67 | 1 | useComposioProxy | ❌ | RSVP em eventos Google |
| `useCalendarSync` | 413 | 1 | useEdgeFn, useComposioWorkspaceId | ✅ | Sync bidirecional Google Calendar |
| `useEventReminders` | 173 | 1 | useEdgeFn, useGoogleServiceData | ❌ | Lembretes e notificações de eventos |

### Problemas Identificados
- `useCalendarSync` (413L) e `useCalendarEvents` (323L) têm overlap na integração Google Calendar
- `useCalendarRsvp` (67L) é muito específico — poderia ser parte de `useCalendarEvents`

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔀 Merge | `useCalendarEvents` + `useCalendarRsvp` + `useCalendarSync` | `useCalendar` (core) + `useCalendarGoogleSync` (sync) |
| ✅ Manter | `useCalendarKeyboard`, `useEventReminders` | — |

**De 5 → 4 hooks**

---

## Integrations (11 hooks, 1.854L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useComposioConnection` | 260 | 16 | useComposioWorkspaceId | ❌ | Conectar/desconectar serviços Composio |
| `useComposioGithub` | 102 | **0** ❌ | useComposioConnection | ❌ | Integração GitHub — **NÃO USADO** |
| `useComposioMusic` | 241 | 1 | useComposioConnection | ❌ | Integração Spotify/YouTube Music |
| `useComposioNotion` | 87 | **0** ❌ | useComposioConnection | ❌ | Integração Notion — **NÃO USADO** |
| `useComposioProxy` | 49 | 6 | useComposioWorkspaceId | ❌ | Chamadas genéricas ao composio-proxy EF |
| `useComposioSlack` | 76 | **0** ❌ | useComposioConnection | ❌ | Integração Slack — **NÃO USADO** |
| `useComposioWorkspaceId` | 23 | 21 | — | ❌ | Resolve workspace_id para Composio |
| `useConnections` | 140 | 2 | useWorkspaceFilter | ✅ | Lista conexões do usuário |
| `useGoogleConnection` | 27 | **0** ❌ | — | ❌ | Legacy — **NÃO USADO** |
| `useGoogleData` | 56 | 3 | useGoogleServiceData | ❌ | Wrapper para dados Google |
| `useGoogleNewDataNotifier` | 177 | **0** ❌ | useGoogleServiceData | ❌ | Notificador — **NÃO USADO** |
| `useGoogleServiceData` | 639 | 18 | useComposioConnection, useEdgeFn | ❌ | Hub central de dados Google (emails, calendar, drive, contacts, tasks) |

### Problemas Identificados
- 🔴 **5 hooks não utilizados** neste módulo — integrações planejadas mas nunca ativadas
- `useGoogleServiceData` (639L) é um "God hook" que centraliza dados de 5 serviços Google
- `useGoogleData` (56L) é apenas um wrapper fino sobre `useGoogleServiceData`

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🗑️ Remover | `useComposioGithub`, `useComposioNotion`, `useComposioSlack`, `useGoogleConnection`, `useGoogleNewDataNotifier` | — |
| 🔀 Merge | `useGoogleData` → absorver em `useGoogleServiceData` | `useGoogleServiceData` |
| ✅ Manter | `useComposioConnection`, `useComposioProxy`, `useComposioWorkspaceId`, `useComposioMusic`, `useConnections` | — |

**De 11 → 6 hooks**

---

## Social Media (13 hooks, 1.681L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useBrandProfile` | 84 | 3 | — | ✅ | Perfil de marca |
| `useFacebookPages` | 34 | 1 | useLateProxy | ❌ | Páginas Facebook |
| `useFacebookSDK` | 69 | **0** ❌ | — | ❌ | SDK Facebook — **NÃO USADO** |
| `useSocialAccounts` | 276 | 2 | useLateProxy | ✅ | Contas sociais conectadas |
| `useSocialAnalytics` | 313 | 4 | useLateProxy | ✅ | Analytics de redes sociais |
| `useSocialCompetitors` | 63 | 1 | — | ✅ | Monitoramento de concorrentes |
| `useSocialPageHandlers` | 131 | 1 | useSocialAccounts, useSocialPosts | ❌ | Handlers da página Social |
| `useSocialPosts` | 286 | 2 | useLateProxy | ✅ | CRUD de posts sociais |
| `useSocialProfiles` | 68 | 2 | useLateProxy | ✅ | Perfis de redes sociais |
| `useSocialQueue` | 114 | 1 | useLateProxy | ❌ | Fila de publicação |
| `useSocialSubscription` | 128 | 2 | useEdgeFn | ✅ | Assinatura do módulo Social |
| `useSocialTemplates` | 61 | 1 | — | ✅ | Templates de posts |
| `useTwitterEngagement` | 54 | **0** ❌ | useLateProxy | ❌ | Engagement Twitter — **NÃO USADO** |

### Problemas Identificados
- `useSocialAccounts` e `useSocialProfiles` têm overlap (ambos gerenciam dados de contas)
- `useSocialPageHandlers` é um hook de orquestração que poderia ser inline no componente
- `useSocialQueue` (fila) poderia ser parte de `useSocialPosts`

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🗑️ Remover | `useFacebookSDK`, `useTwitterEngagement` | — |
| 🔀 Merge | `useSocialAccounts` + `useSocialProfiles` | `useSocialAccounts` |
| 🔀 Merge | `useSocialPosts` + `useSocialQueue` | `useSocialContent` |
| ✅ Manter | `useBrandProfile`, `useFacebookPages`, `useSocialAnalytics`, `useSocialCompetitors`, `useSocialSubscription`, `useSocialTemplates` | — |

**De 13 → 9 hooks**

---

## Search (7 hooks, 1.440L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useGoogleSearch` | 132 | 2 | useEdgeFn, useComposioWorkspaceId | ❌ | Busca via Google Custom Search |
| `useNoteSearchHistory` | 43 | 1 | — | ❌ | Histórico de busca em notas (local) |
| `useSearchHistory` | 263 | 3 | — | ✅ | Histórico de busca global (DB) |
| `useSearchLogic` | 452 | 1 | useGoogleSearch, usePersonalizedSuggestions | ❌ | Lógica central da SearchPage |
| `useSearchMonitors` | 146 | 1 | — | ✅ | SERP monitors CRUD |
| `useSearchPreferences` | 123 | 3 | — | ✅ | Preferências de busca |
| `useSerpSearch` | 281 | 2 | — | ❌ | Busca via SerpAPI |

### Problemas Identificados
- `useSearchLogic` (452L) é usado apenas pelo SearchPage — poderia ser decomposto
- `useGoogleSearch` e `useSerpSearch` são dois engines de busca separados — overlap conceitual

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔀 Considerar merge | `useGoogleSearch` + `useSerpSearch` | `useWebSearch` (com engine como param) |
| ✅ Manter | Demais hooks | — |

**De 7 → 6 hooks**

---

## Automations (2 hooks, 1.007L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useAutomationEngine` | 639 | 3 | useAutomations, useComposioConnection | ✅ | Engine que executa automações |
| `useAutomations` | 368 | 4 | — | ✅ | CRUD de regras de automação |

### Problemas Identificados
- `useAutomationEngine` (639L) é grande mas bem separado de `useAutomations`
- A separação CRUD vs Engine faz sentido arquiteturalmente

### Recomendação
✅ **Manter como está.** A separação é adequada.

---

## Files (4 hooks, 958L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useDriveUpload` | 180 | 1 | useEdgeFn, useComposioWorkspaceId | ❌ | Upload para Google Drive |
| `useFileStorage` | 552 | 6 | useEdgeFn | ❌ | Gerenciamento de arquivos (upload, folders, AI) |
| `useMediaUpload` | 93 | 1 | useLateProxy | ❌ | Upload de mídia via Late |
| `useMultiDriveData` | 133 | **0** ❌ | useComposioConnection | ❌ | Multi-drive — **NÃO USADO** |

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🗑️ Remover | `useMultiDriveData` | — |
| ✅ Manter | `useFileStorage`, `useDriveUpload`, `useMediaUpload` | — |

**De 4 → 3 hooks**

---

## Media / Audio (6 hooks, 943L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useAudioRecorder` | 202 | 1 | — | ❌ | Gravação de áudio (MediaRecorder API) |
| `useElevenLabsTTS` | 246 | 2 | — | ❌ | Text-to-speech via ElevenLabs |
| `useMusicLibrary` | 162 | 3 | usePersistedWidget | ❌ | Biblioteca de música local |
| `useSoundAlerts` | 177 | 6 | — | ❌ | Sons de alerta/notificação |
| `useSpeechRecognition` | 42 | 5 | — | ❌ | Speech-to-text (Web API) |
| `useSpeechSynthesis` | 114 | 1 | — | ❌ | Síntese de voz (Web API) |

### Problemas Identificados
- `useSpeechSynthesis` e `useElevenLabsTTS` fazem TTS por caminhos diferentes
- `useSpeechRecognition` e `useRealtimeTranscription` (em General) fazem STT

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔀 Considerar merge | `useSpeechSynthesis` + `useElevenLabsTTS` | `useTextToSpeech` (com provider param) |
| ✅ Manter | Demais hooks | — |

**De 6 → 5 hooks**

---

## Notes (3 hooks, 795L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useNoteAutoSave` | 63 | 1 | — | ❌ | Auto-save com debounce |
| `useNoteListKeyboard` | 52 | 1 | — | ❌ | Atalhos de teclado na lista |
| `useNotesLogic` | 680 | 1 | useEdgeFn, useNoteAutoSave | ❌ | Lógica completa de notas |

### Problemas Identificados
- `useNotesLogic` (680L) é grande e usado por 1 só componente
- `useNoteAutoSave` é consumido apenas por `useNotesLogic` — poderia ser interno

### Recomendação
✅ **Manter como está** — `useNotesLogic` precisa de decomposição mas a separação auto-save/keyboard faz sentido.

---

## Workspace (4 hooks, 694L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `usePersistedWidget` | 201 | 16 | — | ✅ | Persistir estado de widgets no DB |
| `useWidgetLayout` | 222 | 4 | — | ✅ | Layout do dashboard (posição/tamanho) |
| `useWidgetShares` | 197 | **0** ❌ | — | ✅ | Compartilhamento de widgets — **VERIFICAR** |
| `useWorkspaceFilter` | 39 | 6 | — | ❌ | Filtrar por workspace ativo |

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| ⚠️ Verificar | `useWidgetShares` | Pode estar não usado ou acessado indiretamente |
| ✅ Manter | Demais hooks | — |

---

## Contacts (2 hooks, 370L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useContactFollowupAlerts` | 212 | 1 | useAutomationEngine | ✅ | Alertas de follow-up |
| `useDbContacts` | 158 | 5 | useWorkspaceFilter | ✅ | CRUD de contatos |

### Recomendação
✅ **Manter como está.**

---

## Auth & Billing (5 hooks, 346L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useAuthSession` | 36 | 1 | — | ❌ | Sessão auth (listener) |
| `useCreditError` | 43 | 3 | — | ❌ | Handler de erros de crédito |
| `useGatewayApiKeyLogs` | 50 | 1 | — | ✅ | Logs de uso de API keys |
| `useGatewayApiKeys` | 117 | 1 | — | ✅ | CRUD de API keys |
| `useSubscription` | 100 | 9 | — | ✅ | Dados de assinatura do usuário |

### Recomendação
| Ação | Hooks Atuais | Hook Proposto |
|------|-------------|---------------|
| 🔀 Merge | `useGatewayApiKeys` + `useGatewayApiKeyLogs` | `useGatewayApiKeys` (com logs) |
| ✅ Manter | Demais hooks | — |

**De 5 → 4 hooks**

---

## Admin (2 hooks, 140L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useAdminData` | 112 | 2 | — | ✅ | Dados admin (users, stats, logs) |
| `useAdminRole` | 28 | 5 | — | ❌ | Verifica se user é admin |

### Recomendação
✅ **Manter como está.**

---

## Social / Gamification (1 hook, 161L)

| Hook | Linhas | Importers | Deps | Supabase | Responsabilidade |
|------|--------|-----------|------|----------|-----------------|
| `useFriends` | 161 | 2 | — | ✅ | Amigos, pedidos, lista |

### Recomendação
✅ **Manter como está.**

---

## General / Utilities (39 hooks, 4.519L)

Hooks utilitários que servem múltiplos módulos:

| Hook | Linhas | Importers | Supabase | Responsabilidade |
|------|--------|-----------|----------|-----------------|
| `useActivityLog` | 37 | **0** ❌ | ✅ | Logger de atividade — **NÃO USADO** |
| `useAnalytics` | 338 | 2 | ✅ | Dashboard analytics |
| `useArticleSEO` | 167 | 1 | ❌ | SEO para artigos do blog |
| `useAutoSync` | 100 | 1 | ✅ | Auto-sync periódico de dados Google |
| `useChangelogs` | 40 | 2 | ✅ | Leitura de changelogs |
| `useContentDecay` | 43 | 1 | ❌ | Detecção de conteúdo desatualizado |
| `useDbTasks` | 221 | 5 | ✅ | CRUD de tarefas + subtarefas |
| `useEdgeFn` | 189 | **74** | ❌ | **Hub central** — chama Edge Functions |
| `useErrorReporter` | 167 | 2 | ✅ | Reporter de erros ao DB |
| `useFlushOnExit` | 98 | 2 | ❌ | Flush pendentes antes de sair |
| `useGmbLocations` | 102 | 1 | ❌ | Google My Business locations |
| `useGmbReviews` | 78 | 1 | ❌ | Google My Business reviews |
| `useHabitReminder` | 60 | 1 | ❌ | Lembretes de hábitos |
| `useLateProxy` | 23 | **19** | ❌ | Proxy para Late API |
| `useLocalDataNotifier` | 152 | 1 | ✅ | Notifica mudanças locais |
| `useMapFavorites` | 77 | 3 | ✅ | Favoritos no mapa |
| `useMapTrips` | 88 | 3 | ✅ | Viagens no mapa |
| `useMessageActions` | 97 | 1 | ✅ | Ações em mensagens WA |
| `useMessageDrafts` | 84 | 1 | ❌ | Rascunhos de mensagem |
| `useMorningBriefing` | 217 | 2 | ❌ | Briefing matinal IA |
| `useNewsBreakingAlerts` | 99 | 1 | ❌ | Alertas de notícias |
| `useOnlineStatus` | 18 | 1 | ❌ | Detecta online/offline |
| `usePersistedWidget` | 201 | 16 | ✅ | Persistir estado widgets |
| `usePersonalizedSuggestions` | 172 | 1 | ✅ | Sugestões personalizadas |
| `usePlatformIntegrations` | 51 | 2 | ✅ | Lista integrações |
| `usePostStatusSync` | 111 | 1 | ✅ | Sync status de posts |
| `useProactiveInsights` | 158 | 2 | ✅ | Insights proativos da IA |
| `useQuickReplies` | 75 | 1 | ✅ | Respostas rápidas |
| `useRealtimeTranscription` | 289 | 1 | ❌ | Transcrição em tempo real |
| `useReducedMotion` | 17 | 10 | ❌ | Detecta preferência de motion |
| `useSmartCommands` | 234 | 5 | ❌ | Comandos rápidos (/) |
| `useSmartNotifications` | 191 | 1 | ✅ | Notificações inteligentes |
| `useSyncQueue` | 157 | 1 | ❌ | Fila de sync offline-first |
| `useTheme` | 160 | 5 | ❌ | Gerenciamento de tema |
| `useTypewriter` | 42 | 2 | ❌ | Efeito typewriter |
| `useUndoable` | 51 | 2 | ❌ | Undo/redo genérico |
| `useVisibilityRefresh` | 41 | 1 | ❌ | Refresh ao voltar à aba |
| `useWallpaper` | 184 | 7 | ❌ | Wallpaper do dashboard |

### Problemas Identificados
- Categoria "General" tem 39 hooks — muitos deveriam ser reclassificados para seus módulos
- `useOnlineStatus` (18L) é trivial — poderia ser inline
- `useRealtimeTranscription` (289L) tem overlap com `useSpeechRecognition`

---

## UI Utilities (2 hooks, 205L)

| Hook | Linhas | Importers | Responsabilidade |
|------|--------|-----------|-----------------|
| `use-mobile` | 19 | **0** ❌ | Detecta mobile viewport — **VERIFICAR re-export** |
| `use-toast` | 186 | **132** | Sistema de toast notifications |

---

## 📊 Tabela de Consolidação

### Proposta geral de redução

| Módulo | Hooks Atuais | Hooks Propostos | Redução |
|--------|-------------|----------------|---------|
| Email | 16 | 9 | -7 |
| Integrations | 11 | 6 | -5 |
| WhatsApp | 14 | 9 | -5 |
| Social Media | 13 | 9 | -4 |
| Finance | 7 | 8 | +1 (decomposição) |
| Calendar | 5 | 4 | -1 |
| Search | 7 | 6 | -1 |
| Media/Audio | 6 | 5 | -1 |
| Files | 4 | 3 | -1 |
| Auth & Billing | 5 | 4 | -1 |
| AI / Pandora | 7 | 5 | -2 (+ decomposição) |
| **TOTAL** | **~150** | **~118** | **~-32 hooks** |

### Impacto estimado
- **32 hooks removidos/consolidados**
- **~3.000+ linhas eliminadas** (incluindo 1.332L de hooks não utilizados)
- **Complexidade de importações reduzida** em ~20%

---

## 🚨 Violações de Camada

### Hooks com acesso direto ao Supabase (66 hooks)

Hooks que fazem `.from("table")` diretamente ao invés de usar Edge Functions ou RPCs:

#### Nível 🔴 CRÍTICO (dados sensíveis ou lógica de negócio complexa)
| Hook | Tabela(s) | Deveria usar |
|------|-----------|-------------|
| `useAIToolExecution` | 15+ tabelas | EF dedicada por domínio |
| `useSmartUnsubscribe` | `gmail_messages_cache`, emails | EF `email-unsubscribe` |
| `useCalendarSync` | `calendar_events_cache` | EF `calendar-sync` |
| `useAutomationEngine` | `automation_rules`, `automation_logs` | EF `run-automation` |
| `useSmartNotifications` | Múltiplas | EF `smart-notifications` |

#### Nível 🟡 MÉDIO (CRUD simples mas expõe schema)
| Hook | Tabela(s) | Nota |
|------|-----------|------|
| `useDbFinances` | 4 tabelas finance_* | Aceitável para CRUD, mas validação server-side seria melhor |
| `useDbContacts` | `contacts`, `contact_interactions` | Similar |
| `useDbTasks` | `tasks`, `task_subtasks` | Similar |
| `useSearchHistory` | `search_history` | Aceitável |

#### Nível 🟢 OK (padrão aceitável)
| Hook | Nota |
|------|------|
| `useSubscription`, `useAdminData`, `useChangelogs` | Leitura simples, RLS protege |
| `useAIAgents`, `useAIConversations`, `useAIProjects` | CRUD simples com RLS |
| `usePersistedWidget`, `useFinanceWidgetPrefs` | Preferências do usuário |

---

## 📏 Top 10 Maiores Hooks

| # | Hook | Linhas | Importers | Problema |
|---|------|--------|-----------|---------|
| 1 | `useAIToolExecution` | 2.784 | 2 | 🔴 God hook — 65+ tools inline |
| 2 | `useNotesLogic` | 680 | 1 | 🟡 Monolítico mas focado |
| 3 | `useSmartUnsubscribe` | 658 | 2 | 🟡 Grande mas especializado |
| 4 | `useEmailAI` | 653 | 5 | 🟡 Poderia dividir prompt/execution |
| 5 | `useAutomationEngine` | 639 | 3 | 🟡 Engine complexo — aceitável |
| 6 | `useGoogleServiceData` | 639 | 18 | 🟡 Hub central — difícil decompor |
| 7 | `useFileStorage` | 552 | 6 | 🟢 OK |
| 8 | `useDbFinances` | 533 | 7 | 🟡 4 entidades em 1 hook |
| 9 | `useWhatsappWebSession` | 527 | 3 | 🟢 OK — sessão WA é complexa |
| 10 | `useSearchLogic` | 452 | 1 | 🟡 Usado por 1 componente |

---

## Próximos Passos Recomendados

1. **🗑️ Fase 1 — Limpar hooks mortos** (esforço: baixo, impacto: alto)
   - Remover 13 hooks não utilizados (~1.332L)
   - Verificar `use-mobile`, `useWhatsappConnections`, `useWidgetShares` por re-exports

2. **🔧 Fase 2 — Decompor useAIToolExecution** (esforço: alto, impacto: alto)
   - Extrair lógica de tools para `src/lib/ai-tools/{domain}.ts`
   - Hook vira orquestrador fino

3. **🔀 Fase 3 — Consolidar módulo Email** (esforço: médio, impacto: médio)
   - Merge de 16 → 9 hooks
   - Eliminar `useEmailPageState`

4. **🔀 Fase 4 — Consolidar demais módulos** (esforço: médio, impacto: médio)
   - WhatsApp: 14 → 9
   - Integrations: 11 → 6
   - Social: 13 → 9

5. **🏗️ Fase 5 — Service Layer** (esforço: alto, impacto: alto)
   - Mover acesso Supabase direto para `src/lib/services/`
   - Hooks consomem services, não client direto

---

*Documento gerado via auditoria automatizada de código. Última atualização: 2026-03-29.*
