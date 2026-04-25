
CREATE TABLE public.connections (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read connections"
  ON public.connections FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert connections"
  ON public.connections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete connections"
  ON public.connections FOR DELETE
  USING (true);

CREATE POLICY "Anyone can update connections"
  ON public.connections FOR UPDATE
  USING (true);
