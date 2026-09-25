import { supabase } from '@/integrations/supabase/client';
import { Portfolio } from '../types';

// Persistent Cache Helpers to prevent rate limits across reloads
const CACHE_PREFIX = 'wealthos_cache_v1_';

const getFromCache = <T>(key: string): T | null => {
    try {
        const item = localStorage.getItem(CACHE_PREFIX + key);
        if (item) {
            const { data, timestamp } = JSON.parse(item);
            // Cache expires after 24 hours
            if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                return data;
            }
        }
    } catch (e) {
        console.warn('Cache read error', e);
    }
    return null;
};

const saveToCache = (key: string, data: any) => {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Cache write error', e);
    }
};

const generatePortfolioHash = (portfolio: Portfolio) => {
    return `${portfolio.id}-${portfolio.holdings.length}-${portfolio.totalValue.toFixed(0)}-${portfolio.cashBalance.toFixed(0)}`;
}

interface PortfolioContextData {
    beta: number;
    yield: number;
    sectorWeights: Record<string, string>;
    costBasisSummary: string;
    recentTransactions: string[];
}

export const generatePortfolioInsight = async (portfolio: Portfolio, metrics?: PortfolioContextData): Promise<string> => {
  const hash = generatePortfolioHash(portfolio);
  const cacheKey = `insight_${hash}`;

  // Check persistent cache first
  const cached = getFromCache<string>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: {
        action: 'portfolio_insight',
        payload: {
          portfolio: {
            id: portfolio.id,
            cashBalance: portfolio.cashBalance,
            totalValue: portfolio.totalValue,
            holdings: portfolio.holdings.map(h => ({
              symbol: h.symbol,
              assetType: h.assetType,
              shares: h.shares,
              currentPrice: h.currentPrice,
              sector: h.sector,
              dividendYield: h.dividendYield
            }))
          },
          metrics
        }
      }
    });

    if (error) throw error;
    
    const text = data?.result || "Unable to generate insight at this time.";
    saveToCache(cacheKey, text);
    return text;
  } catch (error) {
    console.warn("AI Insight Error:", error);
    return "⚠️ AI Insight temporarily unavailable. Please try again later.";
  }
};

export const analyzeStockRisks = async (symbol: string): Promise<{ strengths: string[], risks: string[] }> => {
  const cacheKey = `risks_${symbol}`;

  // Check persistent cache
  const cached = getFromCache<{ strengths: string[], risks: string[] }>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: {
        action: 'stock_risks',
        payload: { symbol }
      }
    });

    if (error) throw error;
    
    const result = data?.result;
    if (result && result.strengths && result.risks) {
      saveToCache(cacheKey, result);
      return result;
    }
    
    throw new Error("Could not parse response");
  } catch (error) {
    console.warn("Stock Risks Error:", error);
    // Fallback to generic data on error
    return {
      strengths: ["Strong market position", "Consistent revenue growth", "High brand value"],
      risks: ["Regulatory challenges", "Market saturation", "Economic downturn impact"]
    };
  }
};

export const analyzeStock = async (symbol: string): Promise<string> => {
  const cacheKey = `analysis_${symbol}`;

  // Check persistent cache
  const cached = getFromCache<string>(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: {
        action: 'stock_analysis',
        payload: { symbol }
      }
    });

    if (error) throw error;
    
    const text = data?.result || "Analysis unavailable.";
    saveToCache(cacheKey, text);
    return text;
  } catch (error) {
    console.warn("Stock Analysis Error:", error);
    return "Analysis temporarily unavailable.";
  }
};
