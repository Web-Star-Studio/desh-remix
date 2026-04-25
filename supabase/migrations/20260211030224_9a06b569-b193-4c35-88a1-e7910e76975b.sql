
-- Create user_data table for persistent widget data
CREATE TABLE public.user_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on data_type for faster queries
CREATE INDEX idx_user_data_type ON public.user_data(data_type);

-- Enable RLS
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Open RLS policies (no auth for now)
CREATE POLICY "Anyone can read user_data" ON public.user_data FOR SELECT USING (true);
CREATE POLICY "Anyone can insert user_data" ON public.user_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update user_data" ON public.user_data FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete user_data" ON public.user_data FOR DELETE USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_data_updated_at
BEFORE UPDATE ON public.user_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
