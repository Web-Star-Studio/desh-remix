
-- Social Profiles (Late Profile <-> DESH Workspace mapping)
CREATE TABLE public.social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  late_profile_id text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, late_profile_id)
);

ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own social_profiles"
  ON public.social_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Social Accounts (cached connected accounts)
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES social_profiles(id) ON DELETE CASCADE,
  late_account_id text NOT NULL,
  platform text NOT NULL,
  username text,
  avatar_url text,
  current_followers integer DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, late_account_id)
);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own social_accounts"
  ON public.social_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Social Posts (local mirror)
CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  late_post_id text,
  content text NOT NULL DEFAULT '',
  status text DEFAULT 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  platforms jsonb DEFAULT '[]'::jsonb,
  media_items jsonb DEFAULT '[]'::jsonb,
  analytics jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own social_posts"
  ON public.social_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update trigger for social_posts
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
