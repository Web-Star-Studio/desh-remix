
-- =============================================
-- 1. Função admin_grant_credits
-- =============================================
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  _target_user_id uuid,
  _amount numeric,
  _reason text DEFAULT 'Créditos adicionados pelo admin'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Add credits using existing function
  PERFORM public.add_credits(_target_user_id, _amount, 'admin_grant', _reason);

  -- Get caller email for audit log
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();

  -- Log the action
  INSERT INTO public.admin_logs (user_id, user_email, action, details)
  VALUES (
    auth.uid(),
    caller_email,
    'admin_grant_credits',
    jsonb_build_object(
      'target_user_id', _target_user_id,
      'amount', _amount,
      'reason', _reason
    )
  );
END;
$$;

-- =============================================
-- 2. Tabela coupons
-- =============================================
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL,
  type text NOT NULL DEFAULT 'credits',
  value numeric NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique index on upper(code) for case-insensitive uniqueness
CREATE UNIQUE INDEX coupons_code_unique ON public.coupons (upper(code));

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Admins full CRUD
CREATE POLICY "Admins can manage coupons"
  ON public.coupons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read active coupons (to validate codes)
CREATE POLICY "Authenticated users can read coupons"
  ON public.coupons FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- 3. Tabela coupon_redemptions
-- =============================================
CREATE TABLE public.coupon_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  credits_granted numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own redemptions"
  ON public.coupon_redemptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all redemptions
CREATE POLICY "Admins can read all redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 4. Função redeem_coupon
-- =============================================
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  coupon_row RECORD;
  uid uuid;
  already_redeemed boolean;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Find the coupon
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

  -- Check if user already redeemed
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = coupon_row.id AND user_id = uid
  ) INTO already_redeemed;

  IF already_redeemed THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Apply coupon
  IF coupon_row.type = 'credits' THEN
    PERFORM public.add_credits(uid, coupon_row.value, 'coupon_redeem', 'Cupom: ' || coupon_row.code);
  END IF;

  -- Record redemption
  INSERT INTO public.coupon_redemptions (coupon_id, user_id, credits_granted)
  VALUES (coupon_row.id, uid, CASE WHEN coupon_row.type = 'credits' THEN coupon_row.value ELSE 0 END);

  -- Increment used_count
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = coupon_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'type', coupon_row.type,
    'value', coupon_row.value,
    'code', coupon_row.code
  );
END;
$$;
