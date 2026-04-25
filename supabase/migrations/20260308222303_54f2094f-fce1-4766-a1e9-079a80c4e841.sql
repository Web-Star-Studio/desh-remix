-- Backfill workspace_id on whatsapp_conversations from whatsapp_web_sessions
UPDATE public.whatsapp_conversations c
SET workspace_id = s.workspace_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, workspace_id
  FROM public.whatsapp_web_sessions
  WHERE workspace_id IS NOT NULL
  ORDER BY user_id, updated_at DESC
) s
WHERE c.user_id = s.user_id
  AND c.workspace_id IS NULL
  AND s.workspace_id IS NOT NULL;