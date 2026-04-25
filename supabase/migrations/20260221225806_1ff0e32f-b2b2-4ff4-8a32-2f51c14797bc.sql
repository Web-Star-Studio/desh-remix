
-- Tabela de locks para evitar processamento duplicado da Pandora
CREATE TABLE public.pandora_processing_locks (
  conversation_id text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  message_key_id text
);

-- RLS (service role only - edge functions use service role key)
ALTER TABLE public.pandora_processing_locks ENABLE ROW LEVEL SECURITY;

-- Função para limpar locks antigos (>60s)
CREATE OR REPLACE FUNCTION public.cleanup_pandora_locks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.pandora_processing_locks
  WHERE locked_at < now() - interval '60 seconds';
$$;
