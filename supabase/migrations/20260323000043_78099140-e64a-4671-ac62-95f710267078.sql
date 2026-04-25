
-- Enable pg_net extension for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Tool jobs queue table
CREATE TABLE public.tool_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  batch_id uuid NOT NULL,
  conversation_id text,
  tool_name text NOT NULL,
  tool_args jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  result text,
  error text,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.tool_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jobs" ON public.tool_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own jobs" ON public.tool_jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_tool_jobs_batch ON public.tool_jobs(batch_id);
CREATE INDEX idx_tool_jobs_status ON public.tool_jobs(status) WHERE status = 'pending';
CREATE INDEX idx_tool_jobs_user_batch ON public.tool_jobs(user_id, batch_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_jobs;

-- Trigger to dispatch worker via pg_net
CREATE OR REPLACE FUNCTION public.dispatch_tool_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  base_url text;
  service_key text;
BEGIN
  base_url := current_setting('supabase.url', true);
  service_key := current_setting('supabase.service_role_key', true);
  
  IF base_url IS NULL THEN
    base_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1);
  END IF;
  IF service_key IS NULL THEN
    service_key := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1);
  END IF;

  IF base_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := base_url || '/functions/v1/tool-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object('job_id', NEW.id, 'user_id', NEW.user_id)::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tool_job_insert
  AFTER INSERT ON public.tool_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_tool_job();
