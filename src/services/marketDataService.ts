import { supabase } from '@/integrations/supabase/client';

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  source: string;
  lastUpdated: string;
}

export async function fetchMarketPrices(
  symbols: string[],
  type: 'stock' | 'crypto' | 'mixed' = 'mixed'
): Promise<Record<string, PriceData>> {
  if (symbols.length === 0) return {};

  try {
    const { data, error } = await supabase.functions.invoke('market-data', {
      body: { symbols, type },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (data?.prices) {
      return data.prices;
    }

    throw new Error('Invalid response from market-data function');
  } catch (error) {
    console.warn('No verified market data was returned:', error);
    return {};
  }
}

export async function fetchSinglePrice(symbol: string): Promise<PriceData | null> {
  const prices = await fetchMarketPrices([symbol]);
  return prices[symbol.toUpperCase()] || null;
}
