import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const CACHE_HOURS = 24;

let yahooCrumb: string | null = null;
let yahooCookie = '';

async function initYahoo(): Promise<boolean> {
  if (yahooCrumb) return true;
  try {
    const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': YAHOO_UA } });
    const setCookie = res.headers.get('set-cookie') || '';
    yahooCookie = setCookie.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, ...(yahooCookie ? { Cookie: yahooCookie } : {}) },
    });
    const crumb = (await crumbRes.text()).trim();
    if (crumb && crumb.length < 40 && !crumb.startsWith('<')) {
      yahooCrumb = crumb;
      return true;
    }
  } catch (_e) {
    console.error('Yahoo crumb unavailable');
  }
  return false;
}

async function quoteSummary(symbol: string, modules: string, attempt = 0): Promise<any | null> {
  if (!(await initYahoo())) return null;
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(yahooCrumb!)}`;
    const res = await fetch(url, { headers: { 'User-Agent': YAHOO_UA, ...(yahooCookie ? { Cookie: yahooCookie } : {}) } });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      yahooCrumb = null;
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 800));
        return quoteSummary(symbol, modules, attempt + 1);
      }
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.quoteSummary?.result?.[0] || null;
  } catch (_e) {
    return null;
  }
}

interface DivEvent { date: string; amount: number; ts: number }

async function dividendHistory(symbol: string): Promise<{ events: DivEvent[]; price: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10y&events=div`,
      { headers: { 'User-Agent': YAHOO_UA } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const divs = result?.events?.dividends || {};
    const events: DivEvent[] = Object.values(divs)
      .map((d: any) => ({ ts: d.date * 1000, date: new Date(d.date * 1000).toISOString().split('T')[0], amount: Number(d.amount) || 0 }))
      .filter(d => d.amount > 0)
      .sort((a, b) => a.ts - b.ts);
    return {
      events,
      price: Number(result?.meta?.regularMarketPrice) || 0,
      name: result?.meta?.shortName || result?.meta?.longName || '',
    };
  } catch (_e) {
    return null;
  }
}

function yearlyTotals(events: DivEvent[]): Record<number, number> {
  const totals: Record<number, number> = {};
  for (const e of events) {
    const y = new Date(e.ts).getUTCFullYear();
    totals[y] = (totals[y] || 0) + e.amount;
  }
  return totals;
}

function inferFrequency(events: DivEvent[]): { label: string; perYear: number; days: number } {
  const recent = events.slice(-5);
  if (recent.length < 2) return { label: 'quarterly', perYear: 4, days: 91 };
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) gaps.push((recent[i].ts - recent[i - 1].ts) / 86400000);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avg <= 45) return { label: 'monthly', perYear: 12, days: 30 };
  if (avg <= 120) return { label: 'quarterly', perYear: 4, days: 91 };
  if (avg <= 240) return { label: 'semi-annual', perYear: 2, days: 182 };
  return { label: 'annual', perYear: 1, days: 365 };
}

function gradeFor(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

async function analyze(symbol: string) {
  const hist = await dividendHistory(symbol);
  if (!hist || hist.events.length === 0) return null;

  const { events, price, name } = hist;
  const freq = inferFrequency(events);
  const lastEvent = events[events.length - 1];

  // Trailing 12 months of dividends -> annual dividend
  const cutoff = Date.now() - 370 * 86400000;
  const ttm = events.filter(e => e.ts >= cutoff).reduce((s, e) => s + e.amount, 0);
  const annualDividend = ttm > 0 ? ttm : lastEvent.amount * freq.perYear;

  const summary = await quoteSummary(symbol, 'summaryDetail,financialData,defaultKeyStatistics,price,assetProfile');
  const sd = summary?.summaryDetail || {};
  const fd = summary?.financialData || {};
  const ks = summary?.defaultKeyStatistics || {};
  const px = Number(sd?.previousClose?.raw) || Number(summary?.price?.regularMarketPrice?.raw) || price || 0;

  const dividendYield = px > 0 ? (annualDividend / px) * 100 : Number(sd?.dividendYield?.raw || 0) * 100;

  const eps = Number(ks?.trailingEps?.raw) || 0;
  let payoutRatio = Number(sd?.payoutRatio?.raw) ? Number(sd.payoutRatio.raw) * 100 : (eps > 0 ? (annualDividend / eps) * 100 : 0);
  if (!isFinite(payoutRatio) || payoutRatio < 0) payoutRatio = 0;

  const shares = Number(ks?.sharesOutstanding?.raw) || 0;
  const fcf = Number(fd?.freeCashflow?.raw) || 0;
  const dividendCost = shares > 0 ? shares * annualDividend : 0;
  let coverageRatio = dividendCost > 0 && fcf > 0 ? fcf / dividendCost : (payoutRatio > 0 ? 100 / payoutRatio : 0);
  if (!isFinite(coverageRatio) || coverageRatio < 0) coverageRatio = 0;

  // Growth streak: consecutive completed years with a higher yearly total
  const totals = yearlyTotals(events);
  const thisYear = new Date().getUTCFullYear();
  const years = Object.keys(totals).map(Number).filter(y => y < thisYear).sort((a, b) => b - a);
  let growthStreak = 0;
  for (let i = 0; i < years.length - 1; i++) {
    if (totals[years[i]] > totals[years[i + 1]] * 0.999) growthStreak++;
    else break;
  }

  // 5-year dividend CAGR
  let fiveYrGrowth = 0;
  const latestFull = years[0];
  const baseYear = years.find(y => y === latestFull - 5);
  if (latestFull && baseYear && totals[baseYear] > 0) {
    fiveYrGrowth = (Math.pow(totals[latestFull] / totals[baseYear], 1 / 5) - 1) * 100;
  }

  const debtToEquity = Number(fd?.debtToEquity?.raw) || 0;

  // Pass-through vehicles (REITs, BDCs, funds/ETFs) legitimately pay out most of their
  // earnings, so earnings-based payout ratios and high yields must not be over-penalised.
  const industry = String(summary?.assetProfile?.industry || '');
  const quoteType = String(summary?.price?.quoteType || '');
  const isFund = quoteType === 'ETF' || quoteType === 'MUTUALFUND';
  const isPassThrough = isFund || /REIT/i.test(industry) || /Asset Management/i.test(industry);
  // Higher thresholds for pass-throughs; also a higher "unusually high yield" bar.
  const bands = isPassThrough ? [70, 90, 100, 120] : [35, 55, 70, 85];
  const highYieldBar = isPassThrough ? 12 : 9;
  // REIT/BDC net income is depressed by depreciation, so an earnings-based payout ratio
  // far above 100% says nothing useful — treat it as unavailable instead of a red flag.
  if (isPassThrough && payoutRatio > 120) payoutRatio = 0;

  // Scoring
  let score = 50;
  if (payoutRatio > 0) {
    if (payoutRatio < bands[0]) score += 20;
    else if (payoutRatio < bands[1]) score += 14;
    else if (payoutRatio < bands[2]) score += 6;
    else if (payoutRatio < bands[3]) score -= 8;
    else score -= 20;
  }
  if (coverageRatio >= 3) score += 15;
  else if (coverageRatio >= 2) score += 10;
  else if (coverageRatio >= 1.3) score += 4;
  else if (coverageRatio > 0 && coverageRatio < 1) score -= isPassThrough ? 8 : 18;

  score += Math.min(20, growthStreak);
  if (fiveYrGrowth > 8) score += 8;
  else if (fiveYrGrowth > 3) score += 5;
  else if (fiveYrGrowth < 0) score -= isFund ? 6 : 15;

  if (!isPassThrough && debtToEquity > 200) score -= 8;
  else if (!isPassThrough && debtToEquity > 120) score -= 4;
  if (dividendYield > highYieldBar) score -= 8;

  score = Math.max(1, Math.min(99, Math.round(score)));

  const risks: string[] = [];
  if (payoutRatio > bands[3]) risks.push('Very high payout ratio');
  else if (payoutRatio > bands[2]) risks.push('High payout ratio');
  if (!isPassThrough && coverageRatio > 0 && coverageRatio < 1.2) risks.push('Weak cash-flow coverage');
  if (fiveYrGrowth < 0) risks.push(isFund ? 'Variable distribution' : 'Dividend cut in last 5 years');
  if (!isPassThrough && debtToEquity > 200) risks.push('High debt');
  if (dividendYield > highYieldBar) risks.push('Unusually high yield');
  if (growthStreak === 0) risks.push('No current growth streak');
  if (isPassThrough) risks.push(isFund ? 'Fund distribution' : 'Pass-through structure');

  const nextEx = new Date(lastEvent.ts + freq.days * 86400000);
  const now = Date.now();
  while (nextEx.getTime() < now) nextEx.setDate(nextEx.getDate() + freq.days);
  const nextPay = new Date(nextEx.getTime() + 21 * 86400000);

  return {
    symbol,
    name,
    score,
    grade: gradeFor(score),
    payout_ratio: Number(payoutRatio.toFixed(1)),
    coverage_ratio: Number(coverageRatio.toFixed(2)),
    growth_streak: growthStreak,
    five_yr_growth: Number(fiveYrGrowth.toFixed(1)),
    dividend_yield: Number(dividendYield.toFixed(2)),
    annual_dividend: Number(annualDividend.toFixed(4)),
    frequency: freq.label,
    last_ex_date: lastEvent.date,
    next_ex_date: nextEx.toISOString().split('T')[0],
    next_pay_date: nextPay.toISOString().split('T')[0],
    risks,
    source: 'yahoo',
    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await initYahoo();
    const body = await req.json().catch(() => ({}));
    const refresh: boolean = !!body.refresh;
    if (body.detail) {
      const sym = String(body.detail).trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 12);
      const hist = await dividendHistory(sym);
      const yearly = hist ? yearlyTotals(hist.events) : {};
      const { data: scores } = await supabase.from('dividend_safety_history')
        .select('recorded_on,score,grade').eq('symbol', sym).order('recorded_on');
      return new Response(JSON.stringify({ symbol: sym, name: hist?.name ?? null, price: hist?.price ?? null, yearly, scores: scores || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const symbols: string[] = Array.from(
      new Set((body.symbols || []).map((s: string) => String(s).trim().toUpperCase()).filter(Boolean)),
    ).slice(0, 40) as string[];

    if (symbols.length === 0) {
      return new Response(JSON.stringify({ ratings: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: cached } = await supabase
      .from('dividend_safety_ratings')
      .select('*')
      .in('symbol', symbols);

    const cacheMap = new Map((cached || []).map((r: any) => [r.symbol, r]));
    const staleBefore = Date.now() - CACHE_HOURS * 3600 * 1000;
    const toFetch = symbols.filter(s => {
      const row = cacheMap.get(s);
      return refresh || !row || new Date(row.updated_at).getTime() < staleBefore;
    });

    const results: any[] = [];
    for (let i = 0; i < toFetch.length; i += 3) {
      const chunk = toFetch.slice(i, i + 3);
      const analyzed = await Promise.all(chunk.map(s => analyze(s).catch(() => null)));
      for (const r of analyzed) if (r) results.push(r);
    }

    if (results.length > 0) {
      const { error } = await supabase.from('dividend_safety_ratings').upsert(results, { onConflict: 'symbol' });
      if (error) console.error('Upsert failed:', error.message);
      for (const r of results) cacheMap.set(r.symbol, r);
    }

    return new Response(
      JSON.stringify({ ratings: symbols.map(s => cacheMap.get(s)).filter(Boolean), refreshed: results.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('dividend-safety error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
