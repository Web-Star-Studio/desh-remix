
-- Composite indexes for RLS query optimization

-- contacts: filter by user+workspace, order by name
CREATE INDEX IF NOT EXISTS idx_contacts_user_ws_name ON public.contacts (user_id, workspace_id, name);

-- finance_transactions: filter by user+workspace, order by date
CREATE INDEX IF NOT EXISTS idx_finance_tx_user_ws_date ON public.finance_transactions (user_id, workspace_id, date DESC);

-- finance_goals: filter by user+workspace
CREATE INDEX IF NOT EXISTS idx_finance_goals_user_ws ON public.finance_goals (user_id, workspace_id);

-- finance_recurring: filter by user+workspace
CREATE INDEX IF NOT EXISTS idx_finance_recurring_user_ws ON public.finance_recurring (user_id, workspace_id);

-- finance_budgets: filter by user+workspace
CREATE INDEX IF NOT EXISTS idx_finance_budgets_user_ws ON public.finance_budgets (user_id, workspace_id);

-- tasks: filter by user+workspace, order by created_at
CREATE INDEX IF NOT EXISTS idx_tasks_user_ws_created ON public.tasks (user_id, workspace_id, created_at DESC);

-- ai_conversations: filter by user, order by updated_at
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated ON public.ai_conversations (user_id, updated_at DESC);

-- contact_interactions: filter by contact, order by date
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_date ON public.contact_interactions (contact_id, interaction_date DESC);

-- task_subtasks: filter by task, order by sort_order
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_sort ON public.task_subtasks (task_id, sort_order);

-- user_data: filter by user+type+workspace (upgrade existing)
CREATE INDEX IF NOT EXISTS idx_user_data_user_type_ws ON public.user_data (user_id, data_type, workspace_id);

-- tool_jobs: filter by user+batch+status
CREATE INDEX IF NOT EXISTS idx_tool_jobs_user_batch_status ON public.tool_jobs (user_id, batch_id, status);

-- workspaces: filter by user, order by sort_order
CREATE INDEX IF NOT EXISTS idx_workspaces_user_sort ON public.workspaces (user_id, sort_order);

-- Partial index: active tasks only (dashboard shows non-done tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_pending_user_due ON public.tasks (user_id, due_date) WHERE status != 'done';

-- credit_transactions: filter by user, order by created_at (billing history)
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON public.credit_transactions (user_id, created_at DESC);

-- ai_memories: filter by user+category
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_cat ON public.ai_memories (user_id, category);
