-- Drop the overly restrictive unique constraint that prevents multiple note/event rows
DROP INDEX IF EXISTS idx_user_data_unique_type;

-- Create a new unique constraint only for data types that should be singletons
-- (habits, quick_links, world_clocks, music_library, etc.)
-- Notes and events are allowed to have multiple rows per user
CREATE UNIQUE INDEX idx_user_data_unique_singleton 
ON public.user_data (user_id, data_type) 
WHERE data_type NOT IN ('note', 'event');