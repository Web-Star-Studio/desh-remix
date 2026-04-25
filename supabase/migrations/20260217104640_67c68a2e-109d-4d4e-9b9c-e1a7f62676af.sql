
-- Gamification state: one row per user
CREATE TABLE public.gamification_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  total_xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  area_xp jsonb NOT NULL DEFAULT '{}'::jsonb,
  area_levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  streaks jsonb NOT NULL DEFAULT '{}'::jsonb,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  avatar jsonb NOT NULL DEFAULT '{"icon": "⚔️", "title": "Aventureiro"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gamification_state_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.gamification_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own gamification state"
  ON public.gamification_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gamification state"
  ON public.gamification_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gamification state"
  ON public.gamification_state FOR UPDATE
  USING (auth.uid() = user_id);

-- XP log: history of XP gains
CREATE TABLE public.xp_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  area text NOT NULL,
  source text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own xp log"
  ON public.xp_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own xp log"
  ON public.xp_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at on gamification_state
CREATE TRIGGER update_gamification_state_updated_at
  BEFORE UPDATE ON public.gamification_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
