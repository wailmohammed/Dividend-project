
-- Create table for persisting monthly dividend income snapshots
CREATE TABLE public.dividend_income_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month TEXT NOT NULL, -- Format: YYYY-MM
  monthly_income NUMERIC NOT NULL DEFAULT 0,
  annual_income NUMERIC NOT NULL DEFAULT 0,
  average_yield NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Enable RLS
ALTER TABLE public.dividend_income_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own income snapshots"
ON public.dividend_income_snapshots
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_dividend_income_snapshots_updated_at
BEFORE UPDATE ON public.dividend_income_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
