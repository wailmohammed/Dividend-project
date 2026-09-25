import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface PortfolioSnapshot {
  id: string;
  portfolio_id: string;
  user_id: string;
  total_value: number;
  cash_balance: number;
  snapshot_date: string;
  created_at: string;
}

export const usePortfolioSnapshots = (portfolioId?: string) => {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSnapshots = useCallback(async () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user?.id || user.id === 'demo-user' || !portfolioId || !UUID_RE.test(portfolioId)) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('portfolio_id', portfolioId)
        .order('snapshot_date', { ascending: true });

      if (error) throw error;
      setSnapshots((data || []) as unknown as PortfolioSnapshot[]);
    } catch (err) {
      console.error('Failed to fetch snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, portfolioId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const saveSnapshot = useCallback(async (portfolioIdArg: string, totalValue: number, cashBalance: number = 0) => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!user?.id || user.id === 'demo-user' || !portfolioIdArg || !UUID_RE.test(portfolioIdArg)) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      const { error } = await supabase
        .from('portfolio_snapshots')
        .upsert({
          portfolio_id: portfolioIdArg,
          user_id: user.id,
          total_value: totalValue,
          cash_balance: cashBalance,
          snapshot_date: today,
        }, {
          onConflict: 'portfolio_id,snapshot_date'
        });

      if (error) throw error;
      await fetchSnapshots();
    } catch (err: any) {
      console.error('Failed to save snapshot:', err?.message || err?.code || JSON.stringify(err));
    }
  }, [user?.id, fetchSnapshots]);

  return {
    snapshots,
    loading,
    saveSnapshot,
    refetch: fetchSnapshots,
  };
};
