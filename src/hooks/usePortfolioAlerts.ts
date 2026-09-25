import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { DEMO_PORTFOLIO_ALERTS } from '@/constants/demoPortfolioAlerts';

export type AlertType = 
  | 'price_movement' 
  | 'dividend_cut' 
  | 'earnings_surprise' 
  | 'dividend_increase'
  | 'volume_spike'
  | 'rsi_threshold'
  | 'ma_crossover';

export interface PortfolioAlert {
  id: string;
  user_id: string;
  symbol: string;
  alert_type: AlertType;
  threshold_percent: number | null;
  is_active: boolean;
  triggered_at: string | null;
  trigger_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const usePortfolioAlerts = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    // Return demo data in demo mode
    if (isDemoMode) {
      setAlerts(DEMO_PORTFOLIO_ALERTS);
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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data as PortfolioAlert[]) || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemoMode]);

  const createAlert = useCallback(async (
    symbol: string,
    alertType: PortfolioAlert['alert_type'],
    thresholdPercent?: number,
    notes?: string
  ) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('portfolio_alerts')
        .insert({
          user_id: user.id,
          symbol: symbol.toUpperCase(),
          alert_type: alertType,
          threshold_percent: thresholdPercent || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      setAlerts(prev => [data as PortfolioAlert, ...prev]);
      toast.success(`Alert created for ${symbol}`);
      return data;
    } catch (error) {
      console.error('Failed to create alert:', error);
      toast.error('Failed to create alert');
      return null;
    }
  }, [user?.id]);

  const updateAlert = useCallback(async (
    alertId: string,
    updates: Partial<Pick<PortfolioAlert, 'threshold_percent' | 'is_active' | 'notes'>>
  ) => {
    try {
      const { error } = await supabase
        .from('portfolio_alerts')
        .update(updates)
        .eq('id', alertId);

      if (error) throw error;
      
      setAlerts(prev => 
        prev.map(a => a.id === alertId ? { ...a, ...updates } : a)
      );
      toast.success('Alert updated');
    } catch (error) {
      console.error('Failed to update alert:', error);
      toast.error('Failed to update alert');
    }
  }, []);

  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert deleted');
    } catch (error) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    createAlert,
    updateAlert,
    deleteAlert,
    refetch: fetchAlerts,
  };
};
