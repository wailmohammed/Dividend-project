import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useEnrichHoldings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrichHoldings = useCallback(async (portfolioId?: string, symbols?: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call the dedicated dividend enrichment function
      const { data, error: fnError } = await supabase.functions.invoke('enrich-dividends', {
        body: { 
          portfolioId,
          symbols,
        },
      });
      
      if (fnError) {
        throw new Error(fnError.message || 'Failed to enrich holdings');
      }
      
      if (data?.enriched > 0) {
        toast.success(`Updated dividend data for ${data.enriched} holdings`);
      } else {
        toast.info('No additional dividend data available');
      }
      
      return data;
    } catch (err: any) {
      const message = err.message || 'Failed to enrich holdings';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Also provide a quick market data enrichment for prices
  const enrichPrices = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-data', {
        body: { 
          symbols, 
          type: 'mixed',
          enrichHoldings: true 
        },
      });
      
      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch prices');
      }
      
      if (!data?.prices) {
        throw new Error('No price data received');
      }
      
      const enrichedCount = Object.values(data.prices).filter(
        (p: any) => p.source !== 'mock'
      ).length;
      
      if (enrichedCount > 0) {
        toast.success(`Updated prices for ${enrichedCount} holdings`);
      }
      
      return data.prices;
    } catch (err: any) {
      const message = err.message || 'Failed to fetch prices';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { enrichHoldings, enrichPrices, loading, error };
};
