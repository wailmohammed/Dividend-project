-- Fix overflow for high-dividend stocks (e.g. > 10%)
-- Existing column appears to have too-small precision causing "numeric field overflow"
ALTER TABLE public.holdings
ALTER COLUMN dividend_yield TYPE numeric(12,6)
USING dividend_yield::numeric;