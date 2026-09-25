
CREATE TABLE public.proof_of_wealth (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  net_worth NUMERIC NOT NULL DEFAULT 0,
  total_assets NUMERIC NOT NULL DEFAULT 0,
  total_liabilities NUMERIC NOT NULL DEFAULT 0,
  holdings_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  views_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proof_of_wealth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own proofs" ON public.proof_of_wealth
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view active non-expired proofs" ON public.proof_of_wealth
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
