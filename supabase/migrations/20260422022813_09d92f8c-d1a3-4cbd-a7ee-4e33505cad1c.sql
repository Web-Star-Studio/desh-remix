
ALTER TABLE public.whatsapp_send_logs
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_payload jsonb;

-- Backfill delivery_status from current 'status' so the UI has a sensible default
UPDATE public.whatsapp_send_logs
SET delivery_status = CASE
  WHEN status = 'success' THEN 'sent'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'sent'
END
WHERE delivery_status IS NULL;

-- Index for filtering by delivery_status on the history page
CREATE INDEX IF NOT EXISTS idx_wa_send_logs_delivery_status
  ON public.whatsapp_send_logs (user_id, delivery_status, created_at DESC);

-- Validation trigger (avoid CHECK constraint to allow gradual evolution)
CREATE OR REPLACE FUNCTION public.validate_wa_send_log_delivery_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_status IS NOT NULL
     AND NEW.delivery_status NOT IN ('queued','sent','delivered','read','failed') THEN
    RAISE EXCEPTION 'Invalid delivery_status: %', NEW.delivery_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_wa_send_log_delivery_status ON public.whatsapp_send_logs;
CREATE TRIGGER trg_validate_wa_send_log_delivery_status
  BEFORE INSERT OR UPDATE ON public.whatsapp_send_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_wa_send_log_delivery_status();

-- Realtime
ALTER TABLE public.whatsapp_send_logs REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_send_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_send_logs;
  END IF;
END $$;
