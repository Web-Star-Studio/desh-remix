-- Add key_facts and images columns to search_history for full snapshot support
ALTER TABLE public.search_history
  ADD COLUMN IF NOT EXISTS key_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_queries jsonb NOT NULL DEFAULT '[]'::jsonb;