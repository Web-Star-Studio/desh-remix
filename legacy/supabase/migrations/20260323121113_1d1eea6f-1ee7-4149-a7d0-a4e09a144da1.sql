CREATE OR REPLACE FUNCTION public.dispatch_file_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_url text;
  service_key text;
BEGIN
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
      body := jsonb_build_object(
        'type', 'files',
        'action', 'auto_categorize',
        'fileId', NEW.id,
        'fileName', NEW.name,
        'fileType', NEW.mime_type,
        'fileSize', NEW.size_bytes::text,
        'userId', NEW.user_id::text
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      timeout_milliseconds := 30000
    );
  END IF;

  RETURN NEW;
END;
$function$;