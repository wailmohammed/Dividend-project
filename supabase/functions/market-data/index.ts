import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY');
const FMP_API_KEY = Deno.env.get('FMP_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Cache TTL - use Supabase cache if data is less than 6 hours old
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// CoinGecko mapping for crypto
const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin',
  'SOL': 'solana', 'ADA': 'cardano', 'XRP': 'ripple',
  'DOT': 'polkadot', 'DOGE': 'dogecoin', 'MATIC': 'matic-network',
};

interface StockData {
  price: number;
  change: number;
  changePercent: number;
  dividendYield?: number;
  sector?: string;
  volume?: number;
  marketCap?: number;
  peRatio?: number;
  eps?: number;
  high52w?: number;
  low52w?: number;
}

// Clean symbol from Trading 212 format
function cleanSymbol(symbol: string): string {
  return symbol
    .trim()
    .replace(/_[A-Z]{2}_[A-Z]{2,}$/i, '')
    .replace(/(_US_EQ|_EQ|_US)$/i, '')
    .toUpperCase();
}

// Rate limiter
let lastFinnhubCall = 0;
const FINNHUB_RATE_LIMIT_MS = 150;

async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const timeSinceLastCall = now - lastFinnhubCall;
  
  if (timeSinceLastCall < FINNHUB_RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, FINNHUB_RATE_LIMIT_MS - timeSinceLastCall));
  }
  
  lastFinnhubCall = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    return null;
  }
}

async function fetchFromFinnhub(symbol: string): Promise<StockData | null> {
  if (!FINNHUB_API_KEY) return null;
  
  try {
    // Fetch quote data
    const quoteResponse = await rateLimitedFetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    
    if (!quoteResponse || !quoteResponse.ok) {
      if (quoteResponse?.status === 429) {
        console.log(`Finnhub rate limited for ${symbol}`);
      }
      return null;
    }
    
    const quoteData = await quoteResponse.json();
    if (!quoteData.c || quoteData.c <= 0) return null;

    // Fetch basic financials for dividend yield, volume, and other metrics
    let dividendYield: number | undefined;
    let sector = '';
    let volume: number | undefined;
    let peRatio: number | undefined;
    let marketCap: number | undefined;
    let high52w: number | undefined;
    let low52w: number | undefined;
    
    try {
      const metricsResponse = await rateLimitedFetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`
      );
      
      if (metricsResponse?.ok) {
        const metricsData = await metricsResponse.json();
        if (metricsData.metric) {
          const m = metricsData.metric;
          // Get dividend yield from metrics
          if (m.dividendYieldIndicatedAnnual) {
            dividendYield = m.dividendYieldIndicatedAnnual;
            console.log(`Got dividend yield for ${symbol}: ${dividendYield}%`);
          } else if (m.dividendPerShareAnnual && quoteData.c > 0) {
            dividendYield = (m.dividendPerShareAnnual / quoteData.c) * 100;
            console.log(`Calculated dividend yield for ${symbol}: ${dividendYield.toFixed(2)}%`);
          }
          // Extract volume (10-day avg trading volume in shares)
          if (m['10DayAverageTradingVolume']) {
            // Finnhub returns this in millions
            volume = m['10DayAverageTradingVolume'] * 1_000_000;
            console.log(`Got avg volume for ${symbol}: ${volume}`);
          } else if (m['3MonthAverageTradingVolume']) {
            volume = m['3MonthAverageTradingVolume'] * 1_000_000;
          }
          // Extract other metrics
          if (m.peNormalizedAnnual) peRatio = m.peNormalizedAnnual;
          if (m.marketCapitalization) marketCap = m.marketCapitalization;
          if (m['52WeekHigh']) high52w = m['52WeekHigh'];
          if (m['52WeekLow']) low52w = m['52WeekLow'];
        }
      }
      
      // Also try to get company profile for sector
      const profileResponse = await rateLimitedFetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      
      if (profileResponse?.ok) {
        const profileData = await profileResponse.json();
        if (profileData.finnhubIndustry) {
          sector = profileData.finnhubIndustry;
        }
        if (profileData.marketCapitalization) {
          marketCap = profileData.marketCapitalization;
        }
      }
    } catch (metricError) {
      console.log(`Could not fetch metrics for ${symbol}:`, metricError);
    }

    return {
      price: quoteData.c,
      change: quoteData.d || 0,
      changePercent: quoteData.dp || 0,
      dividendYield,
      sector,
      volume,
      marketCap,
      peRatio,
      high52w,
      low52w,
    };
  } catch (error) {
    console.error(`Finnhub fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchCryptoPrice(symbol: string): Promise<StockData | null> {
  const coinId = CRYPTO_MAP[symbol.toUpperCase()];
  if (!coinId) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data[coinId]) {
      return {
        price: data[coinId].usd,
        change: 0,
        changePercent: data[coinId].usd_24h_change || 0,
        dividendYield: 0,
        sector: 'Cryptocurrency',
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

// FMP (Financial Modeling Prep) as backup data source
async function fetchFromFMP(symbol: string): Promise<StockData | null> {
  if (!FMP_API_KEY) return null;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`FMP error for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const quote = data[0];
    if (!quote.price || quote.price <= 0) return null;
    
    console.log(`FMP hit for ${symbol}: $${quote.price}`);
    
    return {
      price: quote.price,
      change: quote.change || 0,
      changePercent: quote.changesPercentage || 0,
      dividendYield: Number.isFinite(Number(quote.annualDividendYield)) ? Number(quote.annualDividendYield) : undefined,
      sector: quote.sector || '',
      volume: quote.volume || undefined,
      marketCap: quote.marketCap ? quote.marketCap / 1_000_000 : undefined,
      peRatio: quote.pe || undefined,
      high52w: quote.yearHigh || undefined,
      low52w: quote.yearLow || undefined,
      eps: quote.eps || undefined,
    };
  } catch (error) {
    console.log(`FMP fetch error for ${symbol}:`, error);
    return null;
  }
}

// Free Alpha Vantage daily candles are end-of-day data, not a real-time quote.
async function fetchFromAlphaVantage(symbol: string): Promise<StockData | null> {
  if (!ALPHA_VANTAGE_API_KEY) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const url = new URL('https://www.alphavantage.co/query');
    url.searchParams.set('function', 'TIME_SERIES_DAILY');
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('outputsize', 'compact');
    url.searchParams.set('apikey', ALPHA_VANTAGE_API_KEY);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const json = await response.json();
    const series = json?.['Time Series (Daily)'];
    if (!series || json?.Note || json?.Information || json?.['Error Message']) return null;
    const dates = Object.keys(series).sort().reverse();
    const latest = Number(series[dates[0]]?.['4. close']);
    const previous = Number(series[dates[1]]?.['4. close']);
    if (!Number.isFinite(latest) || latest <= 0) return null;
    const change = Number.isFinite(previous) ? latest - previous : 0;
    return {
      price: latest,
      change,
      changePercent: Number.isFinite(previous) && previous > 0 ? (change / previous) * 100 : 0,
    };
  } catch (error) {
    console.log(`Alpha Vantage fetch error for ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} }
    });

    // Use service role for cache operations
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { symbols, type = 'stock', enrichHoldings = false } = await req.json();
    
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: 'symbols array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching prices for ${symbols.length} symbols, type: ${type}`);
    
    const results: Record<string, any> = {};
    const symbolsToFetch: string[] = [];

    // Step 1: Check Supabase cache first
    const cleanedSymbols = symbols.map((s: string) => cleanSymbol(s));
    const { data: cachedData, error: cacheError } = await adminSupabase
      .from('market_data_cache')
      .select('*')
      .in('symbol', cleanedSymbols);

    if (!cacheError && cachedData) {
      const now = Date.now();
      
      for (const cached of cachedData) {
        const cacheAge = now - new Date(cached.updated_at).getTime();
        
        // Use cache if less than 6 hours old
        if (cacheAge < CACHE_TTL_MS && Number(cached.price) > 0 && cached.source !== 'mock') {
          const originalSymbol = symbols.find((s: string) => cleanSymbol(s) === cached.symbol) || cached.symbol;
          
          results[originalSymbol.toUpperCase()] = {
            symbol: cached.symbol,
            originalSymbol: originalSymbol.toUpperCase(),
            price: Number(cached.price),
            change: Number(cached.change),
            changePercent: Number(cached.change_percent),
            dividendYield: cached.dividend_yield == null ? undefined : Number(cached.dividend_yield),
            sector: cached.sector || '',
            source: cached.source || 'cache',
            lastUpdated: cached.updated_at,
          };
          
          // Also add cleaned symbol key
          if (originalSymbol.toUpperCase() !== cached.symbol) {
            results[cached.symbol] = results[originalSymbol.toUpperCase()];
          }
          
          console.log(`Cache hit for ${cached.symbol}: $${cached.price}`);
        } else {
          symbolsToFetch.push(cached.symbol);
        }
      }
    }

    // Find symbols not in cache
    for (const symbol of symbols) {
      const cleanedSymbol = cleanSymbol(symbol);
      if (!results[symbol.toUpperCase()] && !results[cleanedSymbol]) {
        if (!symbolsToFetch.includes(cleanedSymbol)) {
          symbolsToFetch.push(cleanedSymbol);
        }
      }
    }

    console.log(`Cache hits: ${Object.keys(results).length / 2}, Need to fetch: ${symbolsToFetch.length}`);

    // Step 2: Fetch missing symbols from APIs (with rate limiting)
    if (symbolsToFetch.length > 0) {
      const batchSize = 5;
      
      for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
        const batch = symbolsToFetch.slice(i, i + batchSize);
        
        for (const apiSymbol of batch) {
          let priceData: StockData | null = null;
          let source = '';
          
          // Try crypto first
          if (CRYPTO_MAP[apiSymbol]) {
            priceData = await fetchCryptoPrice(apiSymbol);
            if (priceData) source = 'coingecko';
          }
          
          // Try Finnhub
          if (!priceData && type !== 'crypto') {
            priceData = await fetchFromFinnhub(apiSymbol);
            if (priceData) source = 'finnhub';
          }
          
          // Try FMP as backup
          if (!priceData && type !== 'crypto') {
            priceData = await fetchFromFMP(apiSymbol);
            if (priceData) source = 'fmp';
          }

          // Free Alpha Vantage provides end-of-day prices when configured.
          if (!priceData && type !== 'crypto') {
            priceData = await fetchFromAlphaVantage(apiSymbol);
            if (priceData) source = 'alpha_vantage_daily';
          }

          if (!priceData) continue;
          
          // Store result
          const originalSymbol = symbols.find((s: string) => cleanSymbol(s) === apiSymbol) || apiSymbol;
          results[originalSymbol.toUpperCase()] = {
            symbol: apiSymbol,
            originalSymbol: originalSymbol.toUpperCase(),
            ...priceData,
            source,
            lastUpdated: new Date().toISOString(),
          };
          
          if (originalSymbol.toUpperCase() !== apiSymbol) {
            results[apiSymbol] = results[originalSymbol.toUpperCase()];
          }
          
          // Update cache if we got real data
          if (priceData) {
            await adminSupabase
              .from('market_data_cache')
              .upsert({
                symbol: apiSymbol,
                price: priceData.price,
                change: priceData.change,
                change_percent: priceData.changePercent,
                dividend_yield: priceData.dividendYield ?? null,
                sector: priceData.sector || null,
                volume: priceData.volume || null,
                high_52w: priceData.high52w || null,
                low_52w: priceData.low52w || null,
                market_cap: priceData.marketCap || null,
                pe_ratio: priceData.peRatio || null,
                source,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'symbol' });
          }
        }
        
        // Small delay between batches
        if (i + batchSize < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }

    // Step 3: Enrich holdings if requested
    if (enrichHoldings && authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: userHoldings } = await supabase
          .from('holdings')
          .select('id, symbol');
        
        if (userHoldings) {
          for (const holding of userHoldings) {
            const baseSymbol = cleanSymbol(holding.symbol);
            const data = results[baseSymbol];
            
            if (data) {
              await supabase
                .from('holdings')
                .update({
                  current_price: data.price,
                  dividend_yield: data.dividendYield || 0,
                  sector: data.sector || null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', holding.id);
            }
          }
        }
      }
    }

    console.log(`Returning ${Object.keys(results).length} price entries`);
    
    return new Response(
      JSON.stringify({ prices: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Market data error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', prices: {} }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
