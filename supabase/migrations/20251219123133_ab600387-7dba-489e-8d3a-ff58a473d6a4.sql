-- Create price_alerts table
CREATE TABLE public.price_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  target_price NUMERIC NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own alerts
CREATE POLICY "Users can manage their own price alerts"
ON public.price_alerts
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_price_alerts_updated_at
BEFORE UPDATE ON public.price_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create portfolio_snapshots table for performance tracking
CREATE TABLE public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_value NUMERIC NOT NULL,
  cash_balance NUMERIC DEFAULT 0,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can manage their portfolio snapshots
CREATE POLICY "Users can manage their portfolio snapshots"
ON public.portfolio_snapshots
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create unique index on portfolio_id + snapshot_date
CREATE UNIQUE INDEX idx_portfolio_snapshots_unique ON public.portfolio_snapshots(portfolio_id, snapshot_date);