
-- Create alert_history table to track all triggered alerts with notification status
CREATE TABLE public.alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_id UUID REFERENCES public.portfolio_alerts(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  threshold_percent NUMERIC,
  trigger_value NUMERIC,
  trigger_details TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notification_email_sent BOOLEAN DEFAULT false,
  notification_webhook_sent BOOLEAN DEFAULT false,
  notification_push_sent BOOLEAN DEFAULT false,
  notification_sms_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own alert history"
  ON public.alert_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert history"
  ON public.alert_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can also insert (from edge functions)
CREATE POLICY "Service role can insert alert history"
  ON public.alert_history FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_alert_history_user_triggered ON public.alert_history(user_id, triggered_at DESC);
CREATE INDEX idx_alert_history_symbol ON public.alert_history(symbol);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_history;
