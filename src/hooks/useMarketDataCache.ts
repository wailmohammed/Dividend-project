import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CachedMarketData {
  id: string;
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  dividend_yield: number;
  sector: string | null;
  volume: number | null;
  market_cap: number | null;
  high_52w: number | null;
  low_52w: number | null;
  pe_ratio: number | null;
  eps: number | null;
  source: string;
  updated_at: string;
}

export const useMarketDataCache = (symbols: string[] = []) => {
  const [data, setData] = useState<Map<string, CachedMarketData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const cleanSymbol = (symbol: string) => {
    return symbol.replace(/_[A-Z]+_[A-Z]+$/, '').toUpperCase();
  };

  const fetchFromCache = useCallback(async () => {
    if (symbols.length === 0) return;

    setLoading(true);
    try {
      const cleanedSymbols = [...new Set(symbols.map(cleanSymbol))];
      
      const { data: cachedData, error } = await supabase
        .from('market_data_cache')
        .select('*')
        .in('symbol', cleanedSymbols);

      if (error) throw error;

      const dataMap = new Map<string, CachedMarketData>();
      cachedData?.forEach((item: CachedMarketData) => {
        if (!item.source || item.source === 'mock' || !(Number(item.price) > 0)) return;
        dataMap.set(item.symbol, item);
      });
      
      setData(dataMap);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch from cache:', error);
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  const triggerSync = useCallback(async () => {
    try {
      toast.info('Syncing market data...');
      const { error } = await supabase.functions.invoke('scheduled-sync');
      if (error) throw error;
      
      // Refetch from cache after sync
      setTimeout(fetchFromCache, 2000);
      toast.success('Market data synced successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync market data');
    }
  }, [fetchFromCache]);

  const getPrice = useCallback((symbol: string): CachedMarketData | undefined => {
    return data.get(cleanSymbol(symbol));
  }, [data]);

  // Fetch on mount and when symbols change
  useEffect(() => {
    fetchFromCache();
  }, [fetchFromCache]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (symbols.length === 0) return;

    const cleanedSymbols = [...new Set(symbols.map(cleanSymbol))];
    
    // Create channel for realtime updates
    channelRef.current = supabase
      .channel('market-data-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'market_data_cache',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'symbol' in payload.new) {
            const newData = payload.new as CachedMarketData;
            
            // Only update if it's a symbol we're tracking
            if (cleanedSymbols.includes(newData.symbol) && newData.source !== 'mock' && Number(newData.price) > 0) {
              setData(prev => {
                const updated = new Map(prev);
                const existing = updated.get(newData.symbol);
                
                // Log price change for debugging
                if (existing && existing.price !== newData.price) {
                  console.log(`Realtime update: ${newData.symbol} $${existing.price} → $${newData.price}`);
                }
                
                updated.set(newData.symbol, newData);
                return updated;
              });
              setLastUpdate(new Date());
            }
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('Connected to market data realtime channel');
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [symbols.join(',')]);

  return {
    data,
    loading,
    lastUpdate,
    isConnected,
    getPrice,
    refetch: fetchFromCache,
    triggerSync,
  };
};
