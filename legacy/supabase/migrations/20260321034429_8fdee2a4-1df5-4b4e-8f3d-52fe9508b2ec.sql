-- Fix coop_missions SELECT policy: self-referential bug
-- Drop the broken policy and recreate with correct join condition

DROP POLICY IF EXISTS "Users can view missions they created or joined" ON public.coop_missions;

CREATE POLICY "Users can view missions they created or joined"
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