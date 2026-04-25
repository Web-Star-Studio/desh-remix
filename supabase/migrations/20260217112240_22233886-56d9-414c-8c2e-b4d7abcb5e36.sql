
-- Friend code on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_code text UNIQUE;
UPDATE public.profiles SET friend_code = upper(substr(md5(random()::text || user_id::text), 1, 8)) WHERE friend_code IS NULL;

CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.friend_code IS NULL THEN
    NEW.friend_code := upper(substr(md5(random()::text || NEW.user_id::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_friend_code BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.generate_friend_code();

-- ========== CREATE ALL TABLES FIRST ==========

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coop_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT '⚔️',
  mission_type text NOT NULL DEFAULT 'shared',
  area text DEFAULT 'produtividade',
  target_value integer NOT NULL DEFAULT 100,
  xp_reward integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coop_missions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coop_mission_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.coop_missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_progress integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(mission_id, user_id)
);
ALTER TABLE public.coop_mission_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coop_mission_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.coop_missions(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mission_id, to_user_id)
);
ALTER TABLE public.coop_mission_invites ENABLE ROW LEVEL SECURITY;

-- ========== NOW CREATE ALL POLICIES ==========

-- Friendships
CREATE POLICY "Users can read own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Friend requests
CREATE POLICY "Users can read own friend requests" ON public.friend_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can send friend requests" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can update requests to them" ON public.friend_requests FOR UPDATE USING (auth.uid() = to_user_id);
CREATE POLICY "Users can delete own requests" ON public.friend_requests FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Coop missions
CREATE POLICY "Members can read missions" ON public.coop_missions FOR SELECT USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM public.coop_mission_members WHERE mission_id = id AND user_id = auth.uid()));
CREATE POLICY "Users can create missions" ON public.coop_missions FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator can update missions" ON public.coop_missions FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creator can delete missions" ON public.coop_missions FOR DELETE USING (auth.uid() = creator_id);

-- Coop mission members
CREATE POLICY "Members can read members" ON public.coop_mission_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.coop_mission_members m2 WHERE m2.mission_id = coop_mission_members.mission_id AND m2.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.coop_missions WHERE id = coop_mission_members.mission_id AND creator_id = auth.uid()));
CREATE POLICY "Users can join missions" ON public.coop_mission_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.coop_mission_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave missions" ON public.coop_mission_members FOR DELETE USING (auth.uid() = user_id);

-- Coop mission invites
CREATE POLICY "Users can read own invites" ON public.coop_mission_invites FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can send invites" ON public.coop_mission_invites FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Recipient can update invite" ON public.coop_mission_invites FOR UPDATE USING (auth.uid() = to_user_id);
CREATE POLICY "Users can delete own invites" ON public.coop_mission_invites FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- ========== HELPER FUNCTIONS ==========

CREATE OR REPLACE FUNCTION public.find_user_by_friend_code(_code text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object('user_id', p.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url) INTO result
  FROM public.profiles p WHERE p.friend_code = upper(_code) AND p.user_id != auth.uid();
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result json; found_user_id uuid;
BEGIN
  SELECT id INTO found_user_id FROM auth.users WHERE email = lower(_email) AND id != auth.uid();
  IF found_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT json_build_object('user_id', p.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url) INTO result
  FROM public.profiles p WHERE p.user_id = found_user_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req RECORD;
BEGIN
  SELECT * INTO req FROM public.friend_requests WHERE id = _request_id AND to_user_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  UPDATE public.friend_requests SET status = 'accepted', updated_at = now() WHERE id = _request_id;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (req.from_user_id, req.to_user_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (req.to_user_id, req.from_user_id) ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_mission_invite(_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.coop_mission_invites WHERE id = _invite_id AND to_user_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  UPDATE public.coop_mission_invites SET status = 'accepted' WHERE id = _invite_id;
  INSERT INTO public.coop_mission_members (mission_id, user_id) VALUES (inv.mission_id, auth.uid()) ON CONFLICT DO NOTHING;
END;
$$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.coop_mission_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coop_mission_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
