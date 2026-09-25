import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FMP_API_KEY = Deno.env.get('FMP_API_KEY');

interface FundamentalsData {
  symbol: string;
  fcf: number | null;
  eps: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  peRatio: number | null;
  forwardPe: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  dividendYield: number | null;
  roe: number | null;
  debtToEquity: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  dcfValue: number | null;
  currentPrice: number | null;
}

async function fetchFMP(endpoint: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`https://financialmodelingprep.com/api/v3/${endpoint}?apikey=${FMP_API_KEY}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function getFundamentals(symbol: string): Promise<FundamentalsData> {
  const result: FundamentalsData = {
    symbol,
    fcf: null, eps: null, revenueGrowth: null, epsGrowth: null,
    peRatio: null, forwardPe: null, pbRatio: null, psRatio: null,
    dividendYield: null, roe: null, debtToEquity: null,
    marketCap: null, sector: null, industry: null,
    dcfValue: null, currentPrice: null,
  };

  // Fetch quote, key metrics, DCF, and profile in parallel
  const [quoteData, metricsData, dcfData, profileData, growthData] = await Promise.all([
    fetchFMP(`quote/${symbol}`),
    fetchFMP(`key-metrics-ttm/${symbol}`),
    fetchFMP(`discounted-cash-flow/${symbol}`),
    fetchFMP(`profile/${symbol}`),
    fetchFMP(`financial-growth/${symbol}`),
  ]);

  // Quote
  if (Array.isArray(quoteData) && quoteData[0]) {
    const q = quoteData[0];
    result.currentPrice = q.price ?? null;
    result.peRatio = q.pe ?? null;
    result.eps = q.eps ?? null;
    result.marketCap = q.marketCap ?? null;
  }

  // Profile
  if (Array.isArray(profileData) && profileData[0]) {
    const p = profileData[0];
    result.sector = p.sector ?? null;
    result.industry = p.industry ?? null;
    result.currentPrice = result.currentPrice ?? p.price ?? null;
    result.peRatio = result.peRatio ?? p.peRatio ?? null;
  }

  // Key metrics TTM
  if (Array.isArray(metricsData) && metricsData[0]) {
    const m = metricsData[0];
    result.peRatio = m.peRatioTTM ?? result.peRatio;
    result.pbRatio = m.pbRatioTTM ?? null;
    result.psRatio = m.priceToSalesRatioTTM ?? null;
    result.dividendYield = m.dividendYieldTTM ? m.dividendYieldTTM * 100 : null;
    result.roe = m.roeTTM ? m.roeTTM * 100 : null;
    result.debtToEquity = m.debtToEquityTTM ?? null;
    result.fcf = m.freeCashFlowPerShareTTM ?? null;
    result.eps = m.netIncomePerShareTTM ?? result.eps;
    result.forwardPe = m.peRatioTTM ?? null; // approximation
  }

  // DCF
  if (Array.isArray(dcfData) && dcfData[0]) {
    result.dcfValue = dcfData[0].dcf ?? null;
  }

  // Growth
  if (Array.isArray(growthData) && growthData[0]) {
    const g = growthData[0];
    result.revenueGrowth = g.revenueGrowth ? g.revenueGrowth * 100 : null;
    result.epsGrowth = g.epsgrowth ? g.epsgrowth * 100 : null;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!FMP_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'FMP_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { symbols } = await req.json();
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: 'symbols array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 10 symbols per request
    const limitedSymbols = symbols.slice(0, 10);
    
    // Fetch all in parallel
    const results: Record<string, FundamentalsData> = {};
    const fetches = limitedSymbols.map(async (sym: string) => {
      const data = await getFundamentals(sym);
      results[sym] = data;
    });
    
    await Promise.all(fetches);

    return new Response(
      JSON.stringify({ fundamentals: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('stock-fundamentals error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
