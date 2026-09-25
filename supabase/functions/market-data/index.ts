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

// Mock prices as fallback
const MOCK_PRICES: Record<string, number> = {
  'AAPL': 178.50, 'MSFT': 378.20, 'GOOGL': 141.80, 'AMZN': 178.25,
  'NVDA': 495.22, 'META': 505.45, 'TSLA': 248.50, 'JPM': 145.20,
  'JNJ': 155.40, 'KO': 62.30, 'PG': 168.90, 'VZ': 42.15, 'T': 17.85,
  'VOO': 485.50, 'VTI': 265.80, 'QQQ': 445.20, 'SPY': 525.30,
  'SCHD': 76.45, 'O': 54.10, 'MAIN': 41.50, 'ABBV': 180.00,
  'BTC': 67500.00, 'ETH': 3450.00, 'BNB': 580.00, 'SOL': 145.00,
};

// CoinGecko mapping for crypto
const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin',
  'SOL': 'solana', 'ADA': 'cardano', 'XRP': 'ripple',
  'DOT': 'polkadot', 'DOGE': 'dogecoin', 'MATIC': 'matic-network',
};

// Known dividend yields fallback
const KNOWN_DIVIDEND_YIELDS: Record<string, number> = {
  'AAPL': 0.45, 'MSFT': 0.75, 'JNJ': 2.9, 'KO': 2.75, 'PEP': 2.65,
  'PG': 2.35, 'VZ': 6.3, 'T': 5.8, 'XOM': 3.4, 'CVX': 4.2,
  'ABBV': 3.55, 'MRK': 2.5, 'PFE': 5.8, 'O': 5.4, 'MAIN': 6.1,
  'SCHD': 3.5, 'VOO': 1.35, 'VTI': 1.45, 'SPY': 1.3, 'QQQ': 0.55,
  'JEPI': 7.2, 'JEPQ': 9.5, 'QYLD': 11.5, 'RYLD': 12.0,
  'LOW': 1.85, 'HD': 2.25, 'WMT': 1.45, 'COST': 0.55,
  'JPM': 2.15, 'BAC': 2.4, 'WFC': 2.5, 'C': 3.2, 'GS': 2.3,
  'NVDA': 0.03, 'GOOGL': 0.5, 'AMZN': 0, 'META': 0.4, 'TSLA': 0,
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

function stooqCandidates(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  const candidates = new Set<string>();
  if (upper.endsWith('L') && upper.length > 3) candidates.add(`${upper.slice(0, -1).toLowerCase()}.uk`);
  candidates.add(`${upper.toLowerCase()}.uk`);
  return [...candidates];
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
    let dividendYield = KNOWN_DIVIDEND_YIELDS[symbol] || 0;
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
      dividendYield: dividendYield || KNOWN_DIVIDEND_YIELDS[symbol] || 0,
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
      dividendYield: quote.annualDividendYield || KNOWN_DIVIDEND_YIELDS[symbol] || 0,
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

// Yahoo Finance chart endpoint: last-resort provider (no key, covers ETFs/funds
// not served by Finnhub free tier, FMP or Stooq).
async function fetchFromYahoo(symbol: string): Promise<StockData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return null;

    const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    const change = Number.isFinite(prevClose) ? price - prevClose : 0;
    const changePercent = Number.isFinite(prevClose) && prevClose > 0 ? (change / prevClose) * 100 : 0;

    console.log(`Yahoo hit for ${symbol}: $${price}`);
    return {
      price,
      change,
      changePercent,
      dividendYield: KNOWN_DIVIDEND_YIELDS[symbol] || 0,
      sector: '',
    };
  } catch (error) {
    console.log(`Yahoo fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchFromStooq(symbol: string): Promise<StockData | null> {
  for (const candidate of stooqCandidates(symbol)) {
    const response = await rateLimitedFetch(
      `https://stooq.com/q/l/?s=${candidate}&f=sd2t2ohlcv&h&e=csv`
    );

    if (!response || !response.ok) continue;

    const text = await response.text();
    const [, row] = text.trim().split('\n');
    if (!row) continue;

    const [stooqSymbol, , , open, , , close, volume] = row.split(',');
    const price = Number(close);
    const openPrice = Number(open);

    if (!stooqSymbol || stooqSymbol.includes('N/D') || !Number.isFinite(price) || price <= 0) continue;

    const change = Number.isFinite(openPrice) ? price - openPrice : 0;
    const changePercent = Number.isFinite(openPrice) && openPrice > 0 ? (change / openPrice) * 100 : 0;

    return {
      price,
      change,
      changePercent,
      dividendYield: KNOWN_DIVIDEND_YIELDS[symbol] || 0,
      volume: Number.isFinite(Number(volume)) ? Number(volume) : undefined,
    };
  }

  return null;
}

function getMockPrice(symbol: string): StockData {
  const basePrice = MOCK_PRICES[symbol.toUpperCase()] || 100;
  const volatility = 0.002;
  const randomChange = (Math.random() - 0.5) * basePrice * volatility * 2;
  const price = basePrice + randomChange;
  
  return {
    price,
    change: randomChange,
    changePercent: (randomChange / basePrice) * 100,
    dividendYield: KNOWN_DIVIDEND_YIELDS[symbol.toUpperCase()] || 0,
  };
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
        if (cacheAge < CACHE_TTL_MS) {
          const originalSymbol = symbols.find((s: string) => cleanSymbol(s) === cached.symbol) || cached.symbol;
          
          results[originalSymbol.toUpperCase()] = {
            symbol: cached.symbol,
            originalSymbol: originalSymbol.toUpperCase(),
            price: Number(cached.price),
            change: Number(cached.change),
            changePercent: Number(cached.change_percent),
            dividendYield: Number(cached.dividend_yield) || KNOWN_DIVIDEND_YIELDS[cached.symbol] || 0,
            sector: cached.sector || '',
            source: 'cache',
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
          let source = 'mock';
          
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

          // Try Stooq for exchange suffixes not covered by Finnhub/FMP
          if (!priceData && type !== 'crypto') {
            priceData = await fetchFromStooq(apiSymbol);
            if (priceData) source = 'stooq';
          }
          
          // Try Yahoo as final live source before mock data
          if (!priceData && type !== 'crypto') {
            priceData = await fetchFromYahoo(apiSymbol);
            if (priceData) source = 'yahoo';
          }

          // Fall back to mock
          if (!priceData) {
            priceData = getMockPrice(apiSymbol);
            source = 'mock';
          }
          
          // Apply known dividend yield
          if (priceData && (!priceData.dividendYield || priceData.dividendYield === 0)) {
            priceData.dividendYield = KNOWN_DIVIDEND_YIELDS[apiSymbol] || 0;
          }
          
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
          if (source !== 'mock' && priceData) {
            await adminSupabase
              .from('market_data_cache')
              .upsert({
                symbol: apiSymbol,
                price: priceData.price,
                change: priceData.change,
                change_percent: priceData.changePercent,
                dividend_yield: priceData.dividendYield || 0,
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
            
            if (data && data.source !== 'mock') {
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