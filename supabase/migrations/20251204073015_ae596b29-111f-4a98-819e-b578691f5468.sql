-- Create role enum
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id 
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'user' THEN 3 
    END
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Create portfolios table
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cash_balance DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own portfolios"
ON public.portfolios FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create holdings table
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  shares DECIMAL(15,8) NOT NULL,
  avg_price DECIMAL(15,4) NOT NULL,
  current_price DECIMAL(15,4),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('Stock', 'ETF', 'Crypto', 'Cash')),
  sector TEXT,
  country TEXT DEFAULT 'US',
  dividend_yield DECIMAL(5,4) DEFAULT 0,
  expense_ratio DECIMAL(5,4),
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage holdings in their portfolios"
ON public.holdings FOR ALL
TO authenticated
USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()))
WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  holding_id UUID REFERENCES public.holdings(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL')),
  symbol TEXT NOT NULL,
  shares DECIMAL(15,8),
  price DECIMAL(15,4) NOT NULL,
  total_value DECIMAL(15,2) NOT NULL,
  fees DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage transactions in their portfolios"
ON public.transactions FOR ALL
TO authenticated
USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()))
WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Create broker_connections table
CREATE TABLE public.broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('Stock', 'Crypto', 'Mixed')),
  connection_type TEXT NOT NULL CHECK (connection_type IN ('API', 'CSV', 'Manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('connected', 'syncing', 'error', 'pending', 'disconnected')),
  api_key_encrypted TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own broker connections"
ON public.broker_connections FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create dividends table
CREATE TABLE public.dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID REFERENCES public.holdings(id) ON DELETE CASCADE NOT NULL,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  amount DECIMAL(15,4) NOT NULL,
  ex_date DATE NOT NULL,
  pay_date DATE,
  frequency TEXT CHECK (frequency IN ('Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Irregular')),
  is_estimated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage dividends in their portfolios"
ON public.dividends FOR ALL
TO authenticated
USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()))
WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Create broker_providers table (admin managed templates)
CREATE TABLE public.broker_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('Stock', 'Crypto', 'Mixed')),
  logo_url TEXT,
  is_enabled BOOLEAN DEFAULT true,
  supports_api BOOLEAN DEFAULT false,
  supports_csv BOOLEAN DEFAULT true,
  api_docs_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view enabled providers"
ON public.broker_providers FOR SELECT
TO authenticated
USING (is_enabled = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can manage providers"
ON public.broker_providers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Trigger to auto-assign user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Update triggers for updated_at columns
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broker_connections_updated_at
  BEFORE UPDATE ON public.broker_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default broker providers
INSERT INTO public.broker_providers (name, type, supports_api, supports_csv) VALUES
  ('Robinhood', 'Mixed', true, true),
  ('TD Ameritrade', 'Stock', true, true),
  ('Fidelity', 'Stock', true, true),
  ('Charles Schwab', 'Stock', true, true),
  ('Interactive Brokers', 'Mixed', true, true),
  ('Coinbase', 'Crypto', true, true),
  ('Binance', 'Crypto', true, true),
  ('Kraken', 'Crypto', true, true),
  ('E*TRADE', 'Stock', true, true),
  ('Webull', 'Mixed', true, true);

-- Allow admins to view all profiles for user management
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));