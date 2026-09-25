-- Create webhook_settings table for Slack/Discord notifications
CREATE TABLE public.webhook_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  webhook_type TEXT NOT NULL CHECK (webhook_type IN ('slack', 'discord')),
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_price_alerts BOOLEAN NOT NULL DEFAULT true,
  notify_dividend_alerts BOOLEAN NOT NULL DEFAULT true,
  notify_portfolio_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own webhook settings"
ON public.webhook_settings
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_webhook_settings_updated_at
BEFORE UPDATE ON public.webhook_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();