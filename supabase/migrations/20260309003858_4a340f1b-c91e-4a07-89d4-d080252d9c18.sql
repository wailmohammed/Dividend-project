-- Create payment gateway settings table for storing encrypted credentials
CREATE TABLE public.payment_gateway_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_type TEXT NOT NULL CHECK (gateway_type IN ('stripe', 'paypal', 'crypto')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gateway_type)
);

-- Enable RLS
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read payment gateway settings
CREATE POLICY "Super admins can view payment gateways"
ON public.payment_gateway_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Only super admins can insert payment gateway settings
CREATE POLICY "Super admins can create payment gateways"
ON public.payment_gateway_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Only super admins can update payment gateway settings
CREATE POLICY "Super admins can update payment gateways"
ON public.payment_gateway_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Only super admins can delete payment gateway settings
CREATE POLICY "Super admins can delete payment gateways"
ON public.payment_gateway_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('Free', 'Pro', 'Ultimate')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')) DEFAULT 'active',
  payment_method TEXT CHECK (payment_method IN ('stripe', 'paypal', 'crypto')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  external_subscription_id TEXT,
  external_customer_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only authenticated users can insert subscriptions (payment flow)
CREATE POLICY "Authenticated users can create subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update their own subscriptions"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Super admins can view all subscriptions
CREATE POLICY "Super admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_payment_gateway_settings_updated_at
BEFORE UPDATE ON public.payment_gateway_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();