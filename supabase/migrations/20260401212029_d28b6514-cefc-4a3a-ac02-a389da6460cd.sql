
-- 1. Workspaces: add rich context columns (icon/color already exist)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS context_summary TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS system_prompt_override TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS default_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS default_model TEXT DEFAULT 'gemini-2.5-flash';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. User workspace preferences
CREATE TABLE IF NOT EXISTS public.user_workspace_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  workspace_order TEXT[] DEFAULT '{}',
  show_all_mode BOOLEAN DEFAULT true,
  all_mode_behavior TEXT DEFAULT 'read_only' CHECK (all_mode_behavior IN ('read_only', 'favorite_with_confirm')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_workspace_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own workspace prefs"
  ON public.user_workspace_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Workspace documents
CREATE TABLE IF NOT EXISTS public.workspace_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('context', 'guidelines', 'faq', 'process', 'reference')),
  is_active BOOLEAN DEFAULT true,
  token_estimate INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_docs ON public.workspace_documents(workspace_id, is_active);

ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ws docs"
  ON public.workspace_documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. ai_agents: workspace-scoped + template system
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tools_enabled TEXT[] DEFAULT '{}';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS model_override TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS temperature_override FLOAT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_agents_ws ON public.ai_agents(workspace_id, is_active);

-- 5. ai_conversations: workspace-scoped (REGRA 2)
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_ws ON public.ai_conversations(user_id, workspace_id);

-- 6. Workspace isolation for core tables missing workspace_id
ALTER TABLE public.ai_memories ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_memories_ws ON public.ai_memories(workspace_id);

ALTER TABLE public.ai_knowledge_base ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_ws ON public.ai_knowledge_base(workspace_id);

ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_automation_rules_ws ON public.automation_rules(workspace_id);

ALTER TABLE public.automation_logs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_automation_logs_ws ON public.automation_logs(workspace_id);

ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_ws ON public.social_accounts(workspace_id);

-- Triggers for updated_at on new tables
CREATE TRIGGER update_user_workspace_prefs_updated_at
  BEFORE UPDATE ON public.user_workspace_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspace_documents_updated_at
  BEFORE UPDATE ON public.workspace_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
