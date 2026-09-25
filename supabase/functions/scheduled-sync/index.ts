import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// CoinGecko mapping for crypto
const CRYPTO_MAP: Record<string, string> = {
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin',
  'SOL': 'solana', 'ADA': 'cardano', 'XRP': 'ripple',
  'DOT': 'polkadot', 'DOGE': 'dogecoin', 'MATIC': 'matic-network',
};

// Known dividend yields for common stocks
const KNOWN_DIVIDEND_YIELDS: Record<string, number> = {
  'AAPL': 0.45, 'MSFT': 0.75, 'JNJ': 2.9, 'KO': 2.75, 'PEP': 2.65,
  'PG': 2.35, 'VZ': 6.3, 'T': 5.8, 'XOM': 3.4, 'CVX': 4.2,
  'ABBV': 3.55, 'MRK': 2.5, 'PFE': 5.8, 'O': 5.4, 'MAIN': 6.1,
  'SCHD': 3.5, 'VOO': 1.35, 'VTI': 1.45, 'SPY': 1.3, 'QQQ': 0.55,
  'JEPI': 7.2, 'JEPQ': 9.5, 'QYLD': 11.5, 'RYLD': 12.0,
  'LOW': 1.85, 'HD': 2.25, 'WMT': 1.45, 'COST': 0.55,
  'DIS': 0.9, 'CMCSA': 2.8, 'CSCO': 2.8, 'INTC': 1.4,
  'IBM': 4.6, 'VIG': 1.8, 'DVY': 3.5, 'HDV': 3.8, 'VYM': 2.9,
  'NKE': 1.45, 'UNH': 1.4, 'V': 0.75, 'MA': 0.55,
  'JPM': 2.15, 'BAC': 2.4, 'WFC': 2.5, 'C': 3.2, 'GS': 2.3,
  'NVDA': 0.03, 'GOOGL': 0.5, 'AMZN': 0, 'META': 0.4, 'TSLA': 0,
};

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  dividendYield?: number;
  sector?: string;
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
  if (upper.endsWith('L') && upper.length > 3) candidates.add(`${upper.slice(0, -1).toLowerCase()}.uk`);
  candidates.add(`${upper.toLowerCase()}.uk`);
  return [...candidates];
}

// Rate limiter
let lastApiCall = 0;
const RATE_LIMIT_MS = 250; // 4 calls per second max

async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastCall));
  }
  
  lastApiCall = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

async function fetchFromFinnhub(symbol: string): Promise<PriceData | null> {
  if (!FINNHUB_API_KEY) return null;
  
  try {
    const response = await rateLimitedFetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    
    if (!response || !response.ok) {
      if (response?.status === 429) {
        console.log(`Rate limited for ${symbol}, will retry later`);
      }
      return null;
    }
    
    const data = await response.json();
    if (!data.c || data.c <= 0) return null;

    return {
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      dividendYield: KNOWN_DIVIDEND_YIELDS[symbol] || 0,
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

async function fetchFromStooq(symbol: string): Promise<PriceData | null> {
  for (const candidate of stooqCandidates(symbol)) {
    const response = await rateLimitedFetch(
      `https://stooq.com/q/l/?s=${candidate}&f=sd2t2ohlcv&h&e=csv`
    );

    if (!response || !response.ok) continue;

    const text = await response.text();
    const [, row] = text.trim().split('\n');
    if (!row) continue;

    const [stooqSymbol, , , open, , , close] = row.split(',');
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
    };
  }

  return null;
}

async function fetchCryptoPrice(symbol: string): Promise<PriceData | null> {
  const coinId = CRYPTO_MAP[symbol.toUpperCase()];
  if (!coinId) return null;
  
  try {
    const response = await rateLimitedFetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response || !response.ok) return null;
    
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
    console.error(`Error fetching crypto ${symbol}:`, error);
    return null;
  }
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Check and trigger portfolio alerts
async function checkPortfolioAlerts(supabase: any, priceCache: Map<string, number>) {
  console.log('[Alerts] Checking portfolio alerts...');
  
  // Get all active alerts
  const { data: alerts, error } = await supabase
    .from('portfolio_alerts')
    .select('*, profiles:user_id(email, phone_number)')
    .eq('is_active', true);
  
  if (error) {
    console.error('[Alerts] Failed to fetch alerts:', error.message);
    return;
  }
  
  if (!alerts || alerts.length === 0) {
    console.log('[Alerts] No active alerts to check');
    return;
  }
  
  console.log(`[Alerts] Checking ${alerts.length} active alerts`);
  const triggeredAlerts: any[] = [];
  
  for (const alert of alerts) {
    const currentPrice = priceCache.get(alert.symbol.toUpperCase());
    if (!currentPrice) continue;
    
    let triggered = false;
    
    if (alert.alert_type === 'price_movement' && alert.threshold_percent) {
      // Get previous price from cache to check movement
      const { data: cachedData } = await supabase
        .from('market_data_cache')
        .select('price, change_percent')
        .eq('symbol', alert.symbol.toUpperCase())
        .maybeSingle();
      
      if (cachedData && Math.abs(cachedData.change_percent || 0) >= alert.threshold_percent) {
        triggered = true;
      }
    }
    
    if (triggered) {
      triggeredAlerts.push({ ...alert, currentPrice });
      
      // Update alert as triggered
      await supabase
        .from('portfolio_alerts')
        .update({
          triggered_at: new Date().toISOString(),
          trigger_value: currentPrice,
        })
        .eq('id', alert.id);
    }
  }
  
  console.log(`[Alerts] ${triggeredAlerts.length} alerts triggered`);
  
  // Send email notifications for triggered alerts
  if (triggeredAlerts.length > 0 && RESEND_API_KEY) {
    await sendAlertNotifications(triggeredAlerts);
  }
}

// Send email notifications for triggered alerts
async function sendAlertNotifications(triggeredAlerts: any[]) {
  console.log(`[Alerts] Sending notifications for ${triggeredAlerts.length} alerts`);
  
  // Group alerts by user
  const alertsByUser = new Map<string, any[]>();
  for (const alert of triggeredAlerts) {
    const userId = alert.user_id;
    if (!alertsByUser.has(userId)) {
      alertsByUser.set(userId, []);
    }
    alertsByUser.get(userId)!.push(alert);
  }
  
  for (const [userId, userAlerts] of alertsByUser) {
    const firstAlert = userAlerts[0];
    const email = firstAlert.profiles?.email;
    
    if (!email) {
      console.log(`[Alerts] No email for user ${userId}, skipping`);
      continue;
    }
    
    const alertsHtml = userAlerts.map(alert => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #333;">
          <strong>${alert.symbol}</strong>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #333;">
          ${alert.alert_type.replace('_', ' ')}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #333;">
          $${alert.currentPrice?.toFixed(2) || 'N/A'}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #333;">
          ${alert.threshold_percent ? `±${alert.threshold_percent}%` : 'N/A'}
        </td>
      </tr>
    `).join('');
    
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fff;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px;">
            <h1 style="margin-bottom: 20px; color: #fff;">🔔 Portfolio Alerts Triggered</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #ccc;">
              ${userAlerts.length} alert${userAlerts.length > 1 ? 's have' : ' has'} been triggered in your portfolio:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; color: #fff;">
              <thead>
                <tr style="background: rgba(255,255,255,0.1);">
                  <th style="padding: 12px; text-align: left;">Symbol</th>
                  <th style="padding: 12px; text-align: left;">Alert Type</th>
                  <th style="padding: 12px; text-align: left;">Current Price</th>
                  <th style="padding: 12px; text-align: left;">Threshold</th>
                </tr>
              </thead>
              <tbody>
                ${alertsHtml}
              </tbody>
            </table>
            <p style="font-size: 14px; color: #888; margin-top: 20px;">
              Triggered at ${new Date().toLocaleString()}
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
              You can manage your alerts in the Analytics → Alerts section of your dashboard.
            </p>
          </div>
        </body>
      </html>
    `;
    
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "WealthOS <alerts@resend.dev>",
          to: [email],
          subject: `🔔 ${userAlerts.length} Portfolio Alert${userAlerts.length > 1 ? 's' : ''} Triggered`,
          html: htmlContent,
        }),
      });
      
      if (response.ok) {
        console.log(`[Alerts] Email sent to ${email}`);
      } else {
        console.error(`[Alerts] Email failed:`, await response.text());
      }
    } catch (error) {
      console.error(`[Alerts] Email error:`, error);
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log('Starting scheduled market data sync...');
    
    // Get all unique symbols from holdings across all users
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('symbol');
    
    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
    }

    // Get unique symbols
    const symbolSet = new Set<string>();
    holdings?.forEach(h => {
      const cleanSymbol = cleanHoldingSymbol(h.symbol);
      symbolSet.add(cleanSymbol);
    });
    
    // Also get watchlist symbols
    const { data: watchlist } = await supabase
      .from('watchlist')
      .select('symbol');
    
    watchlist?.forEach(w => {
      const cleanSymbol = cleanHoldingSymbol(w.symbol);
      symbolSet.add(cleanSymbol);
    });

    const symbols = Array.from(symbolSet);
    console.log(`Syncing ${symbols.length} unique symbols`);

    let successCount = 0;
    let errorCount = 0;
    const priceCache = new Map<string, number>();

    // Process symbols in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      for (const symbol of batch) {
        let priceData: PriceData | null = null;
        let source = 'api';
        
        // Check if crypto
        if (CRYPTO_MAP[symbol]) {
          priceData = await fetchCryptoPrice(symbol);
          source = 'coingecko';
        } else {
          priceData = await fetchFromFinnhub(symbol);
          source = 'finnhub';
          if (!priceData) {
            priceData = await fetchFromStooq(symbol);
            source = 'stooq';
          }
        }
        
        if (priceData) {
          priceCache.set(symbol, priceData.price);
          
          // Upsert into cache
          const { error: upsertError } = await supabase
            .from('market_data_cache')
            .upsert({
              symbol,
              price: priceData.price,
              change: priceData.change,
              change_percent: priceData.changePercent,
              dividend_yield: priceData.dividendYield || KNOWN_DIVIDEND_YIELDS[symbol] || 0,
              sector: priceData.sector || null,
              source,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'symbol' });
          
          if (upsertError) {
            console.error(`Failed to cache ${symbol}:`, upsertError.message);
            errorCount++;
          } else {
            successCount++;
            console.log(`Cached ${symbol}: $${priceData.price}`);
          }
          
          // Also update holdings with current price
          const { error: updateError } = await supabase
            .from('holdings')
            .update({
              current_price: priceData.price,
              dividend_yield: priceData.dividendYield || KNOWN_DIVIDEND_YIELDS[symbol] || 0,
              updated_at: new Date().toISOString(),
            })
            .ilike('symbol', `${symbol}%`);
          
          if (updateError) {
            console.log(`Note: Could not update holdings for ${symbol}`);
          }
        } else {
          console.log(`No data for ${symbol}, using fallback`);
          errorCount++;
        }
      }
      
      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Check portfolio alerts after syncing prices
    await checkPortfolioAlerts(supabase, priceCache);

    // Trigger dividend reminders check
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dividend-reminders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const result = await response.json();
        console.log(`[Dividend Reminders] ${result.emailsSent || 0} emails sent`);
      }
    } catch (divError) {
      console.error('[Dividend Reminders] Failed to check:', divError);
    }

    const duration = Date.now() - startTime;
    
    // Log the sync operation
    await supabase.from('market_sync_logs').insert({
      sync_type: 'scheduled',
      symbols_count: symbols.length,
      success_count: successCount,
      error_count: errorCount,
      duration_ms: duration,
    });

    console.log(`Sync complete: ${successCount} success, ${errorCount} errors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        symbolsProcessed: symbols.length,
        successCount,
        errorCount,
        durationMs: duration,
        alertsChecked: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Scheduled sync error:', error);
    
    // Log the error
    await supabase.from('market_sync_logs').insert({
      sync_type: 'scheduled',
      symbols_count: 0,
      success_count: 0,
      error_count: 1,
      duration_ms: duration,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
