
-- Add connection_id to gmail_sync_state for multi-account support
ALTER TABLE public.gmail_sync_state ADD COLUMN IF NOT EXISTS connection_id text;

-- Drop old unique constraint (user_id, folder)
ALTER TABLE public.gmail_sync_state DROP CONSTRAINT IF EXISTS gmail_sync_state_user_id_folder_key;

-- Create new unique constraint (user_id, folder, connection_id)
ALTER TABLE public.gmail_sync_state ADD CONSTRAINT gmail_sync_state_user_folder_conn_key UNIQUE (user_id, folder, connection_id);
