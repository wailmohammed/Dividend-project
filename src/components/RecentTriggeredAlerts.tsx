import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Badge } from './ui/badge';
import { AlertSeverityBadge, getAlertSeverity } from './AlertSeverityBadge';
import { AlertTriangle, TrendingUp, BarChart3, Activity, Clock, ChevronRight, Bell, BellOff } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { formatDistanceToNow } from 'date-fns';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface TriggeredAlert {
  id: string;
  symbol: string;
  alert_type: string;
  threshold_percent: number | null;
  trigger_value: number | null;
  triggered_at: string;
  notes: string | null;
}

const ALERT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  ma_crossover: {
    label: 'MA Crossover',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  volume_spike: {
    label: 'Volume Spike',
    icon: <BarChart3 className="w-4 h-4" />,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  rsi_threshold: {
    label: 'RSI Threshold',
    icon: <Activity className="w-4 h-4" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  price_movement: {
    label: 'Price Movement',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  dividend_cut: {
    label: 'Dividend Cut',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  dividend_increase: {
    label: 'Dividend Increase',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  earnings_surprise: {
    label: 'Earnings Surprise',
    icon: <Activity className="w-4 h-4" />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
};

const DEMO_TRIGGERED_ALERTS: TriggeredAlert[] = [
  {
    id: '1',
    symbol: 'AAPL',
    alert_type: 'ma_crossover',
    threshold_percent: null,
    trigger_value: 268.66,
    triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notes: 'Golden Cross: SMA50 $268.66 > SMA200 $237.92',
  },
  {
    id: '2',
    symbol: 'IIPR',
    alert_type: 'volume_spike',
    threshold_percent: 200,
    trigger_value: 242,
    triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notes: 'Volume at 242% of baseline average',
  },
];

const formatTriggerDetail = (alert: TriggeredAlert): string => {
  if (alert.notes) return alert.notes;

  switch (alert.alert_type) {
    case 'ma_crossover':
      return `SMA crossover detected at $${alert.trigger_value?.toFixed(2) ?? 'N/A'}`;
    case 'volume_spike':
      return `Volume at ${alert.trigger_value?.toFixed(0) ?? 'N/A'}% of average`;
    case 'rsi_threshold':
      return `RSI reached ${alert.trigger_value?.toFixed(1) ?? 'N/A'} (threshold: ${alert.threshold_percent ?? 70})`;
    case 'price_movement':
      return `Moved ${alert.trigger_value?.toFixed(2) ?? 'N/A'}% (threshold: ${alert.threshold_percent ?? 5}%)`;
    default:
      return `Trigger value: ${alert.trigger_value ?? 'N/A'}`;
  }
};

export const RecentTriggeredAlerts: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { switchView } = usePortfolio();
  const [alerts, setAlerts] = useState<TriggeredAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('alert-sound-enabled') !== 'false'; } catch { return true; }
  });
  const { notifyAlert, requestPermission } = useAlertNotifications();
  const initialLoadDone = useRef(false);
  useEffect(() => {
    const fetchTriggeredAlerts = async () => {
      if (isDemoMode) {
        setAlerts(DEMO_TRIGGERED_ALERTS);
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('portfolio_alerts')
          .select('id, symbol, alert_type, threshold_percent, trigger_value, triggered_at, notes')
          .eq('user_id', user.id)
          .not('triggered_at', 'is', null)
          .order('triggered_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        setAlerts((data as TriggeredAlert[]) || []);
      } catch (err) {
        console.error('Failed to fetch triggered alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTriggeredAlerts();
    initialLoadDone.current = true;
  }, [user?.id, isDemoMode]);

  // Subscribe to realtime updates for live alert triggers
  useEffect(() => {
    if (isDemoMode || !user?.id) return;

    const channel = supabase
      .channel('recent-triggered-alerts')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'portfolio_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as TriggeredAlert & { user_id: string };
          if (updated.triggered_at) {
            // Play sound + desktop notification for new triggers
            if (initialLoadDone.current && soundEnabled) {
              const detail = updated.notes || undefined;
              notifyAlert(updated.symbol, updated.alert_type, detail);
            }
            setAlerts((prev) => {
              const exists = prev.find((a) => a.id === updated.id);
              const next = exists
                ? prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
                : [updated, ...prev];
              return next
                .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime())
                .slice(0, 5);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isDemoMode, soundEnabled, notifyAlert]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      requestPermission();
    }
  }, [requestPermission]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem('alert-sound-enabled', String(next)); } catch {}
      return next;
    });
  };

  const getConfig = (type: string) =>
    ALERT_CONFIG[type] || {
      label: type.replace('_', ' '),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Recent Triggered Alerts
        </h3>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={toggleSound}
              >
                {soundEnabled ? (
                  <Bell className="w-4 h-4 text-primary" />
                ) : (
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {soundEnabled ? 'Mute alert sounds' : 'Enable alert sounds'}
            </TooltipContent>
          </Tooltip>
          <button
            onClick={() => switchView('price-alerts')}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No alerts have triggered yet.</p>
          <p className="text-xs mt-1">Create portfolio alerts to monitor your positions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = getConfig(alert.alert_type);
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl border border-border hover:border-primary/30 transition-colors"
              >
                <div className={`p-2 rounded-lg ${config.bgColor} ${config.color} shrink-0`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-foreground text-sm">{alert.symbol}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                    <AlertSeverityBadge severity={getAlertSeverity(alert.alert_type)} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatTriggerDetail(alert)}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {alert.triggered_at
                      ? formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })
                      : 'Unknown'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
