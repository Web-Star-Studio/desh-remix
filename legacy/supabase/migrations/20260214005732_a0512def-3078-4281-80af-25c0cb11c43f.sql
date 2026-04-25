
-- Add recurrence column to tasks
ALTER TABLE public.tasks ADD COLUMN recurrence text DEFAULT null;
-- Values: null (one-time), 'daily', 'weekly', 'monthly'

-- Add completed_at for stats tracking
ALTER TABLE public.tasks ADD COLUMN completed_at timestamp with time zone DEFAULT null;
