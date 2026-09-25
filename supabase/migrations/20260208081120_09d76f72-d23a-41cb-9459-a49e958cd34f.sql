-- Add snooze and acknowledgment columns to alert_history
ALTER TABLE public.alert_history
ADD COLUMN is_acknowledged boolean NOT NULL DEFAULT false,
ADD COLUMN acknowledged_at timestamptz,
ADD COLUMN is_snoozed boolean NOT NULL DEFAULT false,
ADD COLUMN snoozed_until timestamptz,
ADD COLUMN snooze_reason text;

-- Index for filtering active (non-snoozed, non-acknowledged) alerts
CREATE INDEX idx_alert_history_status ON public.alert_history (user_id, is_acknowledged, is_snoozed);
