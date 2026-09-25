
CREATE TABLE public.halal_stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'Unknown',
  price NUMERIC NOT NULL DEFAULT 0,
  dividend_yield NUMERIC DEFAULT 0,
  pe_ratio NUMERIC DEFAULT NULL,
  market_cap NUMERIC DEFAULT NULL,
  compliance_grade TEXT NOT NULL DEFAULT 'C',
  debt_to_market_cap NUMERIC DEFAULT NULL,
  cash_to_market_cap NUMERIC DEFAULT NULL,
  receivables_to_market_cap NUMERIC DEFAULT NULL,
  non_permissible_revenue_pct NUMERIC DEFAULT 0,
  business_screen_passed BOOLEAN DEFAULT true,
  financial_screen_passed BOOLEAN DEFAULT true,
  overall_compliant BOOLEAN DEFAULT true,
  purification_per_share NUMERIC DEFAULT 0,
  screening_notes TEXT DEFAULT NULL,
  screened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symbol)
);

ALTER TABLE public.halal_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view halal stocks"
  ON public.halal_stocks
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage halal stocks"
  ON public.halal_stocks
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_halal_stocks_updated_at
  BEFORE UPDATE ON public.halal_stocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
