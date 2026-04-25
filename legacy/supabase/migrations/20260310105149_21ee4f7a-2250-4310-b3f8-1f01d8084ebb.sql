
-- =====================================================
-- PERFORMANCE: Add missing indexes
-- =====================================================

-- user_id indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_id ON public.finance_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_finance_goals_user_id ON public.finance_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_finance_recurring_user_id ON public.finance_recurring (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_user_id ON public.contact_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON public.ai_agents (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_projects_user_id ON public.ai_projects (user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_id ON public.automation_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON public.automation_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_user_id ON public.email_send_log (user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_pandora_interaction_logs_user_id ON public.pandora_interaction_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON public.connections (user_id);
CREATE INDEX IF NOT EXISTS idx_financial_investments_user_id ON public.financial_investments (user_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_user_id ON public.google_connections (user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_cache_user_id ON public.gmail_messages_cache (user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_sync_state_user_id ON public.gmail_sync_state (user_id);

-- workspace_id indexes
CREATE INDEX IF NOT EXISTS idx_financial_accounts_workspace ON public.financial_accounts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_financial_connections_workspace ON public.financial_connections (workspace_id);
CREATE INDEX IF NOT EXISTS idx_financial_investments_workspace ON public.financial_investments (workspace_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages (conversation_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_cache_folder ON public.gmail_messages_cache (user_id, folder, date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_date ON public.credit_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_workspace ON public.tasks (user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_data_user_type ON public.user_data (user_id, data_type);

-- whatsapp_web_session_logs (45K+ rows)
CREATE INDEX IF NOT EXISTS idx_wa_session_logs_session ON public.whatsapp_web_session_logs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_session_logs_user ON public.whatsapp_web_session_logs (user_id, created_at DESC);
