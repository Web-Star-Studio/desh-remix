
-- Etapa 1: Corrigir constraints de tipo e status da tabela whatsapp_messages
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_type_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_type_check 
  CHECK (type IN ('text','image','audio','video','document','sticker','location','contact','reaction','template','other'));

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('pending','sending','sent','delivered','read','failed'));

-- Etapa 3/4: Habilitar extensoes pg_cron e pg_net para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
