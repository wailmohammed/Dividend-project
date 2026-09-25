import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, TrendingDown, BarChart2, Globe, Activity, Thermometer,
  ArrowUp, ArrowDown, Minus, Newspaper, Clock, ChevronRight, RefreshCw, Loader2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Index ETF symbols we can fetch live prices for
const INDEX_MAP = [
  { symbol: 'SPY', name: 'S&P 500', fallbackValue: 6051.97 },
  { symbol: 'QQQ', name: 'NASDAQ 100', fallbackValue: 21774.01 },
  { symbol: 'DIA', name: 'Dow Jones', fallbackValue: 44546.08 },
  { symbol: 'IWM', name: 'Russell 2000', fallbackValue: 2279.71 },
];

// Sector performance data
const SECTORS = [
  { name: 'Technology', change: -1.2, marketCap: '17.8T', pe: 33.5, ytd: 2.1, color: 'hsl(199, 89%, 48%)' },
  { name: 'Healthcare', change: 0.8, marketCap: '7.2T', pe: 22.1, ytd: 4.5, color: 'hsl(142, 76%, 36%)' },
  { name: 'Financials', change: -2.1, marketCap: '9.1T', pe: 15.2, ytd: -1.3, color: 'hsl(38, 92%, 50%)' },
  { name: 'Consumer Disc.', change: -0.5, marketCap: '6.8T', pe: 28.4, ytd: 0.8, color: 'hsl(262, 83%, 58%)' },
  { name: 'Communication', change: 1.2, marketCap: '5.1T', pe: 19.8, ytd: 5.2, color: 'hsl(328, 85%, 57%)' },
  { name: 'Industrials', change: -0.9, marketCap: '5.5T', pe: 21.3, ytd: -0.4, color: 'hsl(var(--primary))' },
  { name: 'Consumer Staples', change: 0.3, marketCap: '3.9T', pe: 23.1, ytd: 1.9, color: 'hsl(173, 80%, 40%)' },
  { name: 'Energy', change: -1.8, marketCap: '3.2T', pe: 12.4, ytd: -3.2, color: 'hsl(0, 84%, 60%)' },
  { name: 'Utilities', change: 1.5, marketCap: '1.6T', pe: 18.7, ytd: 6.7, color: 'hsl(45, 93%, 47%)' },
  { name: 'Real Estate', change: -0.3, marketCap: '1.3T', pe: 35.2, ytd: -1.1, color: 'hsl(280, 67%, 44%)' },
  { name: 'Materials', change: -0.7, marketCap: '1.1T', pe: 17.9, ytd: -2.1, color: 'hsl(24, 80%, 50%)' },
];

// Market breadth indicators
const BREADTH_DATA = {
  advancers: 287,
  decliners: 198,
  unchanged: 15,
  newHighs: 42,
  newLows: 18,
  aboveSMA200: 62,
  belowSMA200: 38,
  upVolume: 55,
  downVolume: 45,
};

// Simulated P/E trend
const PE_TREND = [
  { date: 'Jan', pe: 28.2 },
  { date: 'Feb', pe: 29.1 },
  { date: 'Mar', pe: 27.8 },
  { date: 'Apr', pe: 28.5 },
  { date: 'May', pe: 29.8 },
  { date: 'Jun', pe: 30.2 },
  { date: 'Jul', pe: 31.1 },
  { date: 'Aug', pe: 30.5 },
  { date: 'Sep', pe: 29.3 },
  { date: 'Oct', pe: 30.8 },
  { date: 'Nov', pe: 31.5 },
  { date: 'Dec', pe: 31.3 },
];

interface LiveIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePct: number;
  isLive: boolean;
}

const GlobalMarketOverview: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7D' | '1M' | '3M' | 'YTD' | '1Y'>('7D');
  const [indices, setIndices] = useState<LiveIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchLiveIndices = useCallback(async () => {
    setLoading(true);
    try {
      const symbols = INDEX_MAP.map(i => i.symbol);
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: { symbols, type: 'stock' },
      });

      if (error) throw error;

      const liveIndices: LiveIndex[] = INDEX_MAP.map(idx => {
        const live = data?.prices?.[idx.symbol];
        if (live) {
          return {
            symbol: idx.symbol,
            name: idx.name,
            value: live.price ?? idx.fallbackValue,
            change: live.change ?? 0,
            changePct: live.changePercent ?? 0,
            isLive: true,
          };
        }
        return {
          symbol: idx.symbol,
          name: idx.name,
          value: idx.fallbackValue,
          change: 0,
          changePct: 0,
          isLive: false,
        };
      });

      setIndices(liveIndices);
      setLastFetched(new Date());
    } catch (err) {
      console.error('Failed to fetch live indices:', err);
      // Fall back to static data
      setIndices(INDEX_MAP.map(idx => ({
        symbol: idx.symbol,
        name: idx.name,
        value: idx.fallbackValue,
        change: 0,
        changePct: 0,
        isLive: false,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveIndices();
  }, [fetchLiveIndices]);

  const totalBreadth = BREADTH_DATA.advancers + BREADTH_DATA.decliners + BREADTH_DATA.unchanged;
  const advancerPct = (BREADTH_DATA.advancers / totalBreadth * 100).toFixed(0);
  const declinerPct = (BREADTH_DATA.decliners / totalBreadth * 100).toFixed(0);

  const sortedSectors = [...SECTORS].sort((a, b) => b.change - a.change);

  const marketInsights = [
    {
      title: 'Market Valuation',
      body: `The U.S. market is trading at a P/E of 31.3x, above the 3Y average of 29.6x. Forward earnings are forecast to grow by 16% annually.`,
      type: 'neutral' as const,
    },
    {
      title: 'Sector Rotation',
      body: 'Utilities and Healthcare are outperforming this week, while Financials and Energy lag. A defensive rotation pattern is emerging.',
      type: 'neutral' as const,
    },
    {
      title: 'Breadth Analysis',
      body: `${BREADTH_DATA.advancers} stocks advanced vs ${BREADTH_DATA.decliners} declining. ${BREADTH_DATA.aboveSMA200}% of stocks are above their 200-day moving average.`,
      type: BREADTH_DATA.advancers > BREADTH_DATA.decliners ? 'positive' as const : 'negative' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">U.S. Market Overview</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            {lastFetched ? `Updated ${format(lastFetched, 'MMM d, yyyy h:mm a')}` : `Updated ${format(new Date(), 'MMM d, yyyy')}`}
            {' · '}Aggregated Company Financials · 7,880 Companies
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLiveIndices} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh Prices
        </Button>
      </div>

      {/* Major Indices - Live */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {indices.map(idx => (
          <Card key={idx.symbol} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-muted-foreground font-medium">{idx.name}</div>
                {idx.isLive && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-green-600 dark:text-green-400 border-green-500/30">LIVE</Badge>
                )}
              </div>
              <div className="text-lg font-bold tabular-nums">
                ${idx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium mt-0.5 ${idx.changePct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {idx.changePct >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(idx.changePct).toFixed(2)}%
                <span className="text-muted-foreground ml-1">({idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)})</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Market Insights Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {marketInsights.map((insight, i) => (
          <Card key={i} className={`border-l-4 ${
            insight.type === 'positive' ? 'border-l-green-500' :
            insight.type === 'negative' ? 'border-l-red-500' : 'border-l-blue-500'
          }`}>
            <CardContent className="pt-4 pb-3">
              <div className="text-sm font-semibold mb-1">{insight.title}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="heatmap" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="heatmap" className="gap-1.5"><Thermometer className="w-3.5 h-3.5" />Sector Heat Map</TabsTrigger>
          <TabsTrigger value="breadth" className="gap-1.5"><Activity className="w-3.5 h-3.5" />Market Breadth</TabsTrigger>
          <TabsTrigger value="valuation" className="gap-1.5"><BarChart2 className="w-3.5 h-3.5" />Valuation</TabsTrigger>
        </TabsList>

        {/* Sector Heat Map */}
        <TabsContent value="heatmap">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sector Performance Heat Map</CardTitle>
                <CardDescription>Today's sector performance across the U.S. market</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {sortedSectors.map(sector => {
                    const intensity = Math.min(Math.abs(sector.change) / 3, 1);
                    const bgColor = sector.change >= 0
                      ? `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`
                      : `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`;
                    const textColor = sector.change >= 0
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300';

                    return (
                      <div
                        key={sector.name}
                        className="rounded-lg p-3 border transition-all hover:scale-[1.02] cursor-pointer"
                        style={{ backgroundColor: bgColor }}
                      >
                        <div className="text-xs font-medium text-foreground truncate">{sector.name}</div>
                        <div className={`text-lg font-bold ${textColor} tabular-nums`}>
                          {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(1)}%
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">P/E {sector.pe}x</span>
                          <span className="text-[10px] text-muted-foreground">{sector.marketCap}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sector Returns Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedSectors} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                      <Tooltip formatter={(val: number) => `${val.toFixed(1)}%`} />
                      <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                        {sortedSectors.map((sector, i) => (
                          <Cell key={i} fill={sector.change >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Trending Industries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {['Oil and Gas', 'Gold', 'Biotech', 'Software', 'Renewable Energy', 'Semiconductors', 'AI / Machine Learning', 'Electric Vehicles'].map(industry => (
                    <Badge key={industry} variant="secondary" className="cursor-pointer hover:bg-primary/10 transition-colors">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Market Breadth */}
        <TabsContent value="breadth">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Advance / Decline</CardTitle>
                <CardDescription>S&P 500 constituents today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 rounded-full bg-green-500 transition-all" style={{ width: `${advancerPct}%` }} />
                    <div className="h-4 rounded-full bg-red-500 transition-all" style={{ width: `${declinerPct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{BREADTH_DATA.advancers}</div>
                      <div className="text-xs text-muted-foreground">Advancing</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{BREADTH_DATA.decliners}</div>
                      <div className="text-xs text-muted-foreground">Declining</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">{BREADTH_DATA.unchanged}</div>
                      <div className="text-xs text-muted-foreground">Unchanged</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">52-Week Highs & Lows</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20">
                    <ArrowUp className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{BREADTH_DATA.newHighs}</div>
                    <div className="text-xs text-muted-foreground mt-1">New Highs</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
                    <ArrowDown className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-1" />
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{BREADTH_DATA.newLows}</div>
                    <div className="text-xs text-muted-foreground mt-1">New Lows</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stocks Above 200-Day MA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-[120px] h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Above', value: BREADTH_DATA.aboveSMA200 },
                            { name: 'Below', value: BREADTH_DATA.belowSMA200 },
                          ]}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={50}
                          startAngle={90}
                          endAngle={-270}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          <Cell fill="hsl(142, 76%, 36%)" />
                          <Cell fill="hsl(0, 84%, 60%)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">Above: <strong>{BREADTH_DATA.aboveSMA200}%</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">Below: <strong>{BREADTH_DATA.belowSMA200}%</strong></span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {BREADTH_DATA.aboveSMA200 > 50
                        ? 'Majority of stocks show bullish long-term trends.'
                        : 'Market breadth is weak — fewer stocks in uptrends.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Volume Breadth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Up Volume</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{BREADTH_DATA.upVolume}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${BREADTH_DATA.upVolume}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Down Volume</span>
                      <span className="font-bold text-red-600 dark:text-red-400">{BREADTH_DATA.downVolume}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${BREADTH_DATA.downVolume}%` }} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {BREADTH_DATA.upVolume > BREADTH_DATA.downVolume
                      ? 'Buying pressure dominates today\'s trading volume.'
                      : 'Selling pressure is elevated in today\'s session.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Valuation Tab */}
        <TabsContent value="valuation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Market P/E Ratio Trend</CardTitle>
                <CardDescription>U.S. Market Price to Earnings over the past year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={PE_TREND}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[25, 35]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip formatter={(val: number) => `${val.toFixed(1)}x`} />
                      <Area type="monotone" dataKey="pe" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>Current P/E: <strong className="text-foreground">31.3x</strong></span>
                  <span>3Y Average: <strong className="text-foreground">29.6x</strong></span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sector Valuations</CardTitle>
                <CardDescription>P/E ratio by sector</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={SECTORS.sort((a, b) => b.pe - a.pe)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                      <Tooltip formatter={(val: number) => `${val.toFixed(1)}x`} />
                      <Bar dataKey="pe" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Newspaper className="w-4 h-4" />
                  Market Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Over the last 7 days, the market has dropped 1.4%, driven by a decline of 4.3% in the Financials sector.
                  Meanwhile, the Utilities sector has outperformed, gaining 6.7% in that time. As for the longer term,
                  the market has actually risen by 11% in the last year. Looking forward, earnings are forecast to grow by 16% annually.
                  The current aggregate P/E ratio of 31.3x sits above the 3-year average of 29.6x, suggesting slightly elevated valuations
                  relative to recent history.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GlobalMarketOverview;
