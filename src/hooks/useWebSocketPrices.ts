import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WebSocketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  source: string;
}

/** Subscribes to provider-backed cache updates; it does not simulate a live feed. */
export const useWebSocketPrices = (symbols: string[]) => {
  const [prices, setPrices] = useState<Map<string, WebSocketPrice>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const normalizedSymbols = useMemo(() => [...new Set(symbols.map(symbol => symbol.toUpperCase()))], [symbols.join(',')]);

  useEffect(() => {
    if (!normalizedSymbols.length) {
      setPrices(new Map());
      setConnectionStatus('disconnected');
      setIsConnected(false);
      return;
    }

    setConnectionStatus('connecting');
    const channel = supabase.channel(`market-quotes-${normalizedSymbols.join('-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_data_cache' }, payload => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row || typeof row.symbol !== 'string' || !normalizedSymbols.includes(row.symbol.toUpperCase()) || row.source === 'mock') return;
        const price = Number(row.price);
        if (!(price > 0)) return;
        const quote: WebSocketPrice = {
          symbol: row.symbol.toUpperCase(),
          price,
          change: Number(row.change) || 0,
          changePercent: Number(row.change_percent) || 0,
          timestamp: row.updated_at ? new Date(String(row.updated_at)) : new Date(),
          source: String(row.source || 'provider'),
        };
        setPrices(previous => new Map(previous).set(quote.symbol, quote));
      })
      .subscribe(status => {
        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        setConnectionStatus(connected ? 'connected' : status === 'CHANNEL_ERROR' ? 'error' : 'connecting');
      });

    return () => {
      void supabase.removeChannel(channel);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
  }, [normalizedSymbols.join('|')]);

  const getPrice = useCallback((symbol: string) => prices.get(symbol.toUpperCase()), [prices]);
  const disconnect = useCallback(() => { setIsConnected(false); setConnectionStatus('disconnected'); }, []);

  return { prices, isConnected, connectionStatus, getPrice, disconnect };
};
