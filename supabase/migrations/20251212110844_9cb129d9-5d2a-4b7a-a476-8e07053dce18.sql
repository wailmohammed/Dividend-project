
-- Add user_settings table for default portfolio and other preferences
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  default_portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
  theme TEXT DEFAULT 'dark',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_settings
CREATE POLICY "Users can manage their own settings" ON public.user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all user settings" ON public.user_settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Add two_factor_auth table for future 2FA support
CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  secret_encrypted TEXT,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[],
  last_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for 2FA
ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;

-- RLS policies for 2FA - users can only access their own
CREATE POLICY "Users can manage their own 2FA" ON public.two_factor_auth
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add broker_sync_data table to store synced portfolio data from brokers
CREATE TABLE IF NOT EXISTS public.broker_sync_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}',
  positions JSONB NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broker_sync_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for broker_sync_data
CREATE POLICY "Users can manage their own sync data" ON public.broker_sync_data
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at on new tables
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_two_factor_auth_updated_at
  BEFORE UPDATE ON public.two_factor_auth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_sync_data_updated_at
  BEFORE UPDATE ON public.broker_sync_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
