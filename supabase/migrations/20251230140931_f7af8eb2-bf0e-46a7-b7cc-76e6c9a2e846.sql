-- Create social features tables

-- User followers table
CREATE TABLE public.user_followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Shared portfolios table
CREATE TABLE public.shared_portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_code TEXT UNIQUE,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Community posts table
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  tickers TEXT[] DEFAULT '{}',
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Post likes table
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Post comments table
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tax lots table for tracking cost basis
CREATE TABLE public.tax_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  portfolio_id UUID NOT NULL,
  holding_id UUID,
  symbol TEXT NOT NULL,
  shares NUMERIC NOT NULL,
  cost_basis NUMERIC NOT NULL,
  purchase_date DATE NOT NULL,
  sale_date DATE,
  sale_price NUMERIC,
  realized_gain_loss NUMERIC,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  lot_type TEXT NOT NULL DEFAULT 'buy',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_lots ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_followers
CREATE POLICY "Users can view all followers" ON public.user_followers
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON public.user_followers
  FOR ALL USING (follower_id = auth.uid())
  WITH CHECK (follower_id = auth.uid());

-- RLS policies for shared_portfolios
CREATE POLICY "Users can view public portfolios" ON public.shared_portfolios
  FOR SELECT USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can manage their own shared portfolios" ON public.shared_portfolios
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for community_posts
CREATE POLICY "Anyone can view posts" ON public.community_posts
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own posts" ON public.community_posts
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for post_likes
CREATE POLICY "Anyone can view likes" ON public.post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON public.post_likes
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for post_comments
CREATE POLICY "Anyone can view comments" ON public.post_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own comments" ON public.post_comments
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS policies for tax_lots
CREATE POLICY "Users can manage their own tax lots" ON public.tax_lots
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_user_followers_follower ON public.user_followers(follower_id);
CREATE INDEX idx_user_followers_following ON public.user_followers(following_id);
CREATE INDEX idx_community_posts_user ON public.community_posts(user_id);
CREATE INDEX idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX idx_tax_lots_user ON public.tax_lots(user_id);
CREATE INDEX idx_tax_lots_symbol ON public.tax_lots(symbol);
CREATE INDEX idx_tax_lots_portfolio ON public.tax_lots(portfolio_id);