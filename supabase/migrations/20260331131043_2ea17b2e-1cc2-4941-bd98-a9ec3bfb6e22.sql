
-- Add workspace_id to composio_user_emails for workspace isolation
ALTER TABLE public.composio_user_emails
  ADD COLUMN IF NOT EXISTS workspace_id text DEFAULT 'default';

-- Drop old unique constraint and create new one with workspace_id
ALTER TABLE public.composio_user_emails
  DROP CONSTRAINT IF EXISTS composio_user_emails_email_toolkit_key;

ALTER TABLE public.composio_user_emails
  ADD CONSTRAINT composio_user_emails_email_toolkit_ws_key UNIQUE (email, toolkit, workspace_id);
