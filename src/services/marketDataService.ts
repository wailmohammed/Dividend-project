import { supabase } from '@/integrations/supabase/client';

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  source: string;
  lastUpdated: string;
}

// Fallback mock prices for offline/error scenarios
const MOCK_PRICES: Record<string, number> = {
  'AAPL': 178.50, 'MSFT': 378.20, 'GOOGL': 141.80, 'AMZN': 178.25,
  'NVDA': 495.22, 'META': 505.45, 'TSLA': 248.50, 'JPM': 145.20,
  'JNJ': 155.40, 'KO': 62.30, 'PG': 168.90, 'VZ': 42.15, 'T': 17.85,
  'VOO': 485.50, 'VTI': 265.80, 'QQQ': 445.20, 'SPY': 525.30,
  'SCHD': 76.45, 'O': 54.10, 'MAIN': 41.50, 'ABBV': 180.00,
  'BTC': 67500.00, 'ETH': 3450.00, 'BNB': 580.00, 'SOL': 145.00,
};

function generateMockPrice(symbol: string): PriceData {
  const basePrice = MOCK_PRICES[symbol.toUpperCase()] || 100;
  const volatility = 0.002;
  const randomChange = (Math.random() - 0.5) * basePrice * volatility * 2;
  const price = basePrice + randomChange;
  
  return {
    symbol: symbol.toUpperCase(),
    price,
    change: randomChange,
    changePercent: (randomChange / basePrice) * 100,
    source: 'mock',
    lastUpdated: new Date().toISOString(),
  };
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
    console.warn('Falling back to mock prices:', error);
    
    // Return mock prices as fallback
    const mockPrices: Record<string, PriceData> = {};
    for (const symbol of symbols) {
      mockPrices[symbol.toUpperCase()] = generateMockPrice(symbol);
    }
    return mockPrices;
  }
}

export async function fetchSinglePrice(symbol: string): Promise<PriceData> {
  const prices = await fetchMarketPrices([symbol]);
  return prices[symbol.toUpperCase()] || generateMockPrice(symbol);
}
