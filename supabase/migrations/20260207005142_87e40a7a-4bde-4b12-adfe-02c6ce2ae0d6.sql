
-- Fix overly permissive service role insert policy
DROP POLICY "Service role can insert alert history" ON public.alert_history;
