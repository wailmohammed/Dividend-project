CREATE TABLE public.halal_planner (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  monthly_expenses numeric NOT NULL DEFAULT 0,
  emergency_months integer NOT NULL DEFAULT 6,
  emergency_saved numeric NOT NULL DEFAULT 0,
  monthly_invest numeric NOT NULL DEFAULT 0,
  invest_years integer NOT NULL DEFAULT 20,
  expected_return numeric NOT NULL DEFAULT 7,
  completed_steps integer[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.halal_planner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own halal planner"
ON public.halal_planner FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER halal_planner_updated_at
BEFORE UPDATE ON public.halal_planner
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();