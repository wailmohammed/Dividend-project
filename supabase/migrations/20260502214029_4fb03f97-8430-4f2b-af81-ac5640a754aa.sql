
CREATE TABLE public.options_flow_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.options_flow_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own options flow presets" ON public.options_flow_presets
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_ofp_updated BEFORE UPDATE ON public.options_flow_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.analysis_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  note TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
ALTER TABLE public.analysis_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own analysis watchlist" ON public.analysis_watchlist
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_aw_updated BEFORE UPDATE ON public.analysis_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
