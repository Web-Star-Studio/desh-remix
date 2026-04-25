
CREATE TABLE public.social_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  business_description TEXT DEFAULT '',
  niche TEXT DEFAULT '',
  target_audience JSONB DEFAULT '{}',
  brand_voice TEXT DEFAULT 'casual',
  persona_name TEXT DEFAULT '',
  persona_description TEXT DEFAULT '',
  content_pillars JSONB DEFAULT '[]',
  goals JSONB DEFAULT '{}',
  competitors JSONB DEFAULT '[]',
  differentials TEXT DEFAULT '',
  keywords JSONB DEFAULT '[]',
  restrictions TEXT DEFAULT '',
  posting_frequency TEXT DEFAULT '',
  preferred_formats JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, profile_id)
);

ALTER TABLE public.social_brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own brand profiles"
  ON public.social_brand_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_social_brand_profiles_updated_at
  BEFORE UPDATE ON public.social_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
