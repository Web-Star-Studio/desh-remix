
ALTER TABLE public.file_inbox
  ADD COLUMN IF NOT EXISTS r2_temp_key text,
  ADD COLUMN IF NOT EXISTS sender text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_file_inbox_user_status ON file_inbox(user_id, status);
CREATE INDEX IF NOT EXISTS idx_file_inbox_created ON file_inbox(user_id, created_at DESC);
