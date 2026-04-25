
-- 1. Fix file_share_links: Remove overly permissive anon policy, replace with token-specific policy
DROP POLICY IF EXISTS "Anyone can read active share links by token" ON public.file_share_links;

CREATE POLICY "Read share link by specific token"
ON public.file_share_links
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND token = current_setting('request.headers', true)::json->>'x-share-token'
);

-- 2. Fix coop_missions broken RLS policy (self-referential join bug)
DROP POLICY IF EXISTS "Members can read missions" ON public.coop_missions;

CREATE POLICY "Members can read missions"
ON public.coop_missions
FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.coop_mission_members
    WHERE coop_mission_members.mission_id = coop_missions.id
      AND coop_mission_members.user_id = auth.uid()
  )
);

-- 3. Fix has_role function to use the _user_id parameter correctly
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
