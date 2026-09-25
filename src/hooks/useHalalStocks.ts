import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HalalStockDB {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  dividend_yield: number;
  pe_ratio: number | null;
  market_cap: number | null;
  compliance_grade: string;
  debt_to_market_cap: number | null;
  cash_to_market_cap: number | null;
  receivables_to_market_cap: number | null;
  non_permissible_revenue_pct: number;
  business_screen_passed: boolean;
  financial_screen_passed: boolean;
  overall_compliant: boolean;
  purification_per_share: number;
  screening_notes: string | null;
  screened_at: string;
}

function formatMarketCap(value: number | null): string {
  if (!value || value <= 0) return 'N/A';
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toString();
}

export function useHalalStocks() {
  const [stocks, setStocks] = useState<HalalStockDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);
  const [screeningProgress, setScreeningProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('halal_stocks')
        .select('*')
        .order('compliance_grade', { ascending: true })
        .order('symbol', { ascending: true });

      if (dbError) throw dbError;
      setStocks(data || []);
    } catch (e: any) {
      console.error('Error fetching halal stocks:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const runScreening = useCallback(async () => {
    setScreening(true);
    setScreeningProgress('Starting AI Shariah screening...');
    let totalInserted = 0;
    let batchIndex = 0;
    
    try {
      toast.info('Starting AI Shariah screening...');
      
      let hasMore = true;
      while (hasMore) {
        setScreeningProgress(`Processing batch ${batchIndex + 1}...`);
        
        const { data, error: fnError } = await supabase.functions.invoke('screen-halal-stocks', {
          body: { batchIndex },
        });

        if (fnError) throw fnError;
        
        totalInserted += data?.inserted || 0;
        hasMore = data?.hasMore || false;
        batchIndex++;
        
        setScreeningProgress(`Batch ${batchIndex} done — ${totalInserted} stocks saved so far`);
        await fetchStocks();
        
        if (data?.done) break;
      }

      toast.success(`Screening complete! ${totalInserted} stocks analyzed and saved.`);
    } catch (e: any) {
      console.error('Screening error:', e);
      toast.error(`Screening failed: ${e.message}`);
      await fetchStocks();
    } finally {
      setScreening(false);
      setScreeningProgress('');
    }
  }, [fetchStocks]);

  // Screen specific symbols (e.g. portfolio holdings not in DB)
  const screenSymbols = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setScreening(true);
    setScreeningProgress(`Screening ${symbols.length} portfolio holdings...`);
    
    try {
      toast.info(`Screening ${symbols.length} holdings for Shariah compliance...`);
      
      const { data, error: fnError } = await supabase.functions.invoke('screen-halal-stocks', {
        body: { symbols },
      });

      if (fnError) throw fnError;
      
      await fetchStocks();
      toast.success(`Portfolio screening complete! ${data?.inserted || 0} stocks analyzed.`);
    } catch (e: any) {
      console.error('Portfolio screening error:', e);
      toast.error(`Screening failed: ${e.message}`);
      await fetchStocks();
    } finally {
      setScreening(false);
      setScreeningProgress('');
    }
  }, [fetchStocks]);

  const sectorIcons: Record<string, string> = {
    'Technology': '💻', 'Healthcare': '🏥', 'Industrials': '🏭',
    'Consumer Defensive': '🛒', 'Consumer Cyclical': '🛍️', 'Consumer': '🛒',
    'Consumer Goods': '🛒', 'Energy': '⚡', 'Semiconductors': '🔬',
    'Real Estate': '🏢', 'Automobiles': '🚗', 'Communications': '📡',
    'Communication Services': '📡', 'Materials': '🪨', 'Basic Materials': '🪨',
    'Utilities': '💡', 'Financial Services': '🏦', 'Unknown': '📊',
  };

  // Group stocks by sector
  const stocksBySector = stocks.reduce((acc, stock) => {
    const sector = stock.sector || 'Unknown';
    if (!acc[sector]) acc[sector] = [];
    acc[sector].push(stock);
    return acc;
  }, {} as Record<string, HalalStockDB[]>);

  const mapStock = (s: HalalStockDB) => ({
    symbol: s.symbol,
    name: s.name,
    grade: s.compliance_grade as any,
    price: Number(s.price),
    change: 0,
    dividendYield: Number(s.dividend_yield) || 0,
    marketCap: formatMarketCap(s.market_cap ? Number(s.market_cap) : null),
    sector: s.sector,
    peRatio: s.pe_ratio ? Number(s.pe_ratio) : 0,
    debtToMarketCap: s.debt_to_market_cap ? Number(s.debt_to_market_cap) : null,
    cashToMarketCap: s.cash_to_market_cap ? Number(s.cash_to_market_cap) : null,
    receivablesToMarketCap: s.receivables_to_market_cap ? Number(s.receivables_to_market_cap) : null,
    nonPermissibleRevenuePct: Number(s.non_permissible_revenue_pct) || 0,
    businessScreenPassed: s.business_screen_passed,
    financialScreenPassed: s.financial_screen_passed,
    overallCompliant: s.overall_compliant,
    purificationPerShare: Number(s.purification_per_share) || 0,
    screeningNotes: s.screening_notes,
    screenedAt: s.screened_at,
  });

  const collections = Object.entries(stocksBySector).map(([name, sectorStocks]) => ({
    name,
    icon: sectorIcons[name] || '📊',
    count: sectorStocks.length,
    stocks: sectorStocks.map(mapStock),
  })).sort((a, b) => b.count - a.count);

  const allHalalStocks = stocks.map(mapStock);

  // Stats derived from DB data
  const compliantCount = stocks.filter(s => s.overall_compliant).length;
  const nonCompliantCount = stocks.filter(s => !s.overall_compliant).length;
  const borderlineCount = stocks.filter(s => s.compliance_grade === 'C' || s.compliance_grade === 'D').length;

  return {
    stocks,
    allHalalStocks,
    collections,
    loading,
    screening,
    screeningProgress,
    error,
    runScreening,
    screenSymbols,
    refetch: fetchStocks,
    hasData: stocks.length > 0,
    stats: { compliantCount, nonCompliantCount, borderlineCount, total: stocks.length },
  };
}
