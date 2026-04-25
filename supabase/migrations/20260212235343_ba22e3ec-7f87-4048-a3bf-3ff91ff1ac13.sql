
-- Broadcasts table for admin announcements
CREATE TABLE public.broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active broadcasts
CREATE POLICY "Anyone can read active broadcasts"
ON public.broadcasts
FOR SELECT
TO authenticated
USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- Only admins can insert
CREATE POLICY "Admins can insert broadcasts"
ON public.broadcasts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can update (e.g. deactivate)
CREATE POLICY "Admins can update broadcasts"
ON public.broadcasts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete broadcasts"
ON public.broadcasts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Table to track dismissed broadcasts per user
CREATE TABLE public.broadcast_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(broadcast_id, user_id)
);

ALTER TABLE public.broadcast_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dismissals"
ON public.broadcast_dismissals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss broadcasts"
ON public.broadcast_dismissals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
