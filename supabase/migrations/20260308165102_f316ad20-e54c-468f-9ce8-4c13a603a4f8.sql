
DROP POLICY IF EXISTS "Anyone can view halal stocks" ON public.halal_stocks;
DROP POLICY IF EXISTS "Service role can manage halal stocks" ON public.halal_stocks;

CREATE POLICY "Anyone can view halal stocks"
ON public.halal_stocks
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage halal stocks"
ON public.halal_stocks
FOR ALL
USING (true)
WITH CHECK (true);
