CREATE TABLE public.dividend_safety_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  score integer NOT NULL,
  grade text NOT NULL,
  dividend_yield numeric,
  annual_dividend numeric,
  recorded_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, recorded_on)
);
GRANT SELECT ON public.dividend_safety_history TO anon, authenticated;
GRANT ALL ON public.dividend_safety_history TO service_role;
ALTER TABLE public.dividend_safety_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read safety history" ON public.dividend_safety_history FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.record_dividend_safety_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO dividend_safety_history (symbol, score, grade, dividend_yield, annual_dividend)
  VALUES (NEW.symbol, NEW.score, NEW.grade, NEW.dividend_yield, NEW.annual_dividend)
  ON CONFLICT (symbol, recorded_on) DO UPDATE SET score = EXCLUDED.score, grade = EXCLUDED.grade,
    dividend_yield = EXCLUDED.dividend_yield, annual_dividend = EXCLUDED.annual_dividend;

  IF TG_OP = 'UPDATE' AND OLD.grade IS DISTINCT FROM NEW.grade THEN
    INSERT INTO portfolio_updates (user_id, symbol, update_type, title, summary, details, significance)
    SELECT DISTINCT p.user_id, NEW.symbol, 'safety_change',
      NEW.symbol || ' dividend safety ' || CASE WHEN NEW.score < OLD.score THEN 'dropped' ELSE 'improved' END || ': ' || OLD.grade || ' → ' || NEW.grade,
      'Score moved from ' || OLD.score || ' to ' || NEW.score || '. ' || COALESCE((SELECT string_agg(x, '; ') FROM jsonb_array_elements_text(NEW.risks) x), ''),
      jsonb_build_object('old_score', OLD.score, 'new_score', NEW.score, 'old_grade', OLD.grade, 'new_grade', NEW.grade),
      CASE WHEN NEW.score < OLD.score THEN 'high' ELSE 'medium' END
    FROM holdings h JOIN portfolios p ON p.id = h.portfolio_id
    WHERE upper(h.symbol) = NEW.symbol AND h.shares > 0;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_dividend_safety_change() FROM anon, authenticated, public;

CREATE TRIGGER trg_dividend_safety_change AFTER INSERT OR UPDATE ON public.dividend_safety_ratings
FOR EACH ROW EXECUTE FUNCTION public.record_dividend_safety_change();

INSERT INTO public.dividend_safety_history (symbol, score, grade, dividend_yield, annual_dividend, recorded_on)
SELECT symbol, score, grade, dividend_yield, annual_dividend, updated_at::date FROM public.dividend_safety_ratings
ON CONFLICT DO NOTHING;