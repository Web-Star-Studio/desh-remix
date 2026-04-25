
-- 1. Create workspaces table
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Principal',
  icon text NOT NULL DEFAULT '🏠',
  color text NOT NULL DEFAULT 'hsl(220, 80%, 50%)',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read their own workspaces"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspaces"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_workspaces_user_id ON public.workspaces (user_id);

-- 2. Add workspace_id column to existing tables
ALTER TABLE public.user_data ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.connections ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.finance_transactions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.finance_recurring ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.finance_goals ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.task_subtasks ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.user_files ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.user_folders ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Indexes on workspace_id for all affected tables
CREATE INDEX idx_user_data_workspace ON public.user_data (workspace_id);
CREATE INDEX idx_connections_workspace ON public.connections (workspace_id);
CREATE INDEX idx_contacts_workspace ON public.contacts (workspace_id);
CREATE INDEX idx_finance_transactions_workspace ON public.finance_transactions (workspace_id);
CREATE INDEX idx_finance_recurring_workspace ON public.finance_recurring (workspace_id);
CREATE INDEX idx_finance_goals_workspace ON public.finance_goals (workspace_id);
CREATE INDEX idx_tasks_workspace ON public.tasks (workspace_id);
CREATE INDEX idx_task_subtasks_workspace ON public.task_subtasks (workspace_id);
CREATE INDEX idx_user_files_workspace ON public.user_files (workspace_id);
CREATE INDEX idx_user_folders_workspace ON public.user_folders (workspace_id);

-- 3. Add active_workspace_id to profiles
ALTER TABLE public.profiles ADD COLUMN active_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 4. Trigger: auto-create default workspace for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.workspaces (user_id, name, icon, color, is_default, sort_order)
  VALUES (NEW.id, 'Principal', '🏠', 'hsl(220, 80%, 50%)', true, 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();

-- 5. Function to create default workspace for existing users who don't have one
CREATE OR REPLACE FUNCTION public.ensure_default_workspace(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws_id uuid;
BEGIN
  SELECT id INTO ws_id FROM public.workspaces WHERE user_id = _user_id AND is_default = true LIMIT 1;
  IF ws_id IS NULL THEN
    INSERT INTO public.workspaces (user_id, name, icon, color, is_default, sort_order)
    VALUES (_user_id, 'Principal', '🏠', 'hsl(220, 80%, 50%)', true, 0)
    RETURNING id INTO ws_id;
  END IF;
  RETURN ws_id;
END;
$$;
