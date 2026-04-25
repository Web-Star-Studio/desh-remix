
-- Allow per-folder sync state (currently only per-user)
ALTER TABLE gmail_sync_state 
  DROP CONSTRAINT IF EXISTS gmail_sync_state_user_id_key;

ALTER TABLE gmail_sync_state 
  ADD CONSTRAINT gmail_sync_state_user_id_folder_key 
  UNIQUE (user_id, folder);
