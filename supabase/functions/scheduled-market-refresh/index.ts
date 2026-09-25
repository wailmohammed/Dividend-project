import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Rate limiter for API calls
let lastApiCall = 0;
const API_RATE_LIMIT_MS = 1100; // ~1 call per second for Finnhub free tier
const CACHE_FALLBACK_MAX_AGE_MS = 48 * 60 * 60 * 1000;

async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < API_RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_MS - timeSinceLastCall));
  }
  
  lastApiCall = Date.now();
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`API error for ${url}: ${response.status}`);
      return null;
    }
    return response;
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    return null;
  }
}

interface StockData {
  price: number;
  change: number;
  changePercent: number;
  dividendYield: number;
  sector: string | null;
  source: string;
}

interface SymbolFailure {
  symbol: string;
  error: string;
}

function cleanHoldingSymbol(symbol: string): string {
  return symbol
    .trim()
    .replace(/_[A-Z]+_[A-Z]+$/i, '')
    .replace(/(_US_EQ|_EQ|_US)$/i, '')
    .toUpperCase();
}

function stooqCandidates(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  const candidates = new Set<string>();

  if (upper.endsWith('L') && upper.length > 3) {
    candidates.add(`${upper.slice(0, -1).toLowerCase()}.uk`);
  }

  candidates.add(`${upper.toLowerCase()}.uk`);
  return [...candidates];
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

    if (!stooqSymbol || stooqSymbol.includes('N/D') || !Number.isFinite(price) || price <= 0) {
      continue;
    }

    const change = Number.isFinite(openPrice) ? price - openPrice : 0;
    const changePercent = Number.isFinite(openPrice) && openPrice > 0 ? (change / openPrice) * 100 : 0;

    return {
      price,
      change,
      changePercent,
      dividendYield: 0,
      sector: null,
      source: 'stooq',
    };
  }

  return null;
}

// Yahoo Finance chart endpoint: last-resort provider (no key, covers ETFs/funds
// that Finnhub's free tier and Stooq's exchange feeds do not return).
async function fetchFromYahoo(symbol: string): Promise<StockData | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!response.ok) return null;

    const json = await response.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return null;

    const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    const change = Number.isFinite(prevClose) ? price - prevClose : 0;
    const changePercent = Number.isFinite(prevClose) && prevClose > 0 ? (change / prevClose) * 100 : 0;

    return { price, change, changePercent, dividendYield: 0, sector: null, source: 'yahoo' };
  } catch (error) {
    console.error(`Yahoo fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchStockData(symbol: string): Promise<StockData | null> {
  if (symbol.toUpperCase().endsWith('L') && symbol.length > 3) {
    const exchangeData = await fetchFromStooq(symbol);
    if (exchangeData) return exchangeData;
  }

  if (!FINNHUB_API_KEY) {
    console.warn('No FINNHUB_API_KEY configured');
    return (await fetchFromStooq(symbol)) || (await fetchFromYahoo(symbol));
  }

  try {
    // Fetch quote data
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const quoteResponse = await rateLimitedFetch(quoteUrl);
    
    if (!quoteResponse) return (await fetchFromStooq(symbol)) || (await fetchFromYahoo(symbol));
    
    const quote = await quoteResponse.json();
    
    if (!quote.c || quote.c === 0) {
      console.log(`No valid quote for ${symbol}`);
      return (await fetchFromStooq(symbol)) || (await fetchFromYahoo(symbol));
    }

    // Fetch metrics for dividend yield
    const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`;
    const metricsResponse = await rateLimitedFetch(metricsUrl);
    
    let dividendYield = 0;
    if (metricsResponse) {
      const metrics = await metricsResponse.json();
      dividendYield = metrics.metric?.currentDividendYieldTTM || 
                      metrics.metric?.dividendYieldIndicatedAnnual || 0;
    }

    // Fetch profile for sector
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const profileResponse = await rateLimitedFetch(profileUrl);
    
    let sector = null;
    if (profileResponse) {
      const profile = await profileResponse.json();
      sector = profile.finnhubIndustry || null;
    }

    return {
      price: quote.c,
      change: quote.d || 0,
      changePercent: quote.dp || 0,
      dividendYield,
      sector,
      source: 'finnhub'
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return (await fetchFromStooq(symbol)) || (await fetchFromYahoo(symbol));
  }
}

async function fetchCachedStockData(supabaseClient: any, symbol: string): Promise<StockData | null> {
  const { data } = await supabaseClient
    .from('market_data_cache')
    .select('price, change, change_percent, dividend_yield, sector, updated_at')
    .eq('symbol', symbol)
    .maybeSingle();

  if (!data) return null;

  const cacheAge = Date.now() - new Date(data.updated_at).getTime();
  if (!Number.isFinite(cacheAge) || cacheAge > CACHE_FALLBACK_MAX_AGE_MS) return null;

  return {
    price: Number(data.price),
    change: Number(data.change) || 0,
    changePercent: Number(data.change_percent) || 0,
    dividendYield: Number(data.dividend_yield) || 0,
    sector: data.sector,
    source: 'cache-fallback',
  };
}

async function notifyMarketRefreshFailure(
  supabaseClient: any,
  {
    subject,
    message,
    sendEmail,
  }: { subject: string; message: string; sendEmail: boolean }
) {
  try {
    // Find users opted-in for security emails (used for system health notifications)
    const { data: prefs } = await supabaseClient
      .from('notification_preferences')
      .select('user_id')
      .eq('email_security_alerts', true);

    const userIds = (prefs || []).map((p: any) => p.user_id).filter(Boolean);

    if (userIds.length === 0) {
      console.log('[Market Refresh] No users opted in for security alerts');
      return;
    }

    // In-app notifications
    const inserts = userIds.map((userId: string) => ({
      user_id: userId,
      actor_id: userId,
      type: 'market_sync',
      target_id: null,
      content: message,
      is_read: false,
    }));

    const { error: notifError } = await supabaseClient.from('notifications').insert(inserts);
    if (notifError) {
      console.error('[Market Refresh] Failed to insert in-app notifications:', notifError.message);
    }

    if (!sendEmail || !RESEND_API_KEY) return;

    // Emails
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const emails = (profiles || []).map((p: any) => p.email).filter(Boolean);
    for (const email of emails) {
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'WealthOS <alerts@resend.dev>',
            to: [email],
            subject,
            html: `<html><body style="font-family:Arial,sans-serif"><h2>${subject}</h2><p>${message}</p><p style="color:#666;font-size:12px">This is an automated system alert.</p></body></html>`,
          }),
        });

        if (!resp.ok) {
          console.error('[Market Refresh] Email failed:', await resp.text());
        }
      } catch (e) {
        console.error('[Market Refresh] Email error:', e);
      }
    }
  } catch (e) {
    console.error('[Market Refresh] notifyMarketRefreshFailure error:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('Starting scheduled market data refresh...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let symbolsCount = 0;

  try {
    // Get all unique symbols from holdings across all portfolios
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('symbol')
      .not('symbol', 'is', null);

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
    }

    // Get unique symbols
    const symbols = [...new Set(holdings?.map(h => cleanHoldingSymbol(h.symbol)) || [])].filter(Boolean);

    symbolsCount = symbols.length;

    console.log(`Processing ${symbols.length} unique symbols`);

    let successCount = 0;
    let errorCount = 0;
    const failures: SymbolFailure[] = [];

    for (const symbol of symbols) {
      const stockData = await fetchStockData(symbol) || await fetchCachedStockData(supabase, symbol);

      if (stockData) {
        // Update market_data_cache
        const { error: cacheError } = await supabase
          .from('market_data_cache')
          .upsert({
            symbol,
            price: stockData.price,
            change: stockData.change,
            change_percent: stockData.changePercent,
            dividend_yield: stockData.dividendYield,
            sector: stockData.sector,
            source: stockData.source,
            updated_at: new Date().toISOString()
          }, { onConflict: 'symbol' });

        if (cacheError) {
          console.error(`Cache update error for ${symbol}:`, cacheError);
          errorCount++;
        } else {
          // Also update holdings with the new data (best-effort)
          await supabase
            .from('holdings')
            .update({
              current_price: stockData.price,
              dividend_yield: stockData.dividendYield,
              sector: stockData.sector,
              updated_at: new Date().toISOString()
            })
            .ilike('symbol', `${symbol}%`);

          successCount++;
          console.log(`Updated ${symbol}: $${stockData.price}, yield: ${stockData.dividendYield}%`);
        }
      } else {
        errorCount++;
        failures.push({ symbol, error: 'No quote returned by Finnhub, Stooq, Yahoo or cache fallback' });
      }
    }

    const duration = Date.now() - startTime;

    const errorMessage =
      successCount === 0 && symbols.length > 0
        ? 'Scheduled refresh failed: no symbols updated'
        : errorCount > 0
          ? JSON.stringify(failures)
          : null;

    // Log the sync
    await supabase.from('market_sync_logs').insert({
      sync_type: 'scheduled_refresh',
      symbols_count: symbols.length,
      success_count: successCount,
      error_count: errorCount,
      duration_ms: duration,
      error_message: errorMessage,
    });

    console.log(`Refresh complete: ${successCount} success, ${errorCount} errors, ${duration}ms`);

    // Notify on failures (email only for full failure)
    if (symbols.length > 0 && (successCount === 0 || errorCount > 0)) {
      await notifyMarketRefreshFailure(supabase, {
        subject: successCount === 0 ? 'Market refresh failed' : 'Market refresh completed with errors',
        message:
          successCount === 0
            ? `The scheduled market refresh failed to update any symbols. ${errorMessage || ''}`.trim()
            : `The scheduled market refresh updated ${successCount}/${symbols.length} symbols. ${failures.map(f => f.symbol).join(', ')} failed.`.trim(),
        sendEmail: successCount === 0,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        symbolsProcessed: symbols.length,
        successCount,
        errorCount,
        durationMs: duration
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Scheduled refresh error:', error);

    // Log failure
    try {
      await supabase.from('market_sync_logs').insert({
        sync_type: 'scheduled_refresh',
        symbols_count: symbolsCount,
        success_count: 0,
        error_count: symbolsCount,
        duration_ms: duration,
        error_message: errorMessage,
      });
    } catch (e) {
      console.error('[Market Refresh] Failed to log error:', e);
    }

    // Notify failure
    await notifyMarketRefreshFailure(supabase, {
      subject: 'Market refresh failed',
      message: `The scheduled market refresh failed. ${errorMessage}`,
      sendEmail: true,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
