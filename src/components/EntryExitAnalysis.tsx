import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Crosshair, Search, Loader2, Zap, ArrowUpRight, ArrowDownRight, ShieldCheck, Target, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

import { toast } from 'sonner';
import { useStockPrice } from '@/hooks/useStockPrices';
import PriceSparkline from '@/components/PriceSparkline';
import PriceCacheControls from '@/components/PriceCacheControls';

interface Indicator {
  name: string;
  value: string | number;
  status: string;
  signal: string;
}

interface Zone {
  price: number;
  type: string;
  reason: string;
}

interface ExitTarget {
  price: number;
  type: string;
  reason: string;
}

interface TimingData {
  symbol: string;
  currentPrice: number;
  technicalRating: string;
  overallScore: number;
  entryZones: Zone[];
  exitTargets: ExitTarget[];
  stopLoss: { price: number; reason: string };
  indicators: Indicator[];
  patterns: string[];
  summary: string;
}

const DEMO_TIMING: TimingData = {
  symbol: 'NVDA',
  currentPrice: 142.5,
  technicalRating: 'buy',
  overallScore: 74,
  entryZones: [
    { price: 140, type: 'aggressive', reason: 'Near 20-day EMA support' },
    { price: 135, type: 'moderate', reason: '50-day SMA confluence zone' },
    { price: 125, type: 'conservative', reason: 'Major support at prior breakout level' },
  ],
  exitTargets: [
    { price: 155, type: 'partial', reason: 'Prior resistance / round number' },
    { price: 170, type: 'full', reason: 'All-time high retest zone' },
  ],
  stopLoss: { price: 120, reason: 'Below 200-day SMA and key support' },
  indicators: [
    { name: 'RSI (14)', value: 58, status: 'neutral', signal: 'hold' },
    { name: 'MACD', value: 'Bullish crossover', status: 'bullish', signal: 'buy' },
    { name: 'Bollinger Bands', value: 'Mid-band', status: 'neutral', signal: 'hold' },
    { name: 'Stochastic (14,3)', value: 62, status: 'neutral', signal: 'hold' },
    { name: 'ADX (14)', value: 28, status: 'strong_trend', signal: 'buy' },
    { name: 'Volume Profile', value: 'Above 20D avg', status: 'confirming', signal: 'buy' },
  ],
  patterns: ['Ascending triangle forming', 'Higher lows pattern since Feb', 'Volume expansion on up days'],
  summary: 'NVDA shows constructive technical setup with bullish MACD crossover and above-average volume. ADX confirms trend strength. Best entry near 50-DMA (~$135) with stop below $120. Pattern suggests potential breakout above $155 resistance.',
};

const ratingLabels: Record<string, { label: string; color: string }> = {
  strong_buy: { label: 'Strong Buy', color: 'bg-emerald-500 text-white' },
  buy: { label: 'Buy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  neutral: { label: 'Neutral', color: 'bg-muted text-foreground' },
  sell: { label: 'Sell', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  strong_sell: { label: 'Strong Sell', color: 'bg-red-500 text-white' },
};

const signalColors: Record<string, string> = {
  buy: 'text-emerald-600 dark:text-emerald-400',
  sell: 'text-red-600 dark:text-red-400',
  hold: 'text-muted-foreground',
};

const EntryExitAnalysis: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [timing, setTiming] = useState<TimingData | null>(null);
  const { price: livePrice, loading: priceLoading, error: priceError, errorDetail, lastUpdated, origin, refreshNow } = useStockPrice(timing?.symbol || '', 30000);
  const liveUnavailable = !!timing && !priceLoading && (!livePrice || !!priceError);
  const displayPrice = livePrice?.price ?? timing?.currentPrice ?? 0;
  const errorLabel = errorDetail
    ? `${errorDetail.kind === 'timeout' ? 'Timeout' : errorDetail.kind === 'not_found' ? 'Not found (404)' : errorDetail.kind === 'empty' ? 'Empty response' : errorDetail.kind === 'network' ? 'Network error' : 'Error'}: ${errorDetail.message}`
    : priceError || 'No data returned';
  const updatedLabel = (livePrice?.lastUpdated || lastUpdated)
    ? new Date((livePrice?.lastUpdated || lastUpdated) as Date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;


  const analyze = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) { toast.error('Enter a stock symbol'); return; }

    if (isDemoMode) {
      setTiming({ ...DEMO_TIMING, symbol: sym });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { action: 'entry_exit_analysis', payload: { symbol: sym } },
      });
      if (error) throw error;
      if (data?.result?.symbol) {
        setTiming(data.result);
        toast.success(`Timing analysis complete for ${sym}`);
      } else throw new Error('Invalid response');
    } catch (err: any) {
      console.error('Timing error:', err);
      toast.error('Analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [symbol, isDemoMode]);

  const rating = timing ? (ratingLabels[timing.technicalRating] || ratingLabels.neutral) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Crosshair className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Entry & Exit Timing</h2>
          <p className="text-sm text-muted-foreground">AI-powered technical analysis for optimal trade timing</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Enter symbol (e.g. NVDA, AAPL)..." value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && analyze()} className="pl-9" />
            </div>
            <Button onClick={analyze} disabled={loading} className="gap-2 min-w-[140px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
          <PriceCacheControls className="mt-3 flex-wrap" />
        </CardContent>
      </Card>

      {!timing ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Crosshair className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Perfect Your Timing</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Get AI-analyzed entry zones, exit targets, stop-loss levels, and technical indicator signals to time your trades with precision.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {liveUnavailable && (
            <Card className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <p className="text-xs text-amber-700 dark:text-amber-400" data-testid="price-error">
                  Live price unavailable for {timing.symbol} — {errorLabel}. Showing the last analyzed snapshot.
                </p>
                <Button size="sm" variant="outline" onClick={refreshNow} className="h-7 text-xs">Retry</Button>
              </CardContent>
            </Card>
          )}
          {/* Summary Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                {priceLoading && !livePrice ? (
                  <Skeleton className="h-8 w-24 mx-auto" data-testid="price-skeleton" />
                ) : (
                  <p className="text-2xl font-bold text-foreground" data-testid="current-price">${displayPrice.toFixed(2)}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current Price {livePrice?.source && livePrice.source !== 'demo' ? '(live)' : liveUnavailable ? '(snapshot)' : ''}
                </p>
                {origin && (
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] font-normal ${origin === 'cache' ? 'border-amber-400/60 text-amber-600 dark:text-amber-400' : 'border-emerald-400/60 text-emerald-600 dark:text-emerald-400'}`}
                    data-testid="price-origin-badge"
                  >
                    {origin === 'cache' ? 'Cached' : 'Fresh fetch'}{updatedLabel ? ` · ${updatedLabel}` : ''}
                  </Badge>
                )}
                {updatedLabel && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5" data-testid="price-last-updated">
                    Last updated {updatedLabel}
                  </p>
                )}
                <PriceSparkline symbol={timing.symbol} version={lastUpdated?.getTime() ?? null} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={refreshNow}
                  disabled={priceLoading}
                  className="h-6 mt-1 text-[11px] gap-1"
                  data-testid="refresh-price"
                >
                  <RefreshCw className={`w-3 h-3 ${priceLoading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
                {liveUnavailable && (
                  <>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{errorLabel}</p>
                    <Button size="sm" variant="ghost" onClick={refreshNow} className="h-6 mt-1 text-[11px] gap-1">
                      <RefreshCw className="w-3 h-3" /> Retry
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>


            <Card>
              <CardContent className="p-4 text-center">
                <Badge className={`${rating?.color} text-sm px-3 py-1`}>{rating?.label}</Badge>
                <p className="text-xs text-muted-foreground mt-1">Technical Rating</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${timing.overallScore >= 70 ? 'text-emerald-500' : timing.overallScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{timing.overallScore}</p>
                <p className="text-xs text-muted-foreground">Score /100</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">${timing.stopLoss.price}</p>
                <p className="text-xs text-muted-foreground">Stop Loss</p>
              </CardContent>
            </Card>
          </div>

          {/* Entry/Exit Zones */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><ArrowUpRight className="w-4 h-4" /> Entry Zones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timing.entryZones.map((z, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-800/30">
                    <div>
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${z.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{z.reason}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{z.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-primary"><Target className="w-4 h-4" /> Exit Targets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timing.exitTargets.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div>
                      <p className="text-sm font-bold text-primary">${t.price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t.reason}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{t.type}</Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-200/50 dark:border-red-800/30">
                  <div>
                    <p className="text-sm font-bold text-red-500">${timing.stopLoss.price.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{timing.stopLoss.reason}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-red-500 border-red-300">Stop Loss</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Technical Indicators */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Technical Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {timing.indicators.map(ind => (
                  <div key={ind.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{ind.name}</p>
                      <p className="text-xs text-muted-foreground">{String(ind.value)}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase ${signalColors[ind.signal]}`}>{ind.signal}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Patterns & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Chart Patterns Detected</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {timing.patterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/20">
              <CardHeader className="pb-2"><CardTitle className="text-base">AI Summary</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{timing.summary}</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default EntryExitAnalysis;
