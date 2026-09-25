
-- Create portfolio_updates table for tracking significant holding changes
CREATE TABLE public.portfolio_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  update_type TEXT NOT NULL, -- 'earnings_surprise', 'dividend_change', 'rating_upgrade', 'rating_downgrade', 'price_target_change', 'insider_trade'
  title TEXT NOT NULL,
  summary TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  significance TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_updates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own portfolio updates"
  ON public.portfolio_updates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own portfolio updates"
  ON public.portfolio_updates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own portfolio updates"
  ON public.portfolio_updates FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert portfolio updates"
  ON public.portfolio_updates FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_portfolio_updates_user_created ON public.portfolio_updates (user_id, created_at DESC);
CREATE INDEX idx_portfolio_updates_symbol ON public.portfolio_updates (symbol);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_updates;
