import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, DollarSign, Wallet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentGateway {
  id: string;
  gateway_type: 'stripe' | 'paypal' | 'crypto';
  is_enabled: boolean;
  api_key?: string;
  api_secret?: string;
  webhook_secret?: string;
  metadata?: any;
}

export const PaymentGatewaySettings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gateways, setGateways] = useState<Record<string, PaymentGateway>>({});

  const [stripeSettings, setStripeSettings] = useState({
    enabled: false,
    apiKey: '',
    webhookSecret: '',
  });

  const [paypalSettings, setPaypalSettings] = useState({
    enabled: false,
    clientId: '',
    clientSecret: '',
    webhookId: '',
    mode: 'sandbox' as 'sandbox' | 'live',
  });

  const [cryptoSettings, setCryptoSettings] = useState({
    enabled: false,
    btcAddress: '',
    ethAddress: '',
    usdtAddress: '',
  });

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-payment-gateway`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'get' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch payment gateways');
      }

      const { gateways: fetchedGateways } = await response.json();
      
      const gatewayMap: Record<string, PaymentGateway> = {};
      fetchedGateways.forEach((gw: PaymentGateway) => {
        gatewayMap[gw.gateway_type] = gw;
      });
      setGateways(gatewayMap);

      // Populate form fields
      if (gatewayMap.stripe) {
        setStripeSettings({
          enabled: gatewayMap.stripe.is_enabled,
          apiKey: gatewayMap.stripe.api_key || '',
          webhookSecret: gatewayMap.stripe.webhook_secret || '',
        });
      }

      if (gatewayMap.paypal) {
        setPaypalSettings({
          enabled: gatewayMap.paypal.is_enabled,
          clientId: gatewayMap.paypal.api_key || '',
          clientSecret: gatewayMap.paypal.api_secret || '',
          webhookId: gatewayMap.paypal.webhook_secret || '',
          mode: (gatewayMap.paypal.metadata?.mode === 'live' ? 'live' : 'sandbox'),
        });
      }

      if (gatewayMap.crypto) {
        const metadata = gatewayMap.crypto.metadata || {};
        setCryptoSettings({
          enabled: gatewayMap.crypto.is_enabled,
          btcAddress: metadata.btc_address || '',
          ethAddress: metadata.eth_address || '',
          usdtAddress: metadata.usdt_address || '',
        });
      }

    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast.error('Failed to load payment gateway settings');
    } finally {
      setLoading(false);
    }
  };

  const saveGateway = async (gatewayType: string, settings: any) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-payment-gateway`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'upsert',
            ...settings,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save payment gateway');
      }

      toast.success(`${gatewayType} settings saved successfully`);
      fetchGateways();

    } catch (error) {
      console.error('Error saving gateway:', error);
      toast.error('Failed to save payment gateway settings');
    } finally {
      setSaving(false);
    }
  };

  const handleStripeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveGateway('Stripe', {
      gatewayType: 'stripe',
      isEnabled: stripeSettings.enabled,
      apiKey: stripeSettings.apiKey,
      webhookSecret: stripeSettings.webhookSecret,
    });
  };

  const handlePayPalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveGateway('PayPal', {
      gatewayType: 'paypal',
      isEnabled: paypalSettings.enabled,
      apiKey: paypalSettings.clientId,
      apiSecret: paypalSettings.clientSecret,
      webhookSecret: paypalSettings.webhookId,
      metadata: { mode: paypalSettings.mode },
    });
  };

  const handleCryptoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveGateway('Crypto', {
      gatewayType: 'crypto',
      isEnabled: cryptoSettings.enabled,
      metadata: {
        btc_address: cryptoSettings.btcAddress,
        eth_address: cryptoSettings.ethAddress,
        usdt_address: cryptoSettings.usdtAddress,
      },
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Gateway Settings</CardTitle>
        <CardDescription>
          Configure payment methods for subscription billing. All credentials are encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stripe" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stripe">
              <CreditCard className="mr-2 h-4 w-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="paypal">
              <DollarSign className="mr-2 h-4 w-4" />
              PayPal
            </TabsTrigger>
            <TabsTrigger value="crypto">
              <Wallet className="mr-2 h-4 w-4" />
              Crypto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stripe" className="space-y-4 mt-4">
            <form onSubmit={handleStripeSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="stripe-enabled">Enable Stripe</Label>
                <Switch
                  id="stripe-enabled"
                  checked={stripeSettings.enabled}
                  onCheckedChange={(checked) =>
                    setStripeSettings({ ...stripeSettings, enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe-api-key">Secret API Key</Label>
                <Input
                  id="stripe-api-key"
                  type="password"
                  placeholder="sk_live_..."
                  value={stripeSettings.apiKey}
                  onChange={(e) =>
                    setStripeSettings({ ...stripeSettings, apiKey: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe-webhook">Webhook Secret</Label>
                <Input
                  id="stripe-webhook"
                  type="password"
                  placeholder="whsec_..."
                  value={stripeSettings.webhookSecret}
                  onChange={(e) =>
                    setStripeSettings({ ...stripeSettings, webhookSecret: e.target.value })
                  }
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Stripe Settings
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="paypal" className="space-y-4 mt-4">
            <form onSubmit={handlePayPalSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="paypal-enabled">Enable PayPal</Label>
                <Switch
                  id="paypal-enabled"
                  checked={paypalSettings.enabled}
                  onCheckedChange={(checked) =>
                    setPaypalSettings({ ...paypalSettings, enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Environment</Label>
                <div className="flex gap-2">
                  {(['sandbox', 'live'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaypalSettings({ ...paypalSettings, mode: m })}
                      className={`flex-1 px-3 py-1.5 rounded border text-sm capitalize ${
                        paypalSettings.mode === m
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {m === 'sandbox' ? 'Sandbox (test)' : 'Live'}
                    </button>
                  ))}
                </div>
              </div>


              <div className="space-y-2">
                <Label htmlFor="paypal-client-id">Client ID</Label>
                <Input
                  id="paypal-client-id"
                  type="text"
                  placeholder="Client ID"
                  value={paypalSettings.clientId}
                  onChange={(e) =>
                    setPaypalSettings({ ...paypalSettings, clientId: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal-client-secret">Client Secret</Label>
                <Input
                  id="paypal-client-secret"
                  type="password"
                  placeholder="Client Secret"
                  value={paypalSettings.clientSecret}
                  onChange={(e) =>
                    setPaypalSettings({ ...paypalSettings, clientSecret: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal-webhook">Webhook ID</Label>
                <Input
                  id="paypal-webhook"
                  type="text"
                  placeholder="Webhook ID"
                  value={paypalSettings.webhookId}
                  onChange={(e) =>
                    setPaypalSettings({ ...paypalSettings, webhookId: e.target.value })
                  }
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save PayPal Settings
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="crypto" className="space-y-4 mt-4">
            <form onSubmit={handleCryptoSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="crypto-enabled">Enable Crypto Payments</Label>
                <Switch
                  id="crypto-enabled"
                  checked={cryptoSettings.enabled}
                  onCheckedChange={(checked) =>
                    setCryptoSettings({ ...cryptoSettings, enabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="btc-address">Bitcoin (BTC) Address</Label>
                <Input
                  id="btc-address"
                  type="text"
                  placeholder="bc1q..."
                  value={cryptoSettings.btcAddress}
                  onChange={(e) =>
                    setCryptoSettings({ ...cryptoSettings, btcAddress: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eth-address">Ethereum (ETH) Address</Label>
                <Input
                  id="eth-address"
                  type="text"
                  placeholder="0x..."
                  value={cryptoSettings.ethAddress}
                  onChange={(e) =>
                    setCryptoSettings({ ...cryptoSettings, ethAddress: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usdt-address">USDT (TRC20) Address</Label>
                <Input
                  id="usdt-address"
                  type="text"
                  placeholder="T..."
                  value={cryptoSettings.usdtAddress}
                  onChange={(e) =>
                    setCryptoSettings({ ...cryptoSettings, usdtAddress: e.target.value })
                  }
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Crypto Settings
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
