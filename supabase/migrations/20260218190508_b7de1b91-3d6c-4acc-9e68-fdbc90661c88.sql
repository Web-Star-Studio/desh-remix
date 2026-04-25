
-- Create user_gateway_api_keys table
CREATE TABLE public.user_gateway_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  label text NOT NULL DEFAULT 'Gateway Principal',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Enable RLS
ALTER TABLE public.user_gateway_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read their own API keys"
ON public.user_gateway_api_keys FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
ON public.user_gateway_api_keys FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
ON public.user_gateway_api_keys FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
ON public.user_gateway_api_keys FOR DELETE
USING (auth.uid() = user_id);

-- RPC function to generate a gateway API key (SECURITY DEFINER to allow SHA-256)
CREATE OR REPLACE FUNCTION public.generate_gateway_api_key(_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_key text;
  hashed_key text;
  prefix text;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Generate: desh_ + 32 random hex chars
  raw_key := 'desh_' || encode(gen_random_bytes(16), 'hex');
  prefix := left(raw_key, 16);

  -- SHA-256 hash stored in hex
  hashed_key := encode(digest(raw_key, 'sha256'), 'hex');

  INSERT INTO public.user_gateway_api_keys (user_id, key_hash, key_prefix, label)
  VALUES (uid, hashed_key, prefix, _label);

  -- Return raw key ONE TIME ONLY
  RETURN raw_key;
END;
$$;

-- RPC function to revoke a key
CREATE OR REPLACE FUNCTION public.revoke_gateway_api_key(_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_gateway_api_keys
  SET revoked_at = now()
  WHERE id = _key_id AND user_id = auth.uid();
END;
$$;
