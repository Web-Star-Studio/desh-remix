
CREATE OR REPLACE FUNCTION public.get_last_messages(_conv_ids uuid[])
RETURNS TABLE(
  conversation_id uuid,
  content_text text,
  direction text,
  type text,
  content_raw jsonb,
  sent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (wm.conversation_id)
    wm.conversation_id,
    wm.content_text,
    wm.direction,
    wm.type,
    wm.content_raw,
    wm.sent_at
  FROM public.whatsapp_messages wm
  WHERE wm.conversation_id = ANY(_conv_ids)
  ORDER BY wm.conversation_id, wm.sent_at DESC;
$$;
