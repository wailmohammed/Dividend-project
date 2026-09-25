-- Create storage bucket for tax documents
INSERT INTO storage.buckets (id, name, public) VALUES ('tax-documents', 'tax-documents', false);

-- Create RLS policies for tax documents bucket
CREATE POLICY "Users can view their own tax documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own tax documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own tax documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'tax-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create tax_documents table to track uploaded documents and extracted data
CREATE TABLE public.tax_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tax_year INTEGER NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('1099-B', '1099-DIV', '1099-INT', 'K-1', 'Other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB DEFAULT '{}'::jsonb,
  total_proceeds NUMERIC,
  total_cost_basis NUMERIC,
  total_gain_loss NUMERIC,
  short_term_gain_loss NUMERIC,
  long_term_gain_loss NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own documents
CREATE POLICY "Users can manage their own tax documents"
ON public.tax_documents
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_tax_documents_updated_at
BEFORE UPDATE ON public.tax_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add state_tax_rate to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS state_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS state_tax_rate NUMERIC DEFAULT 0;

-- Create state_tax_rates reference table
CREATE TABLE public.state_tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_code TEXT NOT NULL UNIQUE,
  state_name TEXT NOT NULL,
  income_tax_rate NUMERIC NOT NULL DEFAULT 0,
  capital_gains_rate NUMERIC,
  has_separate_cg_rate BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (read-only for all authenticated users)
ALTER TABLE public.state_tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view state tax rates"
ON public.state_tax_rates
FOR SELECT
USING (true);

-- Insert US state tax rates (2024 approximate rates)
INSERT INTO public.state_tax_rates (state_code, state_name, income_tax_rate, capital_gains_rate, has_separate_cg_rate, notes) VALUES
('AL', 'Alabama', 5.00, NULL, false, 'Top marginal rate'),
('AK', 'Alaska', 0.00, NULL, false, 'No state income tax'),
('AZ', 'Arizona', 2.50, NULL, false, 'Flat rate'),
('AR', 'Arkansas', 4.40, NULL, false, 'Top marginal rate'),
('CA', 'California', 13.30, 13.30, true, 'Highest state rate, CG taxed as income'),
('CO', 'Colorado', 4.40, NULL, false, 'Flat rate'),
('CT', 'Connecticut', 6.99, 6.99, false, 'Top marginal rate'),
('DE', 'Delaware', 6.60, NULL, false, 'Top marginal rate'),
('FL', 'Florida', 0.00, NULL, false, 'No state income tax'),
('GA', 'Georgia', 5.49, NULL, false, 'Flat rate'),
('HI', 'Hawaii', 11.00, 7.25, true, 'Separate CG rate'),
('ID', 'Idaho', 5.80, NULL, false, 'Flat rate'),
('IL', 'Illinois', 4.95, NULL, false, 'Flat rate'),
('IN', 'Indiana', 3.05, NULL, false, 'Flat rate'),
('IA', 'Iowa', 5.70, NULL, false, 'Top marginal rate'),
('KS', 'Kansas', 5.70, NULL, false, 'Top marginal rate'),
('KY', 'Kentucky', 4.00, NULL, false, 'Flat rate'),
('LA', 'Louisiana', 4.25, NULL, false, 'Top marginal rate'),
('ME', 'Maine', 7.15, NULL, false, 'Top marginal rate'),
('MD', 'Maryland', 5.75, NULL, false, 'Top marginal rate'),
('MA', 'Massachusetts', 5.00, 8.50, true, 'Short-term at 12%, Long-term at 5%'),
('MI', 'Michigan', 4.25, NULL, false, 'Flat rate'),
('MN', 'Minnesota', 9.85, NULL, false, 'Top marginal rate'),
('MS', 'Mississippi', 5.00, NULL, false, 'Top marginal rate'),
('MO', 'Missouri', 4.95, NULL, false, 'Top marginal rate'),
('MT', 'Montana', 5.90, NULL, false, 'Top marginal rate'),
('NE', 'Nebraska', 5.84, NULL, false, 'Top marginal rate'),
('NV', 'Nevada', 0.00, NULL, false, 'No state income tax'),
('NH', 'New Hampshire', 0.00, 5.00, true, 'Only taxes dividends/interest'),
('NJ', 'New Jersey', 10.75, NULL, false, 'Top marginal rate'),
('NM', 'New Mexico', 5.90, NULL, false, 'Top marginal rate'),
('NY', 'New York', 10.90, NULL, false, 'Top marginal rate'),
('NC', 'North Carolina', 4.75, NULL, false, 'Flat rate'),
('ND', 'North Dakota', 2.50, NULL, false, 'Top marginal rate'),
('OH', 'Ohio', 3.50, NULL, false, 'Top marginal rate'),
('OK', 'Oklahoma', 4.75, NULL, false, 'Top marginal rate'),
('OR', 'Oregon', 9.90, NULL, false, 'Top marginal rate'),
('PA', 'Pennsylvania', 3.07, NULL, false, 'Flat rate'),
('RI', 'Rhode Island', 5.99, NULL, false, 'Top marginal rate'),
('SC', 'South Carolina', 6.40, NULL, false, 'Top marginal rate'),
('SD', 'South Dakota', 0.00, NULL, false, 'No state income tax'),
('TN', 'Tennessee', 0.00, NULL, false, 'No state income tax'),
('TX', 'Texas', 0.00, NULL, false, 'No state income tax'),
('UT', 'Utah', 4.65, NULL, false, 'Flat rate'),
('VT', 'Vermont', 8.75, NULL, false, 'Top marginal rate'),
('VA', 'Virginia', 5.75, NULL, false, 'Top marginal rate'),
('WA', 'Washington', 0.00, 7.00, true, 'Only taxes capital gains over $262,000'),
('WV', 'West Virginia', 5.12, NULL, false, 'Top marginal rate'),
('WI', 'Wisconsin', 7.65, NULL, false, 'Top marginal rate'),
('WY', 'Wyoming', 0.00, NULL, false, 'No state income tax'),
('DC', 'District of Columbia', 10.75, NULL, false, 'Top marginal rate');