DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view relevant audit logs" ON public.audit_logs;

CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view relevant audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  (user_id = auth.uid() OR target_type IN ('user', 'role', 'plan'))
);