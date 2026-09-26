import { useEffect } from 'react';
import { Coffee, Heart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useMonetizationSettings } from '@/hooks/useMonetizationSettings';

export function AdSlot() {
  const { settings } = useMonetizationSettings();
  const slot = settings.public_content_ad_slot;
  const publisherId = settings.adsense_publisher_id.trim();
  const publisher = publisherId.startsWith('ca-') ? publisherId : `ca-${publisherId}`;
  const isReady = settings.ads_enabled && settings.consent_management_ready && /^ca-pub-\d+$/.test(publisher) && /^\d+$/.test(slot);

  useEffect(() => {
    if (!isReady) return;
    const scriptId = 'wealthos-adsense-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
      document.head.appendChild(script);
    }
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch { /* ad blocker or unapproved inventory */ }
  }, [isReady, publisher, slot]);

  if (!isReady) return null;
  return <div className="my-4 min-h-[90px] overflow-hidden rounded-lg border border-border bg-muted/20" aria-label="Advertisement">
    <span className="px-3 pt-2 block text-[10px] uppercase tracking-wider text-muted-foreground">Advertisement</span>
    <ins className="adsbygoogle block" style={{ display: 'block', minHeight: 72 }} data-ad-client={publisher} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
  </div>;
}

export function SupportProject() {
  const { settings } = useMonetizationSettings();
  const links = settings.donations_enabled ? settings.donation_links.filter(link => link.enabled && /^https:\/\//i.test(link.url)) : [];
  if (!links.length) return null;
  return <Card className="my-5 border-primary/20 bg-primary/[0.03] p-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex gap-3">
        <Heart className="mt-1 h-5 w-5 text-primary" />
        <div><h3 className="font-semibold">Keep WealthOS free</h3><p className="text-sm text-muted-foreground">If this project helps you, your support helps cover data and hosting costs.</p></div>
      </div>
      <div className="flex flex-wrap gap-2">{links.map((link, index) => <a key={`${link.label}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:border-primary/50"><Coffee className="h-4 w-4" />{link.label}</a>)}</div>
    </div>
  </Card>;
}
