-- Create notification_preferences table for user email/SMS preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email notification preferences
  email_price_alerts BOOLEAN NOT NULL DEFAULT true,
  email_dividend_alerts BOOLEAN NOT NULL DEFAULT true,
  email_security_alerts BOOLEAN NOT NULL DEFAULT true,
  email_weekly_summary BOOLEAN NOT NULL DEFAULT false,
  
  -- SMS notification preferences
  sms_price_alerts BOOLEAN NOT NULL DEFAULT false,
  sms_dividend_alerts BOOLEAN NOT NULL DEFAULT false,
  sms_security_alerts BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_user_notification_prefs UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can manage their own notification preferences"
ON public.notification_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();