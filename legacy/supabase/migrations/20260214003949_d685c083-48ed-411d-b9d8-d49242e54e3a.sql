
-- Create subtasks table
CREATE TABLE public.task_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

-- Subtasks inherit access from parent task
CREATE POLICY "Users can read subtasks of their own tasks"
  ON public.task_subtasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));

CREATE POLICY "Users can insert subtasks on their own tasks"
  ON public.task_subtasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));

CREATE POLICY "Users can update subtasks of their own tasks"
  ON public.task_subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));

CREATE POLICY "Users can delete subtasks of their own tasks"
  ON public.task_subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));

-- Add description column to tasks for richer editing
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
