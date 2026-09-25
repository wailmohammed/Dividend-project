import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, BarChart, Bar, ReferenceLine, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Brain, TrendingUp, Search, Loader2, Target, BarChart3, Calendar, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';

interface Projection {
  symbol: string;
  name: string;
  currentPrice: number;
  projections: { period: string; low: number; mid: number; high: number }[];
  seasonality: { month: string; avgReturn: number; winRate: number }[];
  signals: { name: string; value: string; signal: 'bullish' | 'bearish' | 'neutral' }[];
  summary: string;
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  targetPrice: number;
  confidence: number;
}

const DEMO_PROJECTION: Projection = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  currentPrice: 178.50,
  projections: [
    { period: '1M', low: 170, mid: 182, high: 195 },
    { period: '3M', low: 165, mid: 190, high: 210 },
    { period: '6M', low: 160, mid: 200, high: 230 },
    { period: '1Y', low: 155, mid: 215, high: 260 },
  ],
  seasonality: [
    { month: 'Jan', avgReturn: 2.1, winRate: 65 },
    { month: 'Feb', avgReturn: -0.5, winRate: 45 },
    { month: 'Mar', avgReturn: 1.8, winRate: 60 },
    { month: 'Apr', avgReturn: 3.2, winRate: 70 },
    { month: 'May', avgReturn: 0.8, winRate: 55 },
    { month: 'Jun', avgReturn: -1.2, winRate: 40 },
    { month: 'Jul', avgReturn: 4.1, winRate: 75 },
    { month: 'Aug', avgReturn: -0.3, winRate: 48 },
    { month: 'Sep', avgReturn: -2.1, winRate: 35 },
    { month: 'Oct', avgReturn: 3.5, winRate: 68 },
    { month: 'Nov', avgReturn: 2.8, winRate: 65 },
    { month: 'Dec', avgReturn: 1.5, winRate: 60 },
  ],
  signals: [
    { name: 'RSI (14)', value: '58.2', signal: 'neutral' },
    { name: 'MACD', value: 'Bullish crossover', signal: 'bullish' },
    { name: '50 DMA', value: 'Above', signal: 'bullish' },
    { name: '200 DMA', value: 'Above', signal: 'bullish' },
    { name: 'Volume Trend', value: 'Increasing', signal: 'bullish' },
    { name: 'Earnings Momentum', value: '+12.3% surprise', signal: 'bullish' },
  ],
  summary: 'AAPL shows strong bullish momentum with price above key moving averages and positive MACD crossover. Seasonal patterns favor upside in Q2. AI integration in devices expected to drive next upgrade cycle.',
  overallSignal: 'bullish',
  targetPrice: 215,
  confidence: 72,
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toSignal = (value: unknown): 'bullish' | 'bearish' | 'neutral' => {
  if (value === 'bullish' || value === 'bearish' || value === 'neutral') return value;
  return 'neutral';
};

const normalizeProjection = (raw: any, symbol: string): Projection => {
  const base = DEMO_PROJECTION;

  const projections = Array.isArray(raw?.projections)
    ? raw.projections.slice(0, 4).map((p: any, i: number) => ({
        period: typeof p?.period === 'string' ? p.period : (base.projections[i]?.period ?? `${i + 1}M`),
        low: toNumber(p?.low, base.projections[i]?.low ?? 0),
        mid: toNumber(p?.mid, base.projections[i]?.mid ?? 0),
        high: toNumber(p?.high, base.projections[i]?.high ?? 0),
      }))
    : base.projections;

  const seasonality = Array.isArray(raw?.seasonality)
    ? raw.seasonality.slice(0, 12).map((m: any, i: number) => ({
        month: typeof m?.month === 'string' ? m.month : (base.seasonality[i]?.month ?? `M${i + 1}`),
        avgReturn: toNumber(m?.avgReturn, base.seasonality[i]?.avgReturn ?? 0),
        winRate: Math.max(0, Math.min(100, Math.round(toNumber(m?.winRate, base.seasonality[i]?.winRate ?? 50)))),
      }))
    : base.seasonality;

  const signals = Array.isArray(raw?.signals)
    ? raw.signals.slice(0, 12).map((s: any) => ({
        name: typeof s?.name === 'string' ? s.name : 'Signal',
        value: typeof s?.value === 'string' ? s.value : String(s?.value ?? 'N/A'),
        signal: toSignal(s?.signal),
      }))
    : base.signals;

  return {
    symbol: typeof raw?.symbol === 'string' ? raw.symbol.toUpperCase() : symbol,
    name: typeof raw?.name === 'string' ? raw.name : `${symbol} Corp`,
    currentPrice: toNumber(raw?.currentPrice, base.currentPrice),
    projections: projections.length ? projections : base.projections,
    seasonality: seasonality.length ? seasonality : base.seasonality,
    signals: signals.length ? signals : base.signals,
    summary: typeof raw?.summary === 'string' ? raw.summary : base.summary,
    overallSignal: toSignal(raw?.overallSignal),
    targetPrice: toNumber(raw?.targetPrice, base.targetPrice),
    confidence: Math.max(0, Math.min(100, Math.round(toNumber(raw?.confidence, base.confidence)))),
  };
};

const SignalBadge = ({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) => {
  if (signal === 'bullish') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700 text-[10px] border">Bullish</Badge>;
  if (signal === 'bearish') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700 text-[10px] border">Bearish</Badge>;
  return <Badge variant="outline" className="text-[10px]">Neutral</Badge>;
};

const AIStockProjection: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [projection, setProjection] = useState<Projection | null>(null);

  const analyzeStock = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) { toast.error('Enter a stock symbol'); return; }

    if (isDemoMode) {
      setProjection({ ...DEMO_PROJECTION, symbol: sym });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: {
          type: 'stock_projection',
          symbol: sym,
          prompt: `Analyze ${sym} and provide a JSON response with:
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
  "seasonality": [
    {"month": "Jan", "avgReturn": 0, "winRate": 0},
    ... for all 12 months based on historical data
  ],
  "signals": [
    {"name": "RSI (14)", "value": "58.2", "signal": "bullish|bearish|neutral"},
    ... include RSI, MACD, 50 DMA, 200 DMA, Volume Trend, Earnings Momentum
  ],
  "summary": "Brief analysis paragraph",
  "overallSignal": "bullish|bearish|neutral",
  "targetPrice": 0,
  "confidence": 0-100
}
Return ONLY valid JSON.`,
        },
      });

      if (error) throw error;

      let result = data;
      // Edge function returns { result: parsed } for JSON responses
      if (data?.result && typeof data.result === 'object') {
        result = data.result;
      } else if (typeof data === 'string') {
        const match = data.match(/\{[\s\S]*\}/);
        if (match) result = JSON.parse(match[0]);
      } else if (data?.insight) {
        const match = data.insight.match(/\{[\s\S]*\}/);
        if (match) result = JSON.parse(match[0]);
      } else if (data?.result && typeof data.result === 'string') {
        const match = data.result.match(/\{[\s\S]*\}/);
        if (match) result = JSON.parse(match[0]);
      }

      setProjection(normalizeProjection(result, sym));
      toast.success(`Analysis complete for ${sym}`);
    } catch (err: any) {
      console.error('Projection error:', err);
      toast.error('Failed to analyze stock: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [symbol, isDemoMode]);

  const upside = projection && projection.currentPrice > 0 ? ((projection.targetPrice - projection.currentPrice) / projection.currentPrice * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Brain className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Stock Projection</h2>
          <p className="text-sm text-muted-foreground">AI-powered price projections, seasonality & technical signals</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter stock symbol (e.g. AAPL, MSFT, NVDA)..."
                value={symbol}
                onChange={e => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && analyzeStock()}
                className="pl-9"
              />
            </div>
            <Button onClick={analyzeStock} disabled={loading} className="gap-2 min-w-[140px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Analyzing...' : 'Analyze'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!projection ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Brain className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Enter a Stock Symbol</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Get AI-powered price projections with confidence ranges, historical seasonality patterns, and technical signal analysis — inspired by professional-grade tools.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">${projection.currentPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Current Price</p>
              </CardContent>
            </Card>
            <Card className={projection.overallSignal === 'bullish' ? 'border-emerald-200 dark:border-emerald-800/50' : projection.overallSignal === 'bearish' ? 'border-red-200 dark:border-red-800/50' : ''}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">${projection.targetPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">AI Target Price</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  {upside >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-500" /> : <ArrowDownRight className="w-5 h-5 text-red-500" />}
                  <p className={`text-2xl font-bold ${upside >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</p>
                </div>
                <p className="text-xs text-muted-foreground">Potential</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{projection.confidence}%</p>
                <p className="text-xs text-muted-foreground">Confidence</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="projection">
            <TabsList>
              <TabsTrigger value="projection">Price Projection</TabsTrigger>
              <TabsTrigger value="seasonality">Seasonality</TabsTrigger>
              <TabsTrigger value="signals">Signals</TabsTrigger>
            </TabsList>

            <TabsContent value="projection">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Price Range Projection
                  </CardTitle>
                  <CardDescription>Low / Mid / High price targets by timeframe</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={projection.projections}>
                        <defs>
                          <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--popover-foreground))' }}
                          formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name === 'high' ? 'Bull Case' : name === 'low' ? 'Bear Case' : 'Base Case']}
                        />
                        <Area type="monotone" dataKey="high" stroke="hsl(var(--primary))" fill="url(#projGrad)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                        <Line type="monotone" dataKey="mid" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                        <Area type="monotone" dataKey="low" stroke="hsl(var(--muted-foreground))" fill="none" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                        <ReferenceLine y={projection.currentPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: 'Current', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Range table */}
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {projection.projections.map(p => (
                      <div key={p.period} className="text-center p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{p.period}</p>
                        <p className="text-xs text-red-500">${p.low}</p>
                        <p className="text-sm font-bold text-foreground">${p.mid}</p>
                        <p className="text-xs text-emerald-500">${p.high}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seasonality">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Historical Seasonality
                  </CardTitle>
                  <CardDescription>Average monthly returns and win rates based on historical data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projection.seasonality}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `${v}%`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--popover-foreground))' }}
                          formatter={(v: number, name: string) => [name === 'avgReturn' ? `${v.toFixed(1)}%` : `${v}%`, name === 'avgReturn' ? 'Avg Return' : 'Win Rate']}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                        <Bar dataKey="avgReturn" name="Avg Return" radius={[4, 4, 0, 0]}>
                          {projection.seasonality.map((entry, i) => (
                            <Cell key={`${entry.month}-${i}`} fill={entry.avgReturn >= 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Win rate row */}
                  <div className="mt-4 grid grid-cols-6 lg:grid-cols-12 gap-1">
                    {projection.seasonality.map(m => (
                      <div key={m.month} className="text-center p-2 rounded bg-muted/30">
                        <p className="text-[10px] font-medium text-muted-foreground">{m.month}</p>
                        <p className={`text-xs font-bold ${m.winRate >= 55 ? 'text-emerald-500' : m.winRate <= 45 ? 'text-red-500' : 'text-foreground'}`}>
                          {m.winRate}%
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signals">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Technical Signals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {projection.signals.map(s => (
                        <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.value}</p>
                          </div>
                          <SignalBadge signal={s.signal} />
                        </div>
                      ))}
                    </div>

                    {/* Overall signal */}
                    <div className={`mt-4 p-4 rounded-xl border ${
                      projection.overallSignal === 'bullish' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' :
                      projection.overallSignal === 'bearish' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' :
                      'border-border bg-muted/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        <TrendingUp className={`w-5 h-5 ${
                          projection.overallSignal === 'bullish' ? 'text-emerald-500' :
                          projection.overallSignal === 'bearish' ? 'text-red-500' :
                          'text-muted-foreground'
                        }`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground capitalize">Overall: {projection.overallSignal}</p>
                          <p className="text-xs text-muted-foreground">
                            {projection.signals.filter(s => s.signal === 'bullish').length} bullish / {projection.signals.filter(s => s.signal === 'bearish').length} bearish
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="w-5 h-5 text-primary" />
                      AI Analysis Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{projection.summary}</p>

                    <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Disclaimer:</strong> AI projections are based on historical patterns and current data. They do not constitute financial advice. Past performance does not guarantee future results.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default AIStockProjection;
