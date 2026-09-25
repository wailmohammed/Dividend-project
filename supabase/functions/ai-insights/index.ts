import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, payload, type, symbol, prompt: rawPrompt } = body;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let prompt = '';
    let responseFormat = 'text';
    let maxTokens = 500;

    // Legacy action-based routing
    const resolvedAction = action || type;

    if (resolvedAction === 'portfolio_insight') {
      const { portfolio, metrics } = payload;
      const holdingsSummary = portfolio.holdings
        .map((h: any) => `${h.symbol} (${h.assetType}): $${(h.shares * h.currentPrice).toFixed(0)}`)
        .join(', ');

      let advancedContext = '';
      if (metrics) {
        advancedContext = `
        Advanced Metrics:
        - Portfolio Beta: ${metrics.beta.toFixed(2)}
        - Weighted Yield: ${metrics.yield.toFixed(2)}%
        - Sector Allocation: ${JSON.stringify(metrics.sectorWeights)}
        - Cost Basis Info: ${metrics.costBasisSummary}
        - Recent Activity: ${metrics.recentTransactions.join(', ') || 'None'}
        `;
      }

      prompt = `
        Analyze the following investment portfolio summary for a daily executive briefing:
        Core Data:
        - Total Cash: $${portfolio.cashBalance}
        - Total Equity Value: $${portfolio.totalValue}
        - Holdings: ${holdingsSummary}
        ${advancedContext}
        Provide a professional, 3-4 sentence executive summary.
        1. Comment on the overall risk level (referencing beta and sectors).
        2. Mention any recent activity impact or lack thereof.
        3. Highlight one area for potential diversification or attention based on the sectors.
        Adopt a financial advisor persona. Be concise.
      `;
    } else if (resolvedAction === 'stock_analysis') {
      const sym = payload?.symbol || symbol;
      prompt = `Provide a concise fundamental analysis of ${sym} in 100 words. Focus on recent growth catalysts and primary risks.`;
    } else if (resolvedAction === 'stock_risks') {
      const sym = payload?.symbol || symbol;
      prompt = `Analyze ${sym} for an investor. Provide 3 key distinct strengths (bull case) and 3 key distinct risks (bear case). Keep them concise. Return as JSON with "strengths" and "risks" arrays only, no additional text.`;
      responseFormat = 'json';
    } else if (resolvedAction === 'narrative_analysis') {
      const p = payload || body;
      const { symbol: nSym, name, sector, price, dividendYield, peRatio } = p;
      prompt = `You are a professional equity research analyst. Write a narrative analysis for ${name} (${nSym}) in the ${sector || 'diversified'} sector, currently trading at $${price?.toFixed(2) || 'N/A'}.

Return a JSON object with these exact fields:
- "overallSentiment": one of "Bullish", "Neutral", or "Bearish"
- "summary": 2-3 sentence executive summary
- "risks": array of 4 specific risk factors (1 sentence each)
- "rewards": array of 4 specific reward factors (1 sentence each)
- "recentDevelopments": array of 3 recent developments
- "analystConsensus": one sentence
- "keyMetrics": array of 4 objects with "label", "value", and "trend" ("up"/"down"/"flat")

Consider: P/E ~${peRatio || 'N/A'}, dividend yield ~${dividendYield || 0}%.
Return ONLY valid JSON.`;
      responseFormat = 'json';
      maxTokens = 1500;
    } else if (resolvedAction === 'stock_projection') {
      const sym = payload?.symbol || symbol;
      prompt = rawPrompt || `Analyze ${sym} and provide a JSON response with:
{
  "symbol": "${sym}",
  "name": "Company Name",
  "currentPrice": 0,
  "projections": [
    {"period": "1M", "low": 0, "mid": 0, "high": 0},
    {"period": "3M", "low": 0, "mid": 0, "high": 0},
    {"period": "6M", "low": 0, "mid": 0, "high": 0},
    {"period": "1Y", "low": 0, "mid": 0, "high": 0}
  ],
  "seasonality": [{"month": "Jan", "avgReturn": 0, "winRate": 0} ... all 12],
  "signals": [{"name": "RSI (14)", "value": "58.2", "signal": "bullish|bearish|neutral"} ... RSI, MACD, 50 DMA, 200 DMA, Volume Trend, Earnings Momentum],
  "summary": "Brief analysis",
  "overallSignal": "bullish|bearish|neutral",
  "targetPrice": 0,
  "confidence": 0-100
}
Return ONLY valid JSON.`;
      responseFormat = 'json';
      maxTokens = 2000;
    } else if (resolvedAction === 'market_opportunity_scan') {
      const scanType = payload?.scanType || 'all';
      const sectors = payload?.sectors ? payload.sectors.join(', ') : 'all sectors';
      prompt = `You are an elite quantitative analyst finding hidden investment opportunities. 
Scan the current global market for ${scanType === 'all' ? 'all opportunity types' : scanType} across ${sectors}.

Return a JSON object with this structure:
{
  "opportunities": [
    {
      "symbol": "TICKER",
      "name": "Company Name",
      "category": "undervalued|momentum|breakout|dividend_gem|turnaround|sector_rotation",
      "score": 0-100,
      "currentPrice": 0,
      "targetPrice": 0,
      "upside": 0,
      "sector": "Technology",
      "catalysts": ["catalyst1", "catalyst2"],
      "riskLevel": "low|medium|high",
      "timeHorizon": "short|medium|long",
      "summary": "2 sentence thesis"
    }
  ],
  "marketRegime": "risk-on|risk-off|rotating|uncertain",
  "topThemes": ["theme1", "theme2", "theme3"],
  "sectorOutlook": [
    {"sector": "Technology", "rating": "overweight|neutral|underweight", "reason": "brief reason"}
  ]
}

Provide 8-12 real, specific stock opportunities with realistic current prices and targets.
Focus on actionable ideas with clear catalysts.
Return ONLY valid JSON.`;
      responseFormat = 'json';
      maxTokens = 3000;
    } else if (resolvedAction === 'market_intelligence') {
      prompt = `You are a senior macro strategist providing a daily market intelligence brief. Analyze current global market conditions and return a JSON object:

{
  "headline": "One-line summary of what's driving markets today",
  "marketMood": "risk-on|risk-off|mixed|cautious",
  "moodScore": 0-100,
  "keyEvents": [
    {"event": "Event description", "impact": "positive|negative|neutral", "affectedSectors": ["Tech", "Financials"], "significance": "high|medium|low"}
  ],
  "macroSignals": [
    {"indicator": "US 10Y Yield", "value": "4.25%", "trend": "rising|falling|stable", "implication": "Brief market implication"},
    {"indicator": "VIX", "value": "15.2", "trend": "falling", "implication": "Low volatility suggests complacency"},
    {"indicator": "DXY (Dollar Index)", "value": "104.5", "trend": "stable", "implication": "Dollar strength headwind for multinationals"},
    {"indicator": "Oil (WTI)", "value": "$78.50", "trend": "rising", "implication": "Energy sector tailwind"}
  ],
  "sectorRotation": {
    "inflows": ["Sector1", "Sector2"],
    "outflows": ["Sector3", "Sector4"],
    "narrative": "Brief rotation narrative"
  },
  "tradingIdeas": [
    {"type": "long|short|hedge", "description": "Brief actionable idea", "timeframe": "1-2 weeks"}
  ],
  "riskRadar": [
    {"risk": "Description", "probability": "low|medium|high", "impact": "low|medium|high"}
  ],
  "weekAhead": "2-3 sentence preview of what to watch next week"
}

Be specific with real numbers and current market conditions. Return ONLY valid JSON.`;
      responseFormat = 'json';
      maxTokens = 2500;
    } else if (resolvedAction === 'entry_exit_analysis') {
      const sym = payload?.symbol || symbol;
      prompt = `You are a technical trading analyst. Analyze ${sym} for optimal entry and exit timing.

Return JSON:
{
  "symbol": "${sym}",
  "currentPrice": 0,
  "technicalRating": "strong_buy|buy|neutral|sell|strong_sell",
  "overallScore": 0-100,
  "entryZones": [
    {"price": 0, "type": "aggressive|moderate|conservative", "reason": "Support at 50 DMA"}
  ],
  "exitTargets": [
    {"price": 0, "type": "partial|full", "reason": "Resistance at prior high"}
  ],
  "stopLoss": {"price": 0, "reason": "Below key support"},
  "indicators": [
    {"name": "RSI", "value": 0, "status": "overbought|neutral|oversold", "signal": "buy|sell|hold"},
    {"name": "MACD", "value": "Bullish crossover", "status": "bullish|bearish", "signal": "buy|sell|hold"},
    {"name": "Bollinger Bands", "value": "Near lower band", "status": "oversold|neutral|overbought", "signal": "buy|sell|hold"},
    {"name": "Stochastic", "value": 0, "status": "oversold|neutral|overbought", "signal": "buy|sell|hold"},
    {"name": "ADX", "value": 0, "status": "strong_trend|weak_trend|no_trend", "signal": "buy|sell|hold"},
    {"name": "Volume Profile", "value": "Above average", "status": "confirming|diverging", "signal": "buy|sell|hold"}
  ],
  "patterns": ["pattern1", "pattern2"],
  "summary": "2-3 sentence timing analysis"
}
Return ONLY valid JSON.`;
      responseFormat = 'json';
      maxTokens = 2000;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing AI request: ${resolvedAction}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI service error', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log(`AI response received for ${resolvedAction}`);

    if (responseFormat === 'json') {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(
            JSON.stringify({ result: parsed }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (e) {
          console.warn('JSON parse failed, returning raw content');
        }
      }
    }

    return new Response(
      JSON.stringify({ result: content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in ai-insights function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
