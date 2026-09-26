CREATE TABLE IF NOT EXISTS public.monetization_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  ads_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  adsense_publisher_id TEXT NOT NULL DEFAULT '',
  public_content_ad_slot TEXT NOT NULL DEFAULT '',
  consent_management_ready BOOLEAN NOT NULL DEFAULT FALSE,
  donations_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  donation_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.monetization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read monetization display settings"
  ON public.monetization_settings FOR SELECT USING (TRUE);
CREATE POLICY "Super admins can insert monetization settings"
  ON public.monetization_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can update monetization settings"
  ON public.monetization_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete monetization settings"
  ON public.monetization_settings FOR DELETE
  USING (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.monetization_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- Remove legacy paid-tier assignments. All account features are offered free.
UPDATE public.profiles SET plan = 'Free' WHERE plan IS DISTINCT FROM 'Free';
UPDATE public.subscriptions SET status = 'canceled', cancel_at_period_end = TRUE WHERE status IN ('active', 'trialing');
UPDATE public.payment_gateway_settings SET is_enabled = FALSE WHERE is_enabled = TRUE;
