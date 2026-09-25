import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  plan: 'Pro' | 'Ultimate';
  cycle: 'monthly' | 'annual';
  onSuccess?: () => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

async function invoke<T = any>(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke<T>('paypal-checkout', {
    body: { action, ...extra },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

let sdkPromise: Promise<void> | null = null;
function loadSdk(clientId: string) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.async = true;
    s.dataset.paypalSdk = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load PayPal SDK'));
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export const PayPalCheckoutButton = ({ plan, cycle, onSuccess }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'disabled' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await invoke<{ enabled: boolean; clientId: string | null }>('get-config');
        if (cancelled) return;
        if (!cfg.enabled || !cfg.clientId) {
          setStatus('disabled');
          setMessage('PayPal is not enabled yet. A super admin needs to add credentials in Admin → Payment Gateways.');
          return;
        }
        await loadSdk(cfg.clientId);
        if (cancelled || !window.paypal || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        window.paypal
          .Buttons({
            style: { layout: 'horizontal', shape: 'rect', label: 'paypal', tagline: false, height: 40 },
            createOrder: async () => {
              const { orderId } = await invoke<{ orderId: string }>('create-order', { plan, cycle });
              return orderId;
            },
            onApprove: async (data: { orderID: string }) => {
              const res = await invoke<{ success: boolean; plan: string; cycle: string }>('capture-order', {
                orderId: data.orderID,
              });
              toast.success(`${res.plan} (${res.cycle}) activated via PayPal`);
              onSuccess?.();
            },
            onError: (err: unknown) => {
              console.error('PayPal error', err);
              toast.error('Payment failed. Please try again.');
            },
          })
          .render(containerRef.current);
        setStatus('ready');
      } catch (e) {
        console.error(e);
        setStatus('error');
        setMessage((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, cycle, onSuccess]);

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading PayPal…
      </div>
    );
  }
  if (status === 'disabled' || status === 'error') {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3">
        {message || 'PayPal unavailable.'}
      </div>
    );
  }
  return <div ref={containerRef} />;
};

export default PayPalCheckoutButton;
