-- Add default_cost_basis_method to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS default_cost_basis_method text DEFAULT 'FIFO';

-- Create quarterly_tax_payments table to track IRS payments
CREATE TABLE public.quarterly_tax_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tax_year INTEGER NOT NULL,
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  estimated_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE,
  confirmation_number TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tax_year, quarter)
);

-- Enable RLS
ALTER TABLE public.quarterly_tax_payments ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own payments
CREATE POLICY "Users can manage their own quarterly tax payments" 
ON public.quarterly_tax_payments 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_quarterly_tax_payments_updated_at
BEFORE UPDATE ON public.quarterly_tax_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();