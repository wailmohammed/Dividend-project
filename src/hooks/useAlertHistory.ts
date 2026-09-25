import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

export interface AlertHistoryEntry {
  id: string;
  alert_id: string | null;
  symbol: string;
  alert_type: string;
  threshold_percent: number | null;
  trigger_value: number | null;
  trigger_details: string | null;
  triggered_at: string;
  notification_email_sent: boolean;
  notification_webhook_sent: boolean;
  notification_push_sent: boolean;
  notification_sms_sent: boolean;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  is_snoozed: boolean;
  snoozed_until: string | null;
  snooze_reason: string | null;
  created_at: string;
}

const DEMO_HISTORY: AlertHistoryEntry[] = [
  {
    id: '1',
    alert_id: null,
    symbol: 'AAPL',
    alert_type: 'ma_crossover',
    threshold_percent: null,
    trigger_value: 268.66,
    trigger_details: 'Golden Cross! SMA50 ($268.66) > SMA200 ($237.92), Price $275.91',
    triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notification_email_sent: true,
    notification_webhook_sent: false,
    notification_push_sent: false,
    notification_sms_sent: false,
    is_acknowledged: false,
    acknowledged_at: null,
    is_snoozed: false,
    snoozed_until: null,
    snooze_reason: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    alert_id: null,
    symbol: 'IIPR',
    alert_type: 'volume_spike',
    threshold_percent: 200,
    trigger_value: 242,
    trigger_details: 'Volume 0.5M is 242% of avg (threshold 5%)',
    triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notification_email_sent: true,
    notification_webhook_sent: false,
    notification_push_sent: false,
    notification_sms_sent: false,
    is_acknowledged: true,
    acknowledged_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    is_snoozed: false,
    snoozed_until: null,
    snooze_reason: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    alert_id: null,
    symbol: 'MSFT',
    alert_type: 'price_movement',
    threshold_percent: 5,
    trigger_value: 412.35,
    trigger_details: 'Price moved +5.2% (threshold ±5%)',
    triggered_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    notification_email_sent: true,
    notification_webhook_sent: true,
    notification_push_sent: false,
    notification_sms_sent: false,
    is_acknowledged: false,
    acknowledged_at: null,
    is_snoozed: true,
    snoozed_until: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    snooze_reason: 'Expected volatility due to earnings',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const useAlertHistory = (limit = 50) => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (isDemoMode) {
      setHistory(DEMO_HISTORY);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .eq('user_id', user.id)
        .order('triggered_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setHistory((data as AlertHistoryEntry[]) || []);
    } catch (err) {
      console.error('Failed to fetch alert history:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemoMode, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (isDemoMode || !user?.id) return;

    const channel = supabase
      .channel('alert-history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setHistory((prev) => [payload.new as AlertHistoryEntry, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isDemoMode, limit]);

  return { history, loading, refetch: fetchHistory };
};
