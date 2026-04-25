-- Add UPDATE policy for email_cleanup_sessions
CREATE POLICY "Users can update their own cleanup sessions"
ON public.email_cleanup_sessions
FOR UPDATE
USING (auth.uid() = user_id);