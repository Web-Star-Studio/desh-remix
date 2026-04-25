
-- Coluna para mensagens favoritadas
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS starred boolean DEFAULT false;

-- Coluna para mensagens apagadas
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean DEFAULT false;

-- Coluna para reacoes
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS reactions jsonb DEFAULT '[]'::jsonb;

-- Tabela de presenca (cache temporario)
CREATE TABLE IF NOT EXISTS public.whatsapp_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_jid text NOT NULL,
  status text NOT NULL DEFAULT 'unavailable',
  last_seen_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, contact_jid)
);
ALTER TABLE public.whatsapp_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own presence" ON public.whatsapp_presence
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime para presenca
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_presence;
