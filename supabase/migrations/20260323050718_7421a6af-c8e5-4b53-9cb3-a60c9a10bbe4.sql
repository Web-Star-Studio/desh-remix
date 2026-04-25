
-- Add ai_processing_status column for pipeline tracking
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS ai_processing_status text DEFAULT 'pending';

-- Full-text search index on OCR text (Portuguese)
CREATE INDEX IF NOT EXISTS idx_files_ocr_text ON files USING gin(to_tsvector('portuguese', COALESCE(ocr_text, '')));

-- Full-text search index on ai_summary
CREATE INDEX IF NOT EXISTS idx_files_ai_summary ON files USING gin(to_tsvector('portuguese', COALESCE(ai_summary, '')));

-- Index on ai_tags for array containment queries
CREATE INDEX IF NOT EXISTS idx_files_ai_tags ON files USING gin(ai_tags);

-- Index on ai_processing_status for filtering
CREATE INDEX IF NOT EXISTS idx_files_ai_status ON files(user_id, ai_processing_status) WHERE ai_processing_status != 'done';
