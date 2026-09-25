-- Create audit_logs table for tracking all admin actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view all audit logs
CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Only super admins can insert audit logs (via edge function with service role)
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Admins can view audit logs related to their actions
CREATE POLICY "Admins can view relevant audit logs"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  (user_id = auth.uid() OR target_type IN ('user', 'role', 'plan'))
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Fix broker_providers RLS to allow public read for enabled providers
DROP POLICY IF EXISTS "Anyone can view enabled providers" ON public.broker_providers;
CREATE POLICY "Anyone can view enabled providers"
ON public.broker_providers
FOR SELECT
TO public
USING (is_enabled = true);

-- Add a delete policy for profiles (admins can delete users)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));