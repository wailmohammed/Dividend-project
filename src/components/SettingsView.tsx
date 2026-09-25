import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePortfolio } from '../context/PortfolioContext';
import { User, Bell, Shield, CreditCard, Globe, Moon, Sun, Link2, Upload, Briefcase, Clock, RefreshCw, Phone, Mail, MessageSquare, BellRing, Calculator, FlaskConical, Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { BrokerageIntegration } from './BrokerageIntegration';
import { CashBalanceForm } from './CashBalanceForm';
import { CSVExport } from './CSVExport';
import { CSVImporter } from './CSVImporter';
import { WebhookSettingsManager } from './WebhookSettingsManager';
import { useUserSettings, CostBasisMethod } from '../hooks/useUserSettings';
import { useTwoFactorAuth } from '../hooks/useTwoFactorAuth';
import { useBrokerSync } from '../hooks/useBrokerSync';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { TwoFactorSetup } from './TwoFactorSetup';
import { supabase } from '@/integrations/supabase/client';
import { useDemoMode } from '../hooks/useDemoMode';
import { PayPalCheckoutButton } from './PayPalCheckoutButton';


interface MarketRefreshLog {
  created_at: string;
  success_count: number;
  error_count: number;
  symbols_count: number;
}

const PLAN_PRICING: Record<'Pro' | 'Ultimate', { monthly: number; annual: number; features: string[] }> = {
  Pro: {
    monthly: 9.99,
    annual: 99,
    features: ['Unlimited holdings', 'Advanced analytics', 'Dividend forecasting', 'Priority support'],
  },
  Ultimate: {
    monthly: 19.99,
    annual: 199,
    features: ['Everything in Pro', 'AI portfolio advisor', 'Options flow', 'Halal & tax modules'],
  },
};

const PlanUpgradeCard = ({ plan }: { plan: 'Pro' | 'Ultimate' }) => {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const def = PLAN_PRICING[plan];
  const price = cycle === 'annual' ? def.annual : def.monthly;
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="font-semibold">{plan}</h4>
        <div className="text-right">
          <div className="text-lg font-bold">${price.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">/{cycle === 'annual' ? 'year' : 'month'}</div>
        </div>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
        {def.features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="flex gap-1 text-xs">
        {(['monthly', 'annual'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            className={`flex-1 px-2 py-1 rounded border ${
              cycle === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {c === 'annual' ? 'Annual (save ~17%)' : 'Monthly'}
          </button>
        ))}
      </div>
      <PayPalCheckoutButton plan={plan} cycle={cycle} />
    </div>
  );
};

export const SettingsView = () => {
  const { user } = useAuth();
  const [isTestingScheduledRefresh, setIsTestingScheduledRefresh] = useState(false);
  const [lastScheduledRefresh, setLastScheduledRefresh] = useState<MarketRefreshLog | null>(null);

  const fetchLastScheduledRefresh = async () => {
    const { data } = await supabase
      .from('market_sync_logs')
      .select('*')
      .eq('sync_type', 'scheduled_refresh')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setLastScheduledRefresh(data as MarketRefreshLog);
    }
  };
  const { theme, toggleTheme } = useTheme();
  const { importPortfolio, portfolios, setDefaultPortfolio: setContextDefaultPortfolio, defaultPortfolioId, activePortfolio } = usePortfolio();
  const { settings, loading: settingsLoading, updateSettings, setDefaultPortfolio, setDefaultCostBasisMethod } = useUserSettings();
  const { twoFA, loading: twoFALoading, isEnabled: is2FAEnabled, disableTwoFA, refetch: refetch2FA } = useTwoFactorAuth();
  const { syncing, syncAllBrokers } = useBrokerSync();
  const { preferences: notifPrefs, loading: notifPrefsLoading, updatePreference } = useNotificationPreferences();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush, showNotification } = usePushNotifications();
  const { isDemoModeEnabled, toggleDemoMode } = useDemoMode();

  
  const [selectedDefaultPortfolio, setSelectedDefaultPortfolio] = useState<string>('');
  const [selectedCostBasisMethod, setSelectedCostBasisMethod] = useState<CostBasisMethod>('FIFO');
  const [is2FAToggling, setIs2FAToggling] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Fetch current phone number
  useEffect(() => {
    const fetchPhone = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.phone_number) {
        setPhoneNumber(data.phone_number);
      }
    };
    fetchPhone();
  }, [user?.id]);

  // Fetch last scheduled refresh (for status + test verification)
  useEffect(() => {
    fetchLastScheduledRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (settings?.default_portfolio_id) {
      setSelectedDefaultPortfolio(settings.default_portfolio_id);
    } else if (defaultPortfolioId) {
      setSelectedDefaultPortfolio(defaultPortfolioId);
    }
    if (settings?.default_cost_basis_method) {
      setSelectedCostBasisMethod(settings.default_cost_basis_method);
    }
  }, [settings, defaultPortfolioId]);

  const handleCSVImport = (holdings: any[]) => {
    importPortfolio('Imported Portfolio', holdings.map(h => ({
      symbol: h.symbol,
      shares: h.shares,
      price: h.avgPrice,
      type: 'BUY'
    })));
    toast.success(`Imported ${holdings.length} holdings successfully`);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    setIsSavingPhone(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: phoneNumber || null })
        .eq('id', user.id);
      
      if (error) throw error;
      toast.success('Profile settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleNotificationToggle = async (key: keyof typeof notifPrefs, value: boolean) => {
    if (key === 'id' || key === 'user_id' || key === 'created_at' || key === 'updated_at') return;
    const success = await updatePreference(key as any, value);
    if (success) {
      toast.success('Notification preference updated');
    } else {
      toast.error('Failed to update preference');
    }
  };

  const handleDefaultPortfolioChange = async (portfolioId: string) => {
    setSelectedDefaultPortfolio(portfolioId);
    try {
      await setDefaultPortfolio(portfolioId);
      setContextDefaultPortfolio(portfolioId);
      toast.success('Default portfolio updated');
    } catch (error) {
      toast.error('Failed to update default portfolio');
    }
  };

  const handleCostBasisMethodChange = async (method: CostBasisMethod) => {
    setSelectedCostBasisMethod(method);
    try {
      await setDefaultCostBasisMethod(method);
      toast.success('Default cost basis method updated');
    } catch (error) {
      toast.error('Failed to update cost basis method');
    }
  };

  const handle2FAToggle = async () => {
    if (is2FAEnabled) {
      setIs2FAToggling(true);
      try {
        await disableTwoFA();
        toast.success('Two-factor authentication disabled');
      } catch (error) {
        toast.error('Failed to disable 2FA');
      } finally {
        setIs2FAToggling(false);
      }
    } else {
      // Open the 2FA setup dialog
      setShow2FASetup(true);
    }
  };

  const handleManualSync = async () => {
    if (activePortfolio?.id) {
      await syncAllBrokers(activePortfolio.id);
    } else {
      toast.error('No active portfolio selected');
    }
  };

  const handleTestScheduledRefresh = async () => {
    setIsTestingScheduledRefresh(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-market-refresh', {
        body: {}
      });

      if (error) throw error;

      toast.success(`Refresh complete: ${data.successCount}/${data.symbolsProcessed} updated`);
      await fetchLastScheduledRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Scheduled refresh test failed');
      await fetchLastScheduledRefresh();
    } finally {
      setIsTestingScheduledRefresh(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          {/* Cash Balance */}
          <CashBalanceForm />

          {/* Default Portfolio Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Default Portfolio
              </CardTitle>
              <CardDescription>Select which portfolio to show by default on the dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-portfolio">Default Portfolio</Label>
                <Select
                  value={selectedDefaultPortfolio}
                  onValueChange={handleDefaultPortfolioChange}
                  disabled={settingsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a portfolio" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((portfolio) => (
                      <SelectItem key={portfolio.id} value={portfolio.id}>
                        {portfolio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This portfolio will be displayed when you open the dashboard
                </p>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Broker portfolios sync automatically every 6 hours
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Default Cost Basis Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Tax Lot Settings
              </CardTitle>
              <CardDescription>Configure default cost basis method for selling positions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cost-basis-method">Default Cost Basis Method</Label>
                <Select
                  value={selectedCostBasisMethod}
                  onValueChange={(v) => handleCostBasisMethodChange(v as CostBasisMethod)}
                  disabled={settingsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIFO">FIFO - First In, First Out</SelectItem>
                    <SelectItem value="LIFO">LIFO - Last In, First Out</SelectItem>
                    <SelectItem value="HIFO">HIFO - Highest In, First Out</SelectItem>
                    <SelectItem value="LOFO">LOFO - Lowest In, First Out</SelectItem>
                    <SelectItem value="AVGCOST">Average Cost</SelectItem>
                    <SelectItem value="SPECIFIC">Specific Identification</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This method will be pre-selected when you sell positions. FIFO is the IRS default.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Demo Mode Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5" />
                Demo Mode
              </CardTitle>
              <CardDescription>
                Toggle demo mode to view sample data for testing and exploration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Demo Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Show sample tax lots, wash sale examples, and export previews
                  </p>
                </div>
                <Switch 
                  checked={isDemoModeEnabled} 
                  onCheckedChange={toggleDemoMode}
                />
              </div>
              {isDemoModeEnabled && (
              <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-sm text-foreground">
                    <strong>Demo Mode Active:</strong> You're viewing sample data. All tax lot features will display mock data instead of your real holdings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investing Mode Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Leaf className="w-5 h-5" />
                Investing Mode
              </CardTitle>
              <CardDescription>
                Choose between normal investing or Halal (Shariah-compliant) investing mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Halal Investing Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Shariah compliance screening, purification calculator, and halal stock filters
                  </p>
                </div>
                <Switch 
                  checked={settings?.investing_mode === 'halal'} 
                  onCheckedChange={async (checked) => {
                    try {
                      await updateSettings({ investing_mode: checked ? 'halal' : 'normal' } as any);
                      toast.success(checked ? 'Halal investing mode enabled' : 'Normal investing mode enabled');
                    } catch {
                      toast.error('Failed to update investing mode');
                    }
                  }}
                  disabled={settingsLoading}
                />
              </div>
              {settings?.investing_mode === 'halal' && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-foreground">
                    <strong>Halal Mode Active:</strong> Your portfolio will show Shariah compliance indicators, purification amounts, and flag non-compliant holdings.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Automatic Market Refresh
              </CardTitle>
              <CardDescription>
                Verify the daily scheduled refresh and see the last run status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {lastScheduledRefresh ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>Last run: <span className="text-foreground">{new Date(lastScheduledRefresh.created_at).toLocaleString()}</span></span>
                    <span>Success: <span className="text-foreground">{lastScheduledRefresh.success_count}</span></span>
                    <span>Errors: <span className="text-foreground">{lastScheduledRefresh.error_count}</span></span>
                    <span>Total: <span className="text-foreground">{lastScheduledRefresh.symbols_count}</span></span>
                  </div>
                ) : (
                  <span>No scheduled refresh has run yet.</span>
                )}
              </div>

              <Button onClick={handleTestScheduledRefresh} disabled={isTestingScheduledRefresh}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isTestingScheduledRefresh ? 'animate-spin' : ''}`} />
                {isTestingScheduledRefresh ? 'Testing...' : 'Test Scheduled Refresh'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={user?.email} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" type="text" placeholder="Enter your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue="utc">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC (GMT+0)</SelectItem>
                    <SelectItem value="est">Eastern Time (GMT-5)</SelectItem>
                    <SelectItem value="pst">Pacific Time (GMT-8)</SelectItem>
                    <SelectItem value="cet">Central European (GMT+1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used for SMS notifications (2FA alerts, security events). Include country code.
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={isSavingPhone}>
                {isSavingPhone ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription
              </CardTitle>
              <CardDescription>Manage your subscription plan and upgrade with PayPal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-4 border border-border rounded-lg">
                <div>
                  <h3 className="font-semibold text-foreground">Free Plan</h3>
                  <p className="text-sm text-muted-foreground">Basic features included</p>
                </div>
                <span className="text-xs text-muted-foreground">Current</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['Pro', 'Ultimate'] as const).map((plan) => (
                  <PlanUpgradeCard key={plan} plan={plan} />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Payments are processed by PayPal using the credentials configured by your workspace super admin.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                Brokerage Connections
              </CardTitle>
              <CardDescription>
                Connect your brokerage accounts to automatically sync your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrokerageIntegration />
            </CardContent>
          </Card>

          {/* CSV Import */}
          <CSVImporter onImport={handleCSVImport} />

          {/* CSV Export */}
          <CSVExport />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>Choose which notifications to receive via email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Price Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when price targets are hit</p>
                </div>
                <Switch 
                  checked={notifPrefs?.email_price_alerts ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_price_alerts', v)}
                  disabled={notifPrefsLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dividend Alerts</Label>
                  <p className="text-sm text-muted-foreground">Notify about upcoming dividend payments</p>
                </div>
                <Switch 
                  checked={notifPrefs?.email_dividend_alerts ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_dividend_alerts', v)}
                  disabled={notifPrefsLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Security Alerts</Label>
                  <p className="text-sm text-muted-foreground">Important security notifications</p>
                </div>
                <Switch 
                  checked={notifPrefs?.email_security_alerts ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_security_alerts', v)}
                  disabled={notifPrefsLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Portfolio Alerts</Label>
                  <p className="text-sm text-muted-foreground">Price movements, dividend changes, and earnings surprises</p>
                </div>
                <Switch 
                  checked={(notifPrefs as any)?.email_portfolio_alerts ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_portfolio_alerts' as any, v)}
                  disabled={notifPrefsLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Summary</Label>
                  <p className="text-sm text-muted-foreground">Receive a weekly portfolio summary</p>
                </div>
                <Switch 
                  checked={notifPrefs?.email_weekly_summary ?? false} 
                  onCheckedChange={(v) => handleNotificationToggle('email_weekly_summary', v)}
                  disabled={notifPrefsLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Social Notifications
              </CardTitle>
              <CardDescription>Get notified about community activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Followers</Label>
                  <p className="text-sm text-muted-foreground">When someone follows you</p>
                </div>
                <Switch 
                  checked={(notifPrefs as any)?.email_new_followers ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_new_followers' as any, v)}
                  disabled={notifPrefsLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Likes</Label>
                  <p className="text-sm text-muted-foreground">When someone likes your post</p>
                </div>
                <Switch 
                  checked={(notifPrefs as any)?.email_new_likes ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_new_likes' as any, v)}
                  disabled={notifPrefsLoading}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Comments</Label>
                  <p className="text-sm text-muted-foreground">When someone comments on your post</p>
                </div>
                <Switch 
                  checked={(notifPrefs as any)?.email_new_comments ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('email_new_comments' as any, v)}
                  disabled={notifPrefsLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                SMS Notifications
              </CardTitle>
              <CardDescription>Choose which notifications to receive via SMS (requires phone number)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!phoneNumber && (
                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground mb-4">
                  Add your phone number in the Profile tab to enable SMS notifications.
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Price Alerts</Label>
                  <p className="text-sm text-muted-foreground">SMS when price targets are hit</p>
                </div>
                <Switch 
                  checked={notifPrefs?.sms_price_alerts ?? false} 
                  onCheckedChange={(v) => handleNotificationToggle('sms_price_alerts', v)}
                  disabled={notifPrefsLoading || !phoneNumber}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dividend Alerts</Label>
                  <p className="text-sm text-muted-foreground">SMS for dividend payments</p>
                </div>
                <Switch 
                  checked={notifPrefs?.sms_dividend_alerts ?? false} 
                  onCheckedChange={(v) => handleNotificationToggle('sms_dividend_alerts', v)}
                  disabled={notifPrefsLoading || !phoneNumber}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Security Alerts</Label>
                  <p className="text-sm text-muted-foreground">SMS for security events (recommended)</p>
                </div>
                <Switch 
                  checked={notifPrefs?.sms_security_alerts ?? true} 
                  onCheckedChange={(v) => handleNotificationToggle('sms_security_alerts', v)}
                  disabled={notifPrefsLoading || !phoneNumber}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Portfolio Alerts</Label>
                  <p className="text-sm text-muted-foreground">SMS for price movements and dividend changes</p>
                </div>
                <Switch 
                  checked={(notifPrefs as any)?.sms_portfolio_alerts ?? false} 
                  onCheckedChange={(v) => handleNotificationToggle('sms_portfolio_alerts' as any, v)}
                  disabled={notifPrefsLoading || !phoneNumber}
                />
              </div>
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="w-5 h-5" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Get real-time browser notifications for price alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pushSupported ? (
                <>
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Enable Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive instant browser notifications when prices hit your targets
                      </p>
                    </div>
                    <Switch 
                      checked={pushSubscribed} 
                      onCheckedChange={async (checked) => {
                        if (checked) {
                          await subscribePush();
                        } else {
                          await unsubscribePush();
                        }
                      }}
                      disabled={pushLoading}
                    />
                  </div>
                  {pushSubscribed && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => showNotification('Test Notification', { body: 'Push notifications are working correctly!' })}
                    >
                      Send Test Notification
                    </Button>
                  )}
                  {pushSubscribed && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="space-y-0.5">
                        <Label>Portfolio Alerts</Label>
                        <p className="text-sm text-muted-foreground">Push notifications for portfolio alert triggers</p>
                      </div>
                      <Switch 
                        checked={(notifPrefs as any)?.push_portfolio_alerts ?? true} 
                        onCheckedChange={(v) => handleNotificationToggle('push_portfolio_alerts' as any, v)}
                        disabled={notifPrefsLoading}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                  Push notifications are not supported in your browser. Try using a modern browser like Chrome, Firefox, or Edge.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Notifications (Slack/Discord) */}
          <WebhookSettingsManager />
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Appearance Settings
              </CardTitle>
              <CardDescription>Customize how WealthOS looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Theme</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => theme !== 'light' && toggleTheme()}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                      theme === 'light' ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <Sun className="w-6 h-6" />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    onClick={() => theme !== 'dark' && toggleTheme()}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                      theme === 'dark' ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <Moon className="w-6 h-6" />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" />
              </div>
              <Button>Update Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">2FA Status</p>
                  <p className="text-sm text-muted-foreground">
                    {twoFALoading ? 'Loading...' : is2FAEnabled ? 'Currently enabled' : 'Currently disabled'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Switch 
                    checked={is2FAEnabled} 
                    onCheckedChange={handle2FAToggle}
                    disabled={twoFALoading || is2FAToggling}
                  />
                  <span className="text-sm text-muted-foreground">
                    {is2FAEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              {!is2FAEnabled && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Enable two-factor authentication to add an extra layer of security when signing in.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 2FA Setup Dialog */}
      <TwoFactorSetup 
        open={show2FASetup} 
        onOpenChange={setShow2FASetup}
        onSuccess={() => refetch2FA()}
      />
    </div>
  );
};