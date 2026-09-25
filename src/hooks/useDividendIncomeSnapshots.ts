import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { format, subMonths } from 'date-fns';

export interface IncomeSnapshot {
  month: string; // YYYY-MM
  monthly_income: number;
  annual_income: number;
  average_yield: number;
}

export const useDividendIncomeSnapshots = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [snapshots, setSnapshots] = useState<IncomeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSnapshots = useCallback(async () => {
    if (isDemoMode) {
      // Generate synthetic demo data
      const now = new Date();
      const demo: IncomeSnapshot[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(now, i);
        const key = format(d, 'yyyy-MM');
        // Simulate growing income
        const base = 60 + (11 - i) * 3 + Math.random() * 10;
        demo.push({
          month: key,
          monthly_income: parseFloat(base.toFixed(2)),
          annual_income: parseFloat((base * 12).toFixed(2)),
          average_yield: parseFloat((2.0 + (11 - i) * 0.05).toFixed(2)),
        });
      }
      setSnapshots(demo);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('dividend_income_snapshots')
        .select('month, monthly_income, annual_income, average_yield')
        .order('month', { ascending: true })
        .limit(24);

      if (error) throw error;
      setSnapshots((data || []) as IncomeSnapshot[]);
    } catch (err) {
      console.error('Failed to fetch income snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const recordSnapshot = useCallback(async (monthlyIncome: number, annualIncome: number, averageYield: number) => {
    if (isDemoMode || !user) return;

    const currentMonth = format(new Date(), 'yyyy-MM');
    try {
      const { error } = await supabase
        .from('dividend_income_snapshots')
        .upsert({
          user_id: user.id,
          month: currentMonth,
          monthly_income: monthlyIncome,
          annual_income: annualIncome,
          average_yield: averageYield,
        }, { onConflict: 'user_id,month' });

      if (error) throw error;
      await fetchSnapshots();
    } catch (err) {
      console.error('Failed to record income snapshot:', err);
    }
  }, [isDemoMode, user, fetchSnapshots]);

  return { snapshots, loading, recordSnapshot };
};
