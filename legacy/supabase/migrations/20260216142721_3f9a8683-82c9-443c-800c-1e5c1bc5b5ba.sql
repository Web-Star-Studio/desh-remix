-- Add action_url column to broadcasts
ALTER TABLE public.broadcasts ADD COLUMN action_url text DEFAULT NULL;

-- Update the SELECT policy to allow authenticated users to read all broadcasts (for notifications page)
DROP POLICY IF EXISTS "Anyone can read active broadcasts" ON public.broadcasts;
CREATE POLICY "Authenticated users can read broadcasts"
ON public.broadcasts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow users to delete their own dismissals (for undismiss feature)
DROP POLICY IF EXISTS "Users can delete dismissals" ON public.broadcast_dismissals;
CREATE POLICY "Users can delete dismissals"
ON public.broadcast_dismissals
FOR DELETE
USING (auth.uid() = user_id);