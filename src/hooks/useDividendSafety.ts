import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SafetyRating {
  symbol: string;
  name: string | null;
  score: number;
  grade: string;
  payout_ratio: number | null;
  coverage_ratio: number | null;
  growth_streak: number | null;
  five_yr_growth: number | null;
  dividend_yield: number | null;
  annual_dividend: number | null;
  frequency: string | null;
  last_ex_date: string | null;
  next_ex_date: string | null;
  next_pay_date: string | null;
  risks: string[];
  updated_at: string;
}

const normalize = (rows: any[]): Record<string, SafetyRating> => {
  const map: Record<string, SafetyRating> = {};
  for (const r of rows || []) {
    map[r.symbol] = { ...r, risks: Array.isArray(r.risks) ? r.risks : [] };
  }
  return map;
};

/** Fetches (and refreshes) dividend safety ratings for a list of symbols. */
export function useDividendSafety(symbols: string[]) {
  const [ratings, setRatings] = useState<Record<string, SafetyRating>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = symbols.map(s => s.toUpperCase()).sort().join(',');

  const load = useCallback(async (refresh = false) => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setRatings({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!refresh) {
        const { data } = await supabase
          .from('dividend_safety_ratings')
          .select('*')
          .in('symbol', list);
        if (data && data.length > 0) setRatings(normalize(data));
      }
      const { data: fresh, error: fnError } = await supabase.functions.invoke('dividend-safety', {
        body: { symbols: list, refresh },
      });
      if (fnError) throw fnError;
      if (fresh?.ratings) setRatings(prev => ({ ...prev, ...normalize(fresh.ratings) }));
    } catch (e: any) {
      setError(e?.message || 'Could not load dividend safety data');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { load(false); }, [load]);

  return { ratings, loading, error, refresh: () => load(true) };
}
