-- Add tax notification preferences
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS email_tax_alerts boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_tax_alerts boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS push_tax_alerts boolean NOT NULL DEFAULT true;