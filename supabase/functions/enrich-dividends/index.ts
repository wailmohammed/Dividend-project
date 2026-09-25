import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Rate limiter
let lastApiCall = 0;
const RATE_LIMIT_MS = 300; // 300ms between calls for free tier

async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastCall));
  }
  
  lastApiCall = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

interface DividendData {
  dividendYield: number;
  annualDividend: number;
  dividendFrequency: string;
  exDividendDate: string | null;
  payDate: string | null;
  sector: string;
}

async function fetchDividendData(symbol: string, currentPrice: number): Promise<DividendData | null> {
  if (!FINNHUB_API_KEY) {
    console.log('No Finnhub API key configured');
    return null;
  }

  try {
    // Fetch basic financials for dividend info
    const metricsResponse = await rateLimitedFetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`
    );

    if (!metricsResponse?.ok) {
      console.log(`Metrics fetch failed for ${symbol}: ${metricsResponse?.status}`);
      return null;
    }

    const metricsData = await metricsResponse.json();
    const metrics = metricsData.metric || {};

    let dividendYield = 0;
    let annualDividend = 0;

    // Get dividend yield directly or calculate it
    if (metrics.dividendYieldIndicatedAnnual) {
      dividendYield = metrics.dividendYieldIndicatedAnnual;
      annualDividend = metrics.dividendPerShareAnnual || (currentPrice * dividendYield / 100);
    } else if (metrics.dividendPerShareAnnual && currentPrice > 0) {
      annualDividend = metrics.dividendPerShareAnnual;
      dividendYield = (annualDividend / currentPrice) * 100;
    }

    // Fetch company profile for sector
    let sector = '';
    const profileResponse = await rateLimitedFetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );

    if (profileResponse?.ok) {
      const profileData = await profileResponse.json();
      sector = profileData.finnhubIndustry || '';
    }

    // Fetch dividend calendar for dates
    let exDividendDate = null;
    let payDate = null;
    
    const today = new Date();
    const fromDate = today.toISOString().split('T')[0];
    const toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 90 days ahead
    
    const dividendResponse = await rateLimitedFetch(
      `https://finnhub.io/api/v1/calendar/ipo?from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`
    );
    
    // Also try stock dividends endpoint
    const stockDividendResponse = await rateLimitedFetch(
      `https://finnhub.io/api/v1/stock/dividend?symbol=${symbol}&from=2024-01-01&to=${toDate}&token=${FINNHUB_API_KEY}`
    );
    
    if (stockDividendResponse?.ok) {
      const dividendData = await stockDividendResponse.json();
      if (Array.isArray(dividendData) && dividendData.length > 0) {
        // Get the most recent or upcoming dividend
        const sortedDividends = dividendData.sort((a: any, b: any) => 
          new Date(b.exDate).getTime() - new Date(a.exDate).getTime()
        );
        
        const upcoming = sortedDividends.find((d: any) => new Date(d.exDate) >= today);
        const latest = upcoming || sortedDividends[0];
        
        if (latest) {
          exDividendDate = latest.exDate;
          payDate = latest.payDate;
          
          // If we don't have dividend from metrics, calculate from this data
          if (!annualDividend && latest.amount) {
            // Estimate annual based on frequency
            const frequency = latest.freq || 4; // Default quarterly
            annualDividend = latest.amount * frequency;
            if (currentPrice > 0) {
              dividendYield = (annualDividend / currentPrice) * 100;
            }
          }
        }
      }
    }

    // Determine frequency from annual dividend
    let dividendFrequency = 'quarterly';
    if (metrics.dividendPayoutFrequency) {
      dividendFrequency = metrics.dividendPayoutFrequency;
    }

    console.log(`${symbol}: yield=${dividendYield.toFixed(2)}%, annual=$${annualDividend.toFixed(2)}, sector=${sector}`);

    return {
      dividendYield,
      annualDividend,
      dividendFrequency,
      exDividendDate,
      payDate,
      sector,
    };
  } catch (error) {
    console.error(`Error fetching dividend data for ${symbol}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let userId: string | null = null;
    
    // Check if authenticated request
    if (authHeader) {
      const userSupabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userSupabase.auth.getUser();
      userId = user?.id || null;
    }

    const { portfolioId, symbols } = await req.json();

    // Get holdings to enrich
    let query = supabase
      .from('holdings')
      .select('id, symbol, current_price, dividend_yield, sector, portfolio_id');
    
    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    } else if (symbols && Array.isArray(symbols)) {
      query = query.in('symbol', symbols);
    }

    const { data: holdings, error: holdingsError } = await query;

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
    }

    if (!holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No holdings to enrich', enriched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Enriching dividend data for ${holdings.length} holdings`);

    let enrichedCount = 0;
    const errors: string[] = [];

    for (const holding of holdings) {
      try {
        const currentPrice = Number(holding.current_price) || 100;
        let dividendData = await fetchDividendData(holding.symbol, currentPrice);

        // Fallback: check market_data_cache if Finnhub didn't return yield
        if (!dividendData || dividendData.dividendYield <= 0) {
          const { data: cached } = await supabase
            .from('market_data_cache')
            .select('dividend_yield, sector')
            .eq('symbol', holding.symbol)
            .maybeSingle();

          if (cached && Number(cached.dividend_yield) > 0) {
            console.log(`${holding.symbol}: Using cached yield ${cached.dividend_yield}%`);
            dividendData = {
              dividendYield: Number(cached.dividend_yield),
              annualDividend: currentPrice * Number(cached.dividend_yield) / 100,
              dividendFrequency: 'quarterly',
              exDividendDate: null,
              payDate: null,
              sector: cached.sector || '',
            };
          }
        }

        if (dividendData && dividendData.dividendYield > 0) {
          // Update holding with dividend data
          const { error: updateError } = await supabase
            .from('holdings')
            .update({
              dividend_yield: dividendData.dividendYield,
              sector: dividendData.sector || holding.sector,
              updated_at: new Date().toISOString(),
            })
            .eq('id', holding.id);

          if (updateError) {
            errors.push(`${holding.symbol}: ${updateError.message}`);
          } else {
            enrichedCount++;
            
            // Also update or create dividend record if we have dates
            if (dividendData.exDividendDate && dividendData.annualDividend > 0) {
              const quarterlyAmount = dividendData.annualDividend / 4;
              
              const { data: existingDividend } = await supabase
                .from('dividends')
                .select('id')
                .eq('holding_id', holding.id)
                .eq('ex_date', dividendData.exDividendDate)
                .maybeSingle();

              if (!existingDividend) {
                await supabase
                  .from('dividends')
                  .insert({
                    holding_id: holding.id,
                    portfolio_id: holding.portfolio_id,
                    symbol: holding.symbol,
                    amount: quarterlyAmount,
                    ex_date: dividendData.exDividendDate,
                    pay_date: dividendData.payDate,
                    frequency: dividendData.dividendFrequency,
                    is_estimated: false,
                  });
              }
            }

            // Update market_data_cache too
            await supabase
              .from('market_data_cache')
              .update({
                dividend_yield: dividendData.dividendYield,
                sector: dividendData.sector || null,
                updated_at: new Date().toISOString(),
              })
              .eq('symbol', holding.symbol);
          }
        }
      } catch (holdingError: any) {
        errors.push(`${holding.symbol}: ${holdingError.message}`);
      }
    }

    console.log(`Enriched ${enrichedCount}/${holdings.length} holdings`);

    return new Response(
      JSON.stringify({
        success: true,
        enriched: enrichedCount,
        total: holdings.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Dividend enrichment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
