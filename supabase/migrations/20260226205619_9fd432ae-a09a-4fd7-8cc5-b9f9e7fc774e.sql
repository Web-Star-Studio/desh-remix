-- Clean up ALL duplicates keeping only the most recent row per (user_id, data_type)
DELETE FROM user_data
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, data_type) id
  FROM user_data
  ORDER BY user_id, data_type, updated_at DESC
);

-- Now add the unique constraint
CREATE UNIQUE INDEX idx_user_data_unique_type ON public.user_data (user_id, data_type);