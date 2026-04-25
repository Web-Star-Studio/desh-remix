
-- Phase 1: Add workspace_id to google_connections
ALTER TABLE public.google_connections 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Phase 3: Add workspace_id to gmail_messages_cache
ALTER TABLE public.gmail_messages_cache 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Phase 5: Add workspace_id to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_google_connections_workspace ON public.google_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gmail_cache_workspace ON public.gmail_messages_cache(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_workspace ON public.whatsapp_conversations(workspace_id);
