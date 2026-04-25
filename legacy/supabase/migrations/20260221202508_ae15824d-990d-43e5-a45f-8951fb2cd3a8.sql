
-- Fix the overly permissive INSERT policy
DROP POLICY "Service can insert insights" ON public.ai_insights;

CREATE POLICY "Users can insert their own insights"
  ON public.ai_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);
