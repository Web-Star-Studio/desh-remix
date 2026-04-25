
-- Add workspace_id to whatsapp_web_sessions
ALTER TABLE public.whatsapp_web_sessions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Add workspace_id to financial_connections
ALTER TABLE public.financial_connections ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Add workspace_id to financial_accounts
ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Add workspace_id to financial_investments
ALTER TABLE public.financial_investments ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Backfill existing rows: assign to user's default workspace
UPDATE public.whatsapp_web_sessions s
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.user_id = s.user_id AND w.is_default = true AND s.workspace_id IS NULL;

UPDATE public.financial_connections fc
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.user_id = fc.user_id AND w.is_default = true AND fc.workspace_id IS NULL;

UPDATE public.financial_accounts fa
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.user_id = fa.user_id AND w.is_default = true AND fa.workspace_id IS NULL;

UPDATE public.financial_investments fi
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.user_id = fi.user_id AND w.is_default = true AND fi.workspace_id IS NULL;
