import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface SyncResult {
  success: boolean;
  positions?: any[];
  cashBalance?: number;
  message?: string;
  error?: string;
}

export const useBrokerSync = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const syncBroker = async (connectionId: string, portfolioId: string): Promise<SyncResult> => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'No active session' };
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('broker-sync', {
        body: { connectionId, portfolioId, action: 'sync' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      const result: SyncResult = {
        success: data.success,
        positions: data.positions,
        cashBalance: data.cashBalance,
        message: data.message,
        error: data.error
      };

      setLastSyncResult(result);

      if (result.success) {
        toast.success(result.message || 'Portfolio synced successfully');
      } else {
        toast.error(result.error || 'Sync failed');
      }

      return result;
    } catch (err: any) {
      const result: SyncResult = {
        success: false,
        error: err.message || 'Failed to sync broker'
      };
      setLastSyncResult(result);
      toast.error(result.error!);
      return result;
    } finally {
      setSyncing(false);
    }
  };

  const syncAllBrokers = async (portfolioId: string): Promise<SyncResult[]> => {
    if (!user?.id) {
      return [{ success: false, error: 'Not authenticated' }];
    }

    setSyncing(true);
    const results: SyncResult[] = [];

    try {
      // Fetch all connected brokers
      const { data: connections, error } = await supabase
        .from('broker_connections')
        .select('id, provider_name, status')
        .eq('user_id', user.id)
        .eq('status', 'connected');

      if (error) throw error;

      if (!connections || connections.length === 0) {
        toast.info('No connected brokers to sync');
        return [{ success: true, message: 'No brokers connected' }];
      }

      // Sync each connection
      for (const conn of connections) {
        const result = await syncBroker(conn.id, portfolioId);
        results.push(result);
      }

      const successCount = results.filter(r => r.success).length;
      if (successCount === results.length) {
        toast.success(`All ${successCount} brokers synced successfully`);
      } else {
        toast.warning(`${successCount}/${results.length} brokers synced`);
      }

      return results;
    } catch (err: any) {
      const result: SyncResult = {
        success: false,
        error: err.message || 'Failed to sync brokers'
      };
      toast.error(result.error!);
      return [result];
    } finally {
      setSyncing(false);
    }
  };

  return {
    syncing,
    lastSyncResult,
    syncBroker,
    syncAllBrokers
  };
};
