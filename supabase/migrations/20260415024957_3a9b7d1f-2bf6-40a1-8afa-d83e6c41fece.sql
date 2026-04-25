-- Add workspace_id to whatsapp_ai_settings
ALTER TABLE public.whatsapp_ai_settings 
ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Migrate existing rows: link to each user's default workspace
UPDATE public.whatsapp_ai_settings s
SET workspace_id = (
  SELECT w.id FROM public.workspaces w 
  WHERE w.user_id = s.user_id AND w.is_default = true 
  LIMIT 1
);

-- Drop old unique constraint on user_id alone
ALTER TABLE public.whatsapp_ai_settings DROP CONSTRAINT IF EXISTS whatsapp_ai_settings_user_id_key;

-- Add new unique constraint per user+workspace
ALTER TABLE public.whatsapp_ai_settings 
ADD CONSTRAINT whatsapp_ai_settings_user_workspace_unique UNIQUE (user_id, workspace_id);

-- Update RLS policies to include workspace_id awareness
DROP POLICY IF EXISTS "Users can view own whatsapp_ai_settings" ON public.whatsapp_ai_settings;
DROP POLICY IF EXISTS "Users can insert own whatsapp_ai_settings" ON public.whatsapp_ai_settings;
DROP POLICY IF EXISTS "Users can update own whatsapp_ai_settings" ON public.whatsapp_ai_settings;

CREATE POLICY "Users can view own whatsapp_ai_settings" 
ON public.whatsapp_ai_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp_ai_settings" 
ON public.whatsapp_ai_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp_ai_settings" 
ON public.whatsapp_ai_settings FOR UPDATE 
USING (auth.uid() = user_id);