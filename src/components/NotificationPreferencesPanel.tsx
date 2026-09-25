import React, { useState, useEffect } from 'react';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';
import { useTwilioSettings } from '@/hooks/useTwilioSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import {
  Volume2, VolumeX, Bell, BellOff, Mail, Smartphone, Monitor,
  TrendingUp, DollarSign, Shield, Heart, MessageCircle, User,
  Calculator, BarChart3, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChannelRow {
  key: keyof Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
  label: string;
  description: string;
  channel: 'email' | 'sms' | 'push';
}

const ALERT_CATEGORIES = [
  {
    title: 'Market & Portfolio',
    icon: <TrendingUp className="w-4 h-4" />,
    rows: [
      { emailKey: 'email_price_alerts', smsKey: 'sms_price_alerts', pushKey: null, label: 'Price Alerts', desc: 'Target price notifications' },
      { emailKey: 'email_dividend_alerts', smsKey: 'sms_dividend_alerts', pushKey: null, label: 'Dividend Alerts', desc: 'Ex-dates & payment reminders' },
      { emailKey: 'email_portfolio_alerts', smsKey: 'sms_portfolio_alerts', pushKey: 'push_portfolio_alerts', label: 'Portfolio Alerts', desc: 'Price movements & earnings' },
      { emailKey: 'email_weekly_summary', smsKey: null, pushKey: null, label: 'Weekly Summary', desc: 'Performance digest' },
    ],
  },
  {
    title: 'Tax',
    icon: <Calculator className="w-4 h-4" />,
    rows: [
      { emailKey: 'email_tax_alerts', smsKey: 'sms_tax_alerts', pushKey: 'push_tax_alerts', label: 'Tax Alerts', desc: 'Status changes & harvesting' },
    ],
  },
  {
    title: 'Security',
    icon: <Shield className="w-4 h-4" />,
    rows: [
      { emailKey: 'email_security_alerts', smsKey: 'sms_security_alerts', pushKey: null, label: 'Security Alerts', desc: 'Login attempts & 2FA changes' },
    ],
  },
  {
    title: 'Social',
    icon: <Heart className="w-4 h-4" />,
    rows: [
      { emailKey: 'email_new_followers', smsKey: null, pushKey: null, label: 'New Followers', desc: 'When someone follows you' },
      { emailKey: 'email_new_likes', smsKey: null, pushKey: null, label: 'Post Likes', desc: 'When someone likes your post' },
      { emailKey: 'email_new_comments', smsKey: null, pushKey: null, label: 'Comments', desc: 'Replies to your posts' },
    ],
  },
];

export const NotificationPreferencesPanel: React.FC = () => {
  const { preferences, loading, updatePreference } = useNotificationPreferences();
  const { playSound, requestPermission, notifyAlert } = useAlertNotifications();
  const { settings: twilioSettings } = useTwilioSettings();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: subscribePush, unsubscribe: unsubscribePush, showNotification } = usePushNotifications();

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('alert-sound-enabled') !== 'false'; } catch { return true; }
  });
  const [desktopEnabled, setDesktopEnabled] = useState(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('alert-sound-enabled', String(next)); } catch {}
      if (next) playSound();
      toast.success(next ? 'Alert sounds enabled' : 'Alert sounds muted');
      return next;
    });
  };

  const toggleDesktop = async () => {
    if (!('Notification' in window)) {
      toast.error('Desktop notifications not supported in this browser');
      return;
    }
    if (Notification.permission === 'denied') {
      toast.error('Notifications blocked. Please enable in browser settings.');
      return;
    }
    if (Notification.permission === 'default') {
      const result = await requestPermission();
      if (result === 'granted') {
        setDesktopEnabled(true);
        toast.success('Desktop notifications enabled');
      } else {
        toast.error('Notification permission denied');
      }
      return;
    }
    // Already granted — toggle local state
    setDesktopEnabled(prev => {
      const next = !prev;
      localStorage.setItem('desktop-notif-enabled', String(next));
      toast.success(next ? 'Desktop notifications enabled' : 'Desktop notifications disabled');
      return next;
    });
  };

  const handleToggle = async (key: string, value: boolean) => {
    const success = await updatePreference(key as any, value);
    if (success) {
      toast.success('Preference updated');
    } else {
      toast.error('Failed to update preference');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Sound & Desktop Notification Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Browser Notifications
          </CardTitle>
          <CardDescription>
            Control sounds and desktop alerts for real-time notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-3 cursor-pointer">
              {soundEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Alert Sounds</span>
                <span className="text-xs text-muted-foreground font-normal">Play a chime when new alerts fire</span>
              </div>
            </Label>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => playSound()}>
                Test
              </Button>
              <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-3 cursor-pointer">
              {desktopEnabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Desktop Notifications</span>
                <span className="text-xs text-muted-foreground font-normal">Show browser popups for triggered alerts</span>
              </div>
            </Label>
            <div className="flex items-center gap-2">
              {desktopEnabled && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => notifyAlert('TEST', 'price_movement', 'This is a test notification')}>
                  Test
                </Button>
              )}
              <Switch checked={desktopEnabled} onCheckedChange={toggleDesktop} />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-3 cursor-pointer">
              <Bell className={`w-5 h-5 ${pushSubscribed ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Push Notifications</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {pushSupported ? 'Receive push notifications even when tab is closed' : 'Not supported in this browser'}
                </span>
              </div>
            </Label>
            <div className="flex items-center gap-2">
              {pushSubscribed && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => showNotification('Test', { body: 'Push working!' })}>
                  Test
                </Button>
              )}
              <Switch
                checked={pushSubscribed}
                onCheckedChange={async (v) => v ? await subscribePush() : await unsubscribePush()}
                disabled={!pushSupported}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Alert-Type Channel Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Per-Alert Channel Preferences
          </CardTitle>
          <CardDescription>
            Choose which channels deliver each alert type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Channel Header */}
          <div className="grid grid-cols-[1fr,60px,60px,60px] gap-2 mb-3 px-1">
            <div className="text-xs font-semibold text-muted-foreground">Alert Type</div>
            <div className="text-center" title="Email"><Mail className="w-3.5 h-3.5 mx-auto text-muted-foreground" /></div>
            <div className="text-center" title="SMS"><Smartphone className="w-3.5 h-3.5 mx-auto text-muted-foreground" /></div>
            <div className="text-center" title="Push"><Bell className="w-3.5 h-3.5 mx-auto text-muted-foreground" /></div>
          </div>

          <div className="space-y-1">
            {ALERT_CATEGORIES.map((category) => (
              <div key={category.title}>
                <div className="flex items-center gap-2 py-2 px-1">
                  <span className="text-primary">{category.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{category.title}</span>
                </div>
                {category.rows.map((row) => (
                  <div
                    key={row.emailKey}
                    className="grid grid-cols-[1fr,60px,60px,60px] gap-2 items-center py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.label}</p>
                      <p className="text-[11px] text-muted-foreground">{row.desc}</p>
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        className="scale-75"
                        checked={(preferences as any)?.[row.emailKey] ?? true}
                        onCheckedChange={(v) => handleToggle(row.emailKey, v)}
                      />
                    </div>
                    <div className="flex justify-center">
                      {row.smsKey ? (
                        <Switch
                          className="scale-75"
                          checked={(preferences as any)?.[row.smsKey] ?? false}
                          onCheckedChange={(v) => handleToggle(row.smsKey, v)}
                          disabled={!twilioSettings.isConfigured}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex justify-center">
                      {row.pushKey ? (
                        <Switch
                          className="scale-75"
                          checked={(preferences as any)?.[row.pushKey] ?? true}
                          onCheckedChange={(v) => handleToggle(row.pushKey, v)}
                          disabled={!pushSubscribed}
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                ))}
                <Separator className="my-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
