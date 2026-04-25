
-- ============================================================
-- WhatsApp Integration Schema
-- ============================================================

-- 1. whatsapp_connections
CREATE TABLE public.whatsapp_connections (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL,
  waba_id           text        NOT NULL,
  phone_number_id   text        NOT NULL,
  phone_number      text        NOT NULL,
  meta_access_token text        NOT NULL,
  status            text        NOT NULL DEFAULT 'connected'
                                CONSTRAINT whatsapp_connections_status_check
                                CHECK (status IN ('connected', 'error', 'disconnected')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_connections_user_id ON public.whatsapp_connections (user_id);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own whatsapp connections"
  ON public.whatsapp_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whatsapp connections"
  ON public.whatsapp_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whatsapp connections"
  ON public.whatsapp_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whatsapp connections"
  ON public.whatsapp_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. whatsapp_conversations
CREATE TABLE public.whatsapp_conversations (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL,
  channel             text        NOT NULL DEFAULT 'whatsapp'
                                  CONSTRAINT whatsapp_conversations_channel_check
                                  CHECK (channel IN ('whatsapp')),
  external_contact_id text        NOT NULL,
  title               text,
  last_message_at     timestamptz NOT NULL DEFAULT now(),
  unread_count        integer     NOT NULL DEFAULT 0,
  labels              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, external_contact_id)
);

CREATE INDEX idx_whatsapp_conversations_user_id ON public.whatsapp_conversations (user_id);
CREATE INDEX idx_whatsapp_conversations_user_last ON public.whatsapp_conversations (user_id, last_message_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whatsapp conversations"
  ON public.whatsapp_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. whatsapp_messages
CREATE TABLE public.whatsapp_messages (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid        NOT NULL REFERENCES public.whatsapp_conversations (id) ON DELETE CASCADE,
  direction       text        NOT NULL
                              CONSTRAINT whatsapp_messages_direction_check
                              CHECK (direction IN ('inbound', 'outbound')),
  type            text        NOT NULL DEFAULT 'text'
                              CONSTRAINT whatsapp_messages_type_check
                              CHECK (type IN ('text', 'image', 'audio', 'template', 'other')),
  content_text    text,
  content_raw     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  status          text        NOT NULL DEFAULT 'pending'
                              CONSTRAINT whatsapp_messages_status_check
                              CHECK (status IN ('delivered', 'read', 'failed', 'pending'))
);

CREATE INDEX idx_whatsapp_messages_conversation_id ON public.whatsapp_messages (conversation_id);
CREATE INDEX idx_whatsapp_messages_conversation_sent ON public.whatsapp_messages (conversation_id, sent_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages of their conversations"
  ON public.whatsapp_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages into their conversations"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update messages in their conversations"
  ON public.whatsapp_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages from their conversations"
  ON public.whatsapp_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND c.user_id = auth.uid()
  ));
