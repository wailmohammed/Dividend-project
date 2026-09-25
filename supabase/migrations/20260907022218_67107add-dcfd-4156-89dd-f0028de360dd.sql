ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS target_allocation numeric;

CREATE TABLE IF NOT EXISTS public.dividend_safety_ratings (
  symbol text PRIMARY KEY,
  name text,
  score integer NOT NULL DEFAULT 50,
  grade text NOT NULL DEFAULT 'C',
  payout_ratio numeric,
  coverage_ratio numeric,
  growth_streak integer DEFAULT 0,
  five_yr_growth numeric,
  dividend_yield numeric,
  annual_dividend numeric,
  frequency text,
  last_ex_date date,
  next_ex_date date,
  next_pay_date date,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dividend_safety_ratings TO anon;
GRANT SELECT ON public.dividend_safety_ratings TO authenticated;
GRANT ALL ON public.dividend_safety_ratings TO service_role;

ALTER TABLE public.dividend_safety_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dividend safety ratings are public" ON public.dividend_safety_ratings;
CREATE POLICY "Dividend safety ratings are public"
  ON public.dividend_safety_ratings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dividend_safety_next_ex ON public.dividend_safety_ratings (next_ex_date);