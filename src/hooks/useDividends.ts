import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DEMO_DIVIDENDS } from '@/constants/demoDividends';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

export interface DbDividend {
  id: string;
  holding_id: string;
  portfolio_id: string;
  symbol: string;
  amount: number;
  ex_date: string;
  pay_date: string | null;
  frequency: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Irregular' | null;
  is_estimated: boolean;
  created_at: string;
}

export const useDividends = (portfolioId?: string) => {
  const { user } = useAuth();
  const [dividends, setDividends] = useState<DbDividend[]>([]);
  const [loading, setLoading] = useState(true);

  // Demo mode is active when: no user OR demo user OR user has explicitly enabled demo mode in settings
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();

  const fetchDividends = useCallback(async () => {
    // In demo mode, return demo data immediately
    if (isDemoMode) {
      const demoDividends: DbDividend[] = DEMO_DIVIDENDS.map(d => ({
        ...d,
        pay_date: d.pay_date,
        created_at: new Date().toISOString()
      }));
      setDividends(demoDividends);
      setLoading(false);
      return;
    }

    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let query = supabase
        .from('dividends')
        .select('*')
        .order('ex_date', { ascending: false });

      if (portfolioId) {
        if (!UUID_RE.test(portfolioId)) {
          setDividends([]);
          setLoading(false);
          return;
        }
        query = query.eq('portfolio_id', portfolioId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDividends((data || []) as unknown as DbDividend[]);
    } catch (err: any) {
      console.error('Failed to fetch dividends:', err?.message || err?.code || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, portfolioId]);

  useEffect(() => {
    fetchDividends();
  }, [fetchDividends]);

  const addDividend = async (dividend: Omit<DbDividend, 'id' | 'created_at'>) => {
    if (isDemoMode) return null;
    
    const { data, error } = await supabase
      .from('dividends')
      .insert(dividend)
      .select()
      .single();

    if (error) throw error;
    await fetchDividends();
    return data;
  };

  const deleteDividend = async (dividendId: string) => {
    if (isDemoMode) return;
    
    const { error } = await supabase
      .from('dividends')
      .delete()
      .eq('id', dividendId);

    if (error) throw error;
    await fetchDividends();
  };

  // Calculate dividend statistics
  const stats = {
    totalAnnual: dividends.reduce((sum, d) => sum + Number(d.amount), 0),
    monthlyAverage: dividends.length > 0 ? dividends.reduce((sum, d) => sum + Number(d.amount), 0) / 12 : 0,
    upcomingDividends: dividends.filter(d => new Date(d.ex_date) > new Date()),
    lastPayment: dividends.length > 0 ? dividends[0] : null
  };

  return {
    dividends,
    loading,
    addDividend,
    deleteDividend,
    stats,
    refetch: fetchDividends,
    isDemoMode
  };
};
