import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_MONETIZATION_SETTINGS, MonetizationSettings } from '@/types/monetization';

export function useMonetizationSettings() {
  const [settings, setSettings] = useState<MonetizationSettings>(DEFAULT_MONETIZATION_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.from('monetization_settings').select('*').eq('id', true).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data) setSettings({
          ...DEFAULT_MONETIZATION_SETTINGS,
          ...data,
          donation_links: Array.isArray(data.donation_links) ? data.donation_links as unknown as MonetizationSettings['donation_links'] : [],
        });
        setLoading(false);
      });
    const channel = supabase.channel('public-monetization-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monetization_settings' }, (payload) => {
        if (active && payload.new) setSettings({ ...DEFAULT_MONETIZATION_SETTINGS, ...payload.new } as MonetizationSettings);
      }).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  return { settings, loading };
}
