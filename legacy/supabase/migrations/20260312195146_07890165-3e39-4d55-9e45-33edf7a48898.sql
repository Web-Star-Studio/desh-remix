
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS stripe_coupon_id text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS stripe_promotion_code_id text;

-- Update redeem_coupon to return stripe_promotion_code_id for percent coupons
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  coupon_row RECORD;
  uid uuid;
  already_redeemed boolean;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO coupon_row
  FROM public.coupons
  WHERE upper(code) = upper(_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_not_found');
  END IF;

  IF NOT coupon_row.active THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_inactive');
  END IF;

  IF coupon_row.expires_at IS NOT NULL AND coupon_row.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_expired');
  END IF;

  IF coupon_row.max_uses IS NOT NULL AND coupon_row.used_count >= coupon_row.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_max_uses_reached');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = coupon_row.id AND user_id = uid
  ) INTO already_redeemed;

  IF already_redeemed THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Apply coupon based on type
  IF coupon_row.type = 'credits' THEN
    PERFORM public.add_credits(uid, coupon_row.value, 'coupon_redeem', 'Cupom: ' || coupon_row.code);
  END IF;
  -- For percent type, no credits are added — discount is applied at checkout

  -- Record redemption
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, credits_granted)
  VALUES (coupon_row.id, uid, CASE WHEN coupon_row.type = 'credits' THEN coupon_row.value ELSE 0 END);

  -- Increment used_count
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = coupon_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'type', coupon_row.type,
    'value', coupon_row.value,
    'code', coupon_row.code,
    'stripe_promotion_code_id', coupon_row.stripe_promotion_code_id
  );
END;
$function$;
