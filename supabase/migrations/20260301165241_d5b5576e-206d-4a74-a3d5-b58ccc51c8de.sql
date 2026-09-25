
-- Investment thesis tracker (Simply Wall St Narratives-style)
CREATE TABLE public.investment_theses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  holding_id UUID REFERENCES public.holdings(id) ON DELETE SET NULL,
  thesis TEXT NOT NULL DEFAULT '',
  fair_value NUMERIC,
  conviction TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.investment_theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own theses"
ON public.investment_theses
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_investment_theses_updated_at
BEFORE UPDATE ON public.investment_theses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX idx_investment_theses_user_symbol ON public.investment_theses(user_id, symbol);
