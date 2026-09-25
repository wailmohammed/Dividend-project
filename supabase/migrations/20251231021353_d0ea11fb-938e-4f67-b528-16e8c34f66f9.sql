-- Create market_data_cache table to store cached price data
CREATE TABLE public.market_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change NUMERIC DEFAULT 0,
  change_percent NUMERIC DEFAULT 0,
  dividend_yield NUMERIC DEFAULT 0,
  sector TEXT,
  volume NUMERIC,
  market_cap NUMERIC,
  high_52w NUMERIC,
  low_52w NUMERIC,
  pe_ratio NUMERIC,
  eps NUMERIC,
  source TEXT NOT NULL DEFAULT 'api',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symbol)
);

-- Create index for faster lookups
CREATE INDEX idx_market_data_cache_symbol ON public.market_data_cache(symbol);
CREATE INDEX idx_market_data_cache_updated_at ON public.market_data_cache(updated_at);

-- Enable RLS but allow read access to all authenticated users
ALTER TABLE public.market_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market data cache"
ON public.market_data_cache
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage market data cache"
ON public.market_data_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create drip_transactions table to track dividend reinvestments
CREATE TABLE public.drip_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  portfolio_id UUID NOT NULL,
  holding_id UUID,
  symbol TEXT NOT NULL,
  dividend_amount NUMERIC NOT NULL,
  shares_purchased NUMERIC NOT NULL,
  purchase_price NUMERIC NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drip_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own DRIP transactions"
ON public.drip_transactions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create portfolio_alerts table for price/dividend/earnings alerts
CREATE TABLE public.portfolio_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'price_movement', 'dividend_cut', 'earnings_surprise', 'dividend_increase'
  threshold_percent NUMERIC, -- for price movements
  is_active BOOLEAN NOT NULL DEFAULT true,
  triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own portfolio alerts"
ON public.portfolio_alerts
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create market_sync_logs table to track API sync operations
CREATE TABLE public.market_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'scheduled', 'manual', 'on_demand'
  symbols_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.market_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
ON public.market_sync_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Service role can manage sync logs"
ON public.market_sync_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger to update updated_at on market_data_cache
CREATE TRIGGER update_market_data_cache_updated_at
  BEFORE UPDATE ON public.market_data_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on portfolio_alerts  
CREATE TRIGGER update_portfolio_alerts_updated_at
  BEFORE UPDATE ON public.portfolio_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();