-- Create watchlist table
CREATE TABLE public.watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  target_price NUMERIC,
  alert_enabled BOOLEAN DEFAULT false,
  UNIQUE(user_id, symbol)
);

-- Enable Row Level Security
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can manage their own watchlist items"
ON public.watchlist
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_watchlist_user_id ON public.watchlist(user_id);