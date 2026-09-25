import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const STOCK_UNIVERSE = [
  'AAPL','MSFT','GOOGL','AMZN','META','NVDA','ADBE','CRM','INTC','AMD','CSCO','ORCL','TXN','AVGO','QCOM',
  'JNJ','UNH','PFE','ABT','TMO','DHR','MDT','AMGN','ISRG','ZTS','SYK','BSX','REGN','VRTX',
  'PG','KO','PEP','COST','WMT','NKE','MCD','SBUX','TGT','HD','LOW','CL','KMB','GIS','HSY',
  'CAT','DE','HON','UPS','GE','MMM','RTX','LMT','EMR','ITW',
  'XOM','CVX','COP','SLB','EOG',
  'DIS','NFLX','CMCSA','T','VZ','TMUS',
  'LIN','APD','ECL','SHW','NEM','FCX',
  'NEE','DUK','SO','AEP','D','SRE','XEL',
];

async function screenWithAI(symbols: string[]): Promise<any[]> {
  if (!LOVABLE_API_KEY || symbols.length === 0) return [];

  const prompt = `You are a Shariah finance expert. For each stock below, provide real financial data and AAOIFI Standard No. 21 compliance screening.

For each stock provide:
- Current approximate price, market cap, P/E ratio, dividend yield, sector
- AAOIFI screening: debt/market cap ratio, cash+interest-bearing/market cap, receivables/market cap, non-permissible revenue %
- Business screen pass/fail, financial screen pass/fail, overall compliant true/false
- Compliance grade: A=Fully compliant, B=Compliant minor concerns, C=Borderline, D=Non-compliant one screen, F=Clearly non-compliant
- Purification per share amount
- Brief screening notes

Return a JSON array:
[{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "sector": "Technology",
  "price": 175.50,
  "market_cap": 2800000000000,
  "pe_ratio": 28.5,
  "dividend_yield": 0.55,
  "compliance_grade": "A",
  "debt_to_market_cap": 0.15,
  "cash_to_market_cap": 0.10,
  "receivables_to_market_cap": 0.08,
  "non_permissible_revenue_pct": 0.5,
  "business_screen_passed": true,
  "financial_screen_passed": true,
  "overall_compliant": true,
  "purification_per_share": 0.02,
  "screening_notes": "Core business halal. Low debt ratios."
}]

Stocks to analyze: ${symbols.join(', ')}

Return ONLY the JSON array, no markdown.`;

  try {
    console.log(`Calling AI for ${symbols.length} stocks...`);
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a Shariah compliance expert with knowledge of current stock financials. Return valid JSON arrays only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI error ${response.status}: ${errText.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    else {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) jsonStr = arrayMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);
    console.log(`Parsed ${parsed.length} results from AI`);
    return parsed;
  } catch (e) {
    console.error('AI screening error:', e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let body: any = {};
    try { body = await req.json(); } catch { /* empty OK */ }
    
    // Support custom symbols (e.g. portfolio holdings not in universe)
    const customSymbols: string[] = body.symbols || [];
    
    if (customSymbols.length > 0) {
      // Screen specific symbols directly (no batching needed)
      console.log(`Custom screening: ${customSymbols.length} symbols: ${customSymbols.join(', ')}`);
      const results = await screenWithAI(customSymbols);
      let totalInserted = 0;

      for (const r of results) {
        const record = {
          symbol: r.symbol,
          name: r.name || r.symbol,
          sector: r.sector || 'Unknown',
          price: r.price || 0,
          dividend_yield: r.dividend_yield || 0,
          pe_ratio: r.pe_ratio || null,
          market_cap: r.market_cap || null,
          compliance_grade: r.compliance_grade || 'C',
          debt_to_market_cap: r.debt_to_market_cap ?? null,
          cash_to_market_cap: r.cash_to_market_cap ?? null,
          receivables_to_market_cap: r.receivables_to_market_cap ?? null,
          non_permissible_revenue_pct: r.non_permissible_revenue_pct ?? 0,
          business_screen_passed: r.business_screen_passed ?? true,
          financial_screen_passed: r.financial_screen_passed ?? true,
          overall_compliant: r.overall_compliant ?? true,
          purification_per_share: r.purification_per_share ?? 0,
          screening_notes: r.screening_notes || null,
          screened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('halal_stocks').upsert(record, { onConflict: 'symbol' });
        if (error) console.error(`Upsert error ${r.symbol}:`, JSON.stringify(error));
        else totalInserted++;
      }

      return new Response(
        JSON.stringify({ success: true, processed: customSymbols.length, inserted: totalInserted, done: true, hasMore: false, message: `Custom: ${totalInserted}/${customSymbols.length} saved` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const batchIndex = body.batchIndex || 0;
    const batchSize = 20;
    
    const startIdx = batchIndex * batchSize;
    const batch = STOCK_UNIVERSE.slice(startIdx, startIdx + batchSize);
    
    if (batch.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, inserted: 0, done: true, message: 'All batches complete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Batch ${batchIndex}: screening ${batch.length} stocks (${startIdx}-${startIdx + batch.length} of ${STOCK_UNIVERSE.length})`);
    
    const results = await screenWithAI(batch);
    let totalInserted = 0;

    for (const r of results) {
      const record = {
        symbol: r.symbol,
        name: r.name || r.symbol,
        sector: r.sector || 'Unknown',
        price: r.price || 0,
        dividend_yield: r.dividend_yield || 0,
        pe_ratio: r.pe_ratio || null,
        market_cap: r.market_cap || null,
        compliance_grade: r.compliance_grade || 'C',
        debt_to_market_cap: r.debt_to_market_cap ?? null,
        cash_to_market_cap: r.cash_to_market_cap ?? null,
        receivables_to_market_cap: r.receivables_to_market_cap ?? null,
        non_permissible_revenue_pct: r.non_permissible_revenue_pct ?? 0,
        business_screen_passed: r.business_screen_passed ?? true,
        financial_screen_passed: r.financial_screen_passed ?? true,
        overall_compliant: r.overall_compliant ?? true,
        purification_per_share: r.purification_per_share ?? 0,
        screening_notes: r.screening_notes || null,
        screened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('halal_stocks').upsert(record, { onConflict: 'symbol' });
      if (error) console.error(`Upsert error ${r.symbol}:`, JSON.stringify(error));
      else totalInserted++;
    }

    const hasMore = startIdx + batchSize < STOCK_UNIVERSE.length;
    console.log(`Batch ${batchIndex} done: ${totalInserted} saved`);

    return new Response(
      JSON.stringify({ success: true, processed: batch.length, inserted: totalInserted, batchIndex, hasMore, nextBatch: hasMore ? batchIndex + 1 : null, message: `Batch ${batchIndex}: ${totalInserted}/${batch.length} saved` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
