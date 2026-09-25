
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS federal_tax_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS dividend_tax_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualified_dividend_rate numeric DEFAULT 0;
