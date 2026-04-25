CREATE OR REPLACE FUNCTION public.expire_inactive_whatsapp_sessions(p_threshold_minutes integer DEFAULT 5)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.whatsapp_web_sessions
  SET
    status     = 'DISCONNECTED',
    last_error = format(
      'Auto-expired: no heartbeat for more than %s minute(s). Last update: %s',
      p_threshold_minutes,
      updated_at
    ),
    updated_at = now()
  WHERE
    status IN ('CONNECTED', 'QR_PENDING')
    AND updated_at < now() - (p_threshold_minutes || ' minutes')::interval;

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  IF expired_count > 0 THEN
    RAISE LOG '[wa-session-expiry] Expired % session(s) (threshold: % min)', expired_count, p_threshold_minutes;
  END IF;

  RETURN expired_count;
END;
$function$;