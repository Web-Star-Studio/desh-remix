ALTER TABLE public.pandora_interaction_logs ADD COLUMN IF NOT EXISTS system_prompt_used TEXT;
ALTER TABLE public.pandora_interaction_logs ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.pandora_interaction_logs ADD COLUMN IF NOT EXISTS agent_id UUID;