import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { TrendingUp, FlaskConical, BarChart3, DollarSign, Users, Plus, X, ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface ForecastStock {
  symbol: string;
  name: string;
  sector: string;
  currentEPS: number;
  currentRevenue: number;
  analystCount: number;
  consensusRating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell';
  priceTarget: { low: number; median: number; high: number; current: number };
  earningsForecast: { year: string; eps: number; growth: number }[];
  revenueForecast: { year: string; revenue: number; growth: number }[];
}

const defaultForecasts: ForecastStock[] = [
  {
    symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology',
    currentEPS: 12.96, currentRevenue: 60.9, analystCount: 42, consensusRating: 'Strong Buy',
    priceTarget: { low: 650, median: 950, high: 1200, current: 875 },
    earningsForecast: [
      { year: '2023', eps: 5.16, growth: 0 }, { year: '2024', eps: 12.96, growth: 151 },
      { year: '2025E', eps: 18.40, growth: 42 }, { year: '2026E', eps: 22.10, growth: 20 }, { year: '2027E', eps: 25.80, growth: 17 },
    ],
    revenueForecast: [
      { year: '2023', revenue: 27.0, growth: 0 }, { year: '2024', revenue: 60.9, growth: 126 },
      { year: '2025E', revenue: 89.5, growth: 47 }, { year: '2026E', revenue: 110.2, growth: 23 }, { year: '2027E', revenue: 128.0, growth: 16 },
    ],
  },
  {
    symbol: 'AAPL', name: 'Apple', sector: 'Technology',
    currentEPS: 6.42, currentRevenue: 383.3, analystCount: 38, consensusRating: 'Buy',
    priceTarget: { low: 165, median: 210, high: 250, current: 192 },
    earningsForecast: [
      { year: '2023', eps: 6.13, growth: 0 }, { year: '2024', eps: 6.42, growth: 5 },
      { year: '2025E', eps: 7.15, growth: 11 }, { year: '2026E', eps: 7.82, growth: 9 }, { year: '2027E', eps: 8.40, growth: 7 },
    ],
    revenueForecast: [
      { year: '2023', revenue: 383.3, growth: 0 }, { year: '2024', revenue: 395.8, growth: 3 },
      { year: '2025E', revenue: 420.5, growth: 6 }, { year: '2026E', revenue: 448.2, growth: 7 }, { year: '2027E', revenue: 472.0, growth: 5 },
    ],
  },
  {
    symbol: 'MSFT', name: 'Microsoft', sector: 'Technology',
    currentEPS: 11.80, currentRevenue: 227.6, analystCount: 45, consensusRating: 'Strong Buy',
    priceTarget: { low: 370, median: 460, high: 530, current: 425 },
    earningsForecast: [
      { year: '2023', eps: 9.68, growth: 0 }, { year: '2024', eps: 11.80, growth: 22 },
      { year: '2025E', eps: 14.20, growth: 20 }, { year: '2026E', eps: 16.50, growth: 16 }, { year: '2027E', eps: 18.90, growth: 15 },
    ],
    revenueForecast: [
      { year: '2023', revenue: 211.9, growth: 0 }, { year: '2024', revenue: 227.6, growth: 7 },
      { year: '2025E', revenue: 262.0, growth: 15 }, { year: '2026E', revenue: 298.5, growth: 14 }, { year: '2027E', revenue: 335.0, growth: 12 },
    ],
  },
];

const ratingColor: Record<string, string> = {
  'Strong Buy': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Buy': 'bg-green-500/10 text-green-600 border-green-500/20',
  'Hold': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Sell': 'bg-red-500/10 text-red-600 border-red-500/20',
};

function generateForecast(symbol: string, name: string): ForecastStock {
  const price = Math.round(Math.random() * 400 + 50);
  const eps = +(Math.random() * 10 + 1).toFixed(2);
  const rev = +(Math.random() * 200 + 10).toFixed(1);
  const ratings: ForecastStock['consensusRating'][] = ['Strong Buy', 'Buy', 'Hold', 'Sell'];
  return {
    symbol, name, sector: 'Custom', currentEPS: eps, currentRevenue: rev,
    analystCount: Math.floor(Math.random() * 30 + 10),
    consensusRating: ratings[Math.floor(Math.random() * 3)],
    priceTarget: { low: Math.round(price * 0.7), median: Math.round(price * 1.1), high: Math.round(price * 1.4), current: price },
    earningsForecast: [
      { year: '2023', eps: +(eps * 0.8).toFixed(2), growth: 0 },
      { year: '2024', eps, growth: 25 },
      { year: '2025E', eps: +(eps * 1.15).toFixed(2), growth: 15 },
      { year: '2026E', eps: +(eps * 1.3).toFixed(2), growth: 13 },
      { year: '2027E', eps: +(eps * 1.45).toFixed(2), growth: 12 },
    ],
    revenueForecast: [
      { year: '2023', revenue: +(rev * 0.85).toFixed(1), growth: 0 },
      { year: '2024', revenue: rev, growth: 18 },
      { year: '2025E', revenue: +(rev * 1.15).toFixed(1), growth: 15 },
      { year: '2026E', revenue: +(rev * 1.28).toFixed(1), growth: 11 },
      { year: '2027E', revenue: +(rev * 1.4).toFixed(1), growth: 9 },
    ],
  };
}

const PriceTargetBar: React.FC<{ pt: ForecastStock['priceTarget'] }> = ({ pt }) => {
  const { low, median, high, current } = pt;
  const range = high - low;
  const medianPct = ((median - low) / range) * 100;
  const currentPct = Math.min(Math.max(((current - low) / range) * 100, 0), 100);
  return (
    <div>
      <div className="relative h-12">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-primary/30 rounded-full" />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background" style={{ left: `${medianPct}%` }} title={`Median: $${median}`} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground rounded-full border-2 border-background" style={{ left: `${currentPct}%` }} title={`Current: $${current}`} />
        <div className="absolute -bottom-5 text-[10px] text-muted-foreground" style={{ left: '0%' }}>${low}</div>
        <div className="absolute -bottom-5 text-[10px] text-primary font-bold" style={{ left: `${medianPct}%`, transform: 'translateX(-50%)' }}>${median}</div>
        <div className="absolute -bottom-5 text-[10px] text-muted-foreground" style={{ right: '0%' }}>${high}</div>
      </div>
      <div className="flex justify-between mt-8 text-xs text-muted-foreground">
        <span>● Current Price</span>
        <span className="text-primary">● Median Target</span>
      </div>
    </div>
  );
};

const GrowthForecastVisualizer: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [forecasts, setForecasts] = useState<ForecastStock[]>(isDemoMode ? defaultForecasts : []);
  const [selectedStock, setSelectedStock] = useState<ForecastStock | null>(null);

  const handleAddStock = (symbol: string, name: string) => {
    if (forecasts.find(f => f.symbol === symbol)) {
      setSelectedStock(forecasts.find(f => f.symbol === symbol)!);
      return;
    }
    const newForecast = generateForecast(symbol, name);
    setForecasts(prev => [...prev, newForecast]);
    setSelectedStock(newForecast);
  };

  const handleRemoveStock = (symbol: string) => {
    setForecasts(prev => prev.filter(f => f.symbol !== symbol));
    if (selectedStock?.symbol === symbol) setSelectedStock(null);
  };

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Showing sample analyst forecasts. Sign in for live data.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl"><TrendingUp className="w-6 h-6 text-primary" /></div>
          Growth Forecasts
        </h1>
        <p className="text-muted-foreground">Analyst consensus earnings & revenue projections</p>
      </div>

      {/* Search & Add */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Add Stock Forecast</span>
          </div>
          <div className="max-w-md">
            <StockSearchAutocomplete onSelect={handleAddStock} placeholder="Search & add stock (e.g. AAPL, Tesla)..." />
          </div>
        </CardContent>
      </Card>

      {/* Stock Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forecasts.map(stock => {
          const upside = ((stock.priceTarget.median / stock.priceTarget.current - 1) * 100).toFixed(1);
          return (
            <Card key={stock.symbol} className="hover:border-primary/30 transition-all cursor-pointer group hover:shadow-md" onClick={() => setSelectedStock(stock)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-foreground">{stock.symbol}</span>
                    <Badge className={`${ratingColor[stock.consensusRating]} text-[10px]`}>{stock.consensusRating}</Badge>
                    {!defaultForecasts.find(d => d.symbol === stock.symbol) && (
                      <button onClick={e => { e.stopPropagation(); handleRemoveStock(stock.symbol); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-xs text-muted-foreground mb-2">{stock.name}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[10px] text-muted-foreground">EPS</div>
                    <div className="text-sm font-bold text-foreground">${stock.currentEPS.toFixed(2)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[10px] text-muted-foreground">Target</div>
                    <div className="text-sm font-bold text-foreground">${stock.priceTarget.median}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[10px] text-muted-foreground">Upside</div>
                    <div className={`text-sm font-bold ${Number(upside) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{upside}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" /> {stock.analystCount} analysts
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedStock} onOpenChange={() => setSelectedStock(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedStock && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{selectedStock.symbol}</span>
                  <Badge className={ratingColor[selectedStock.consensusRating]}>{selectedStock.consensusRating}</Badge>
                  <span className="text-muted-foreground text-base font-normal">{selectedStock.name}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Analysts</div>
                  <div className="text-xl font-bold text-foreground">{selectedStock.analystCount}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Price Target</div>
                  <div className="text-xl font-bold text-foreground">${selectedStock.priceTarget.median}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">EPS (TTM)</div>
                  <div className="text-xl font-bold text-foreground">${selectedStock.currentEPS.toFixed(2)}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="text-xl font-bold text-foreground">${selectedStock.currentRevenue}B</div>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Price Target Range</CardTitle></CardHeader>
                <CardContent><PriceTargetBar pt={selectedStock.priceTarget} /></CardContent>
              </Card>

              <Tabs defaultValue="earnings" className="mt-4">
                <TabsList>
                  <TabsTrigger value="earnings" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> EPS</TabsTrigger>
                  <TabsTrigger value="revenue" className="gap-1"><DollarSign className="w-3.5 h-3.5" /> Revenue</TabsTrigger>
                </TabsList>
                <TabsContent value="earnings">
                  <Card>
                    <CardContent className="p-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={selectedStock.earningsForecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(value: number, name: string) => [name === 'eps' ? `$${value.toFixed(2)}` : `${value}%`, name === 'eps' ? 'EPS' : 'Growth']} />
                          <Legend />
                          <Bar dataKey="eps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="EPS" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {selectedStock.earningsForecast.filter(e => e.growth > 0).map(e => (
                          <Badge key={e.year} variant="outline" className="text-xs">{e.year}: <span className="text-emerald-500 ml-1">+{e.growth}%</span></Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="revenue">
                  <Card>
                    <CardContent className="p-4">
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={selectedStock.revenueForecast}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}B`} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(value: number) => [`$${value.toFixed(1)}B`, 'Revenue']} />
                          <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GrowthForecastVisualizer;
