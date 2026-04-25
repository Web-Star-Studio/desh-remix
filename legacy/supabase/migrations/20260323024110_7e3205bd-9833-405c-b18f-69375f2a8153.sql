
-- Trigger to dispatch file analysis on INSERT
CREATE OR REPLACE FUNCTION public.dispatch_file_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  service_key text;
BEGIN
  -- Only dispatch for non-trashed files that haven't been analyzed yet
  IF NEW.is_trashed OR NEW.ocr_status != 'pending' THEN
    RETURN NEW;
  END IF;

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
      url := base_url || '/functions/v1/data-ai',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'type', 'files',
        'action', 'auto_categorize',
        'fileId', NEW.id,
        'fileName', NEW.name,
        'fileType', NEW.mime_type,
        'fileSize', NEW.size_bytes::text,
        'userId', NEW.user_id::text
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_file_insert_analyze
  AFTER INSERT ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_file_analysis();
