
-- Add RLS policies for email_rate_limits table
CREATE POLICY "Users can view their own rate limits"
ON public.email_rate_limits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate limits"
ON public.email_rate_limits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rate limits"
ON public.email_rate_limits
FOR DELETE
USING (auth.uid() = user_id);
