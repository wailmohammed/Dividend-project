-- Table: holding_categories - persists user strategy category overrides per holding
CREATE TABLE public.holding_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Growth',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

-- Enable RLS
ALTER TABLE public.holding_categories ENABLE ROW LEVEL SECURITY;

-- Users can manage their own categories
CREATE POLICY "Users can manage their own categories"
  ON public.holding_categories
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_holding_categories_updated_at
  BEFORE UPDATE ON public.holding_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Make shared_portfolios publicly browsable for community feature
CREATE POLICY "Anyone can view public shared portfolios"
  ON public.shared_portfolios
  FOR SELECT
  TO anon
  USING (is_public = true);
