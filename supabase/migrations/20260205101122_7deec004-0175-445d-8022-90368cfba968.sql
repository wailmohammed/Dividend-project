-- Add portfolio alert notification columns to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS email_portfolio_alerts boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_portfolio_alerts boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS push_portfolio_alerts boolean NOT NULL DEFAULT true;