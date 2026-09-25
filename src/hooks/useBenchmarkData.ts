import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BenchmarkPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  source: string;
}

interface BenchmarkData {
  spy: BenchmarkPrice | null;
  qqq: BenchmarkPrice | null;
  loading: boolean;
  error: string | null;
}

export const useBenchmarkData = () => {
  const [data, setData] = useState<BenchmarkData>({
    spy: null,
    qqq: null,
    loading: true,
    error: null,
  });

  const fetchBenchmarks = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const { data: result, error } = await supabase.functions.invoke('market-data', {
        body: { 
          symbols: ['SPY', 'QQQ'], 
          type: 'stock' 
        },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to fetch benchmark data');
      }
      
      if (!result?.prices) {
        throw new Error('No benchmark data received');
      }
      
      setData({
        spy: result.prices['SPY'] || null,
        qqq: result.prices['QQQ'] || null,
        loading: false,
        error: null,
      });
      
      return result.prices;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch benchmarks';
      setData(prev => ({
        ...prev,
        loading: false,
        error: message,
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    fetchBenchmarks();
  }, [fetchBenchmarks]);

  return { ...data, refetch: fetchBenchmarks };
};
