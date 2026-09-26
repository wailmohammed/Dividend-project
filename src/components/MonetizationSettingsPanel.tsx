import { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_MONETIZATION_SETTINGS, DonationLink, MonetizationSettings } from '@/types/monetization';

export function MonetizationSettingsPanel({ userId }: { userId?: string }) {
  const [settings, setSettings] = useState<MonetizationSettings>(DEFAULT_MONETIZATION_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    supabase.from('monetization_settings').select('*').eq('id', true).maybeSingle().then(({ data, error }) => {
      if (error) toast.error(`Could not load funding settings: ${error.message}`);
      if (data) {
        const donationLinks = Array.isArray(data.donation_links)
          ? (data.donation_links as unknown[]).filter((item): item is DonationLink => {
              if (!item || typeof item !== 'object') return false;
              const link = item as Record<string, unknown>;
              return typeof link.label === 'string' && typeof link.url === 'string' && typeof link.enabled === 'boolean';
            })
          : [];
        setSettings({ ...DEFAULT_MONETIZATION_SETTINGS, ...data, donation_links: donationLinks });
      }
      setLoaded(true);
    });
  }, []);

  const set = <K extends keyof MonetizationSettings>(key: K, value: MonetizationSettings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const setLink = (index: number, patch: Partial<DonationLink>) => set('donation_links', settings.donation_links.map((link, i) => i === index ? { ...link, ...patch } : link));
  const save = async () => {
    if (settings.ads_enabled && (!settings.consent_management_ready || !settings.adsense_publisher_id.trim() || !settings.public_content_ad_slot.trim())) {
      toast.error('Before enabling ads, add your publisher ID, public content slot, and verify your certified consent message is live.');
      return;
    }
    if (settings.donation_links.some(link => link.enabled && !/^https:\/\//i.test(link.url))) {
      toast.error('Enabled donation links must use a secure https:// URL.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('monetization_settings').upsert({
      id: true,
      ...settings,
      donation_links: settings.donation_links.map(({ label, url, enabled }) => ({ label, url, enabled })),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(`Could not save settings: ${error.message}`);
    else toast.success('Funding settings saved.');
  };

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold">Free project funding</h2><p className="text-sm text-muted-foreground">Manage advertising and voluntary donations. Users never pay to use WealthOS.</p></div>
    <Card>
      <CardHeader><CardTitle>Advertising</CardTitle><CardDescription>Google AdSense configuration for public website content. Ad code will not be loaded inside the signed-in portfolio dashboard.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between"><div><Label htmlFor="ads-enabled">Enable AdSense</Label><p className="text-xs text-muted-foreground">Requires an approved AdSense site and working consent setup.</p></div><Switch id="ads-enabled" checked={settings.ads_enabled} onCheckedChange={value => set('ads_enabled', value)} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Publisher ID</Label><Input placeholder="ca-pub-1234567890123456" value={settings.adsense_publisher_id} onChange={e => set('adsense_publisher_id', e.target.value)} /></div>
          <div className="space-y-2"><Label>Public content ad slot ID</Label><Input placeholder="Numeric AdSense slot ID" value={settings.public_content_ad_slot} onChange={e => set('public_content_ad_slot', e.target.value)} /></div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start justify-between gap-4"><div><Label htmlFor="cmp-ready">Consent message is published and verified</Label><p className="mt-1 text-xs text-muted-foreground">Confirm the Google certified CMP / AdSense privacy message is actually live before allowing ad requests. This switch does not create a consent banner.</p></div><Switch id="cmp-ready" checked={settings.consent_management_ready} onCheckedChange={value => set('consent_management_ready', value)} /></div>
        <p className="text-xs text-muted-foreground">Google requires site approval before serving ads. Never ask users to click ads or place ads beside financial actions. Earnings go to the AdSense account; this app does not report verified ad revenue.</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Voluntary donations</CardTitle><CardDescription>Add your own Buy Me a Coffee, Ko-fi, PayPal, or other secure public support pages. WealthOS does not collect card details.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between"><div><Label htmlFor="donations-enabled">Show support links</Label><p className="text-xs text-muted-foreground">Support is optional; all product features remain free.</p></div><Switch id="donations-enabled" checked={settings.donations_enabled} onCheckedChange={value => set('donations_enabled', value)} /></div>
        {settings.donation_links.map((link, index) => <div key={index} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-[1fr_2fr_auto_auto]">
          <div className="space-y-2"><Label>Button label</Label><Input value={link.label} onChange={e => setLink(index, { label: e.target.value })} placeholder="Buy me a coffee" /></div>
          <div className="space-y-2"><Label>Secure donation URL</Label><Input value={link.url} onChange={e => setLink(index, { url: e.target.value })} placeholder="https://..." /></div>
          <div className="flex items-center gap-2 pb-2"><Switch checked={link.enabled} onCheckedChange={value => setLink(index, { enabled: value })} aria-label="Enable donation link" /><span className="text-sm">Show</span></div>
          <Button variant="ghost" size="icon" onClick={() => set('donation_links', settings.donation_links.filter((_, i) => i !== index))} aria-label="Remove donation link"><Trash2 className="h-4 w-4" /></Button>
        </div>)}
        <Button variant="outline" onClick={() => set('donation_links', [...settings.donation_links, { label: 'Support us', url: '', enabled: true }])}><Plus className="mr-2 h-4 w-4" />Add donation link</Button>
      </CardContent>
    </Card>
    <div className="flex justify-end"><Button onClick={save} disabled={saving || !loaded}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save funding settings'}</Button></div>
  </div>;
}
