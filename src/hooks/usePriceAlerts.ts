import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { DEMO_PRICE_ALERTS } from '@/constants/demoPriceAlerts';

export interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  alert_type: 'above' | 'below';
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WebSocketPriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export const usePriceAlerts = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const priceCallbacksRef = useRef<Map<string, (price: number) => void>>(new Map());

  const fetchAlerts = useCallback(async () => {
    // Return demo data in demo mode
    if (isDemoMode) {
      setAlerts(DEMO_PRICE_ALERTS);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('price_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data || []) as unknown as PriceAlert[]);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemoMode]);

  // Simulated WebSocket connection for price updates
  const connectWebSocket = useCallback((symbols: string[]) => {
    if (symbols.length === 0) return;

    // Simulate WebSocket with interval-based price updates
    // In production, this would connect to a real WebSocket service like Finnhub
    const simulatePriceUpdates = () => {
      symbols.forEach(symbol => {
        const callback = priceCallbacksRef.current.get(symbol);
        if (callback) {
          // Simulate price changes (±2% random fluctuation)
          const basePrice = 100 + (symbol.charCodeAt(0) % 100); // Pseudo-random base
          const fluctuation = (Math.random() - 0.5) * 4;
          const newPrice = basePrice * (1 + fluctuation / 100);
          callback(newPrice);
        }
      });
    };

    // Initial update
    simulatePriceUpdates();

    // Update every 10 seconds (simulated real-time)
    const interval = setInterval(simulatePriceUpdates, 10000);
    setWsConnected(true);

    return () => {
      clearInterval(interval);
      setWsConnected(false);
    };
  }, []);

  // Register price update callback for a symbol
  const onPriceUpdate = useCallback((symbol: string, callback: (price: number) => void) => {
    priceCallbacksRef.current.set(symbol, callback);
  }, []);

  // Unregister price update callback
  const offPriceUpdate = useCallback((symbol: string) => {
    priceCallbacksRef.current.delete(symbol);
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Auto-connect WebSocket when alerts exist
  useEffect(() => {
    const activeSymbols = alerts.filter(a => a.is_active).map(a => a.symbol);
    if (activeSymbols.length > 0) {
      const cleanup = connectWebSocket(activeSymbols);
      return cleanup;
    }
  }, [alerts, connectWebSocket]);

  const createAlert = async (symbol: string, targetPrice: number, alertType: 'above' | 'below') => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('price_alerts')
        .insert({
          user_id: user.id,
          symbol: symbol.toUpperCase(),
          target_price: targetPrice,
          alert_type: alertType,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success(`Price alert created for ${symbol}`);
      await fetchAlerts();
      return data;
    } catch (err: any) {
      toast.error('Failed to create alert');
      throw err;
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      toast.success('Alert deleted');
      await fetchAlerts();
    } catch (err: any) {
      toast.error('Failed to delete alert');
    }
  };

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .update({ is_active: isActive })
        .eq('id', alertId);

      if (error) throw error;
      toast.success(isActive ? 'Alert enabled' : 'Alert disabled');
      await fetchAlerts();
    } catch (err: any) {
      toast.error('Failed to update alert');
    }
  };

  const sendAlertNotification = async (alert: PriceAlert, currentPrice: number) => {
    if (!user?.id) return;
    
    setSendingNotification(alert.id);
    try {
      const { error } = await supabase.functions.invoke('notifications', {
        body: {
          action: 'send_price_alert_email',
          symbol: alert.symbol,
          targetPrice: alert.target_price,
          currentPrice,
          alertType: alert.alert_type,
        },
      });

      if (error) throw error;
      
      // Mark the alert as triggered in the database
      await supabase
        .from('price_alerts')
        .update({ triggered_at: new Date().toISOString(), is_active: false })
        .eq('id', alert.id);
      
      toast.success(`Email notification sent for ${alert.symbol}`);
      await fetchAlerts();
    } catch (err: any) {
      console.error('Failed to send notification:', err);
      toast.error('Failed to send email notification');
    } finally {
      setSendingNotification(null);
    }
  };

  // Check if a price triggers any alerts
  const checkPriceAgainstAlerts = useCallback((symbol: string, price: number) => {
    const matchingAlerts = alerts.filter(
      a => a.symbol.toUpperCase() === symbol.toUpperCase() && a.is_active && !a.triggered_at
    );

    for (const alert of matchingAlerts) {
      const triggered = alert.alert_type === 'above' 
        ? price >= alert.target_price 
        : price <= alert.target_price;

      if (triggered) {
        // Auto-send notification when price target is hit
        sendAlertNotification(alert, price);
      }
    }
  }, [alerts, sendAlertNotification]);

  return {
    alerts,
    loading,
    createAlert,
    deleteAlert,
    toggleAlert,
    sendAlertNotification,
    sendingNotification,
    refetch: fetchAlerts,
    // WebSocket features
    wsConnected,
    onPriceUpdate,
    offPriceUpdate,
    checkPriceAgainstAlerts,
  };
};
