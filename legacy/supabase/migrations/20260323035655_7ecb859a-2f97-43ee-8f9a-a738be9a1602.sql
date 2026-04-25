
-- Add missing columns to files table
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS extension text;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS is_latest_version boolean DEFAULT true;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS ai_suggested_links jsonb DEFAULT '[]'::jsonb;

-- Trigger to auto-populate extension from name
CREATE OR REPLACE FUNCTION public.set_file_extension()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS NOT NULL AND position('.' in NEW.name) > 0 THEN
    NEW.extension := lower(substring(NEW.name from '\.([^.]+)$'));
  ELSE
    NEW.extension := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_file_extension ON public.files;
CREATE TRIGGER trg_set_file_extension
  BEFORE INSERT OR UPDATE OF name ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.set_file_extension();

-- Backfill extension for existing files
UPDATE public.files SET extension = lower(substring(name from '\.([^.]+)$'))
WHERE extension IS NULL AND position('.' in name) > 0;
