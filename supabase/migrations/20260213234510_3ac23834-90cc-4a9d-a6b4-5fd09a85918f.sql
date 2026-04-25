
CREATE TABLE public.finance_recurring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  category TEXT NOT NULL DEFAULT 'Outros',
  day_of_month INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own recurring" ON public.finance_recurring FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recurring" ON public.finance_recurring FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurring" ON public.finance_recurring FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurring" ON public.finance_recurring FOR DELETE USING (auth.uid() = user_id);
