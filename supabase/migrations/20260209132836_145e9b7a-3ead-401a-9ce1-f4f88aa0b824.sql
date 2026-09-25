-- Add UPDATE policy for alert_history so users can acknowledge/snooze their own alerts
CREATE POLICY "Users can update their own alert history"
ON public.alert_history
FOR UPDATE
USING (auth.uid() = user_id);
