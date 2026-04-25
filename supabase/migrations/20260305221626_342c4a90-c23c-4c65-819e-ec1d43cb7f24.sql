
-- Create serp_monitors table
CREATE TABLE public.serp_monitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  engine TEXT NOT NULL DEFAULT 'google',
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency TEXT NOT NULL DEFAULT 'daily',
  last_checked_at TIMESTAMPTZ,
  last_results_hash TEXT,
  notify_on_change BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create serp_monitor_results table
CREATE TABLE public.serp_monitor_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES public.serp_monitors(id) ON DELETE CASCADE,
  results_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.serp_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serp_monitor_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for serp_monitors
CREATE POLICY "Users can manage their own monitors"
  ON public.serp_monitors FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for serp_monitor_results (via monitor ownership)
CREATE POLICY "Users can view their own monitor results"
  ON public.serp_monitor_results FOR SELECT
  TO authenticated
  USING (monitor_id IN (SELECT id FROM public.serp_monitors WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own monitor results"
  ON public.serp_monitor_results FOR INSERT
  TO authenticated
  WITH CHECK (monitor_id IN (SELECT id FROM public.serp_monitors WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own monitor results"
  ON public.serp_monitor_results FOR DELETE
  TO authenticated
  USING (monitor_id IN (SELECT id FROM public.serp_monitors WHERE user_id = auth.uid()));

-- Updated_at trigger for serp_monitors
CREATE TRIGGER update_serp_monitors_updated_at
  BEFORE UPDATE ON public.serp_monitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
