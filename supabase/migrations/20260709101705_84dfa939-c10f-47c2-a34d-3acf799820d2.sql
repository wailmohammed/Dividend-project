-- Allow users to delete their own alert_history entries; admins/super_admins can delete any
CREATE POLICY "Users can delete their own alert history"
  ON public.alert_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any alert history"
  ON public.alert_history
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));