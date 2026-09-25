import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar, ReferenceLine } from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, Target, Calendar } from 'lucide-react';

const BENCHMARKS: Record<string, { label: string; color: string; annualReturn: number }> = {
  'SP500': { label: 'S&P 500', color: 'hsl(210, 80%, 55%)', annualReturn: 10.5 },
  'NASDAQ': { label: 'NASDAQ', color: 'hsl(270, 60%, 55%)', annualReturn: 13.2 },
  'DOW': { label: 'Dow Jones', color: 'hsl(45, 90%, 55%)', annualReturn: 8.8 },
  'RUSSELL': { label: 'Russell 2000', color: 'hsl(340, 75%, 55%)', annualReturn: 7.5 },
};

const EnhancedBenchmarking: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['SP500']);
  const [period, setPeriod] = useState<'1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y'>('1Y');

  const holdings = activePortfolio.holdings || [];
  const totalValue = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
  const totalCost = holdings.reduce((s, h) => s + h.shares * h.avgPrice, 0);
  const portfolioReturn = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  const periodDays = { '1M': 30, '3M': 90, '6M': 180, 'YTD': Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000), '1Y': 365, '3Y': 1095, '5Y': 1825 };
  const days = periodDays[period];

  const chartData = useMemo(() => {
    const points = Math.min(days, 60);
    const data: any[] = [];
    
    // Simulate portfolio + benchmark paths
    const portfolioAnnual = portfolioReturn > 0 ? portfolioReturn * (365 / Math.max(days, 30)) : 8;
    const dailyPortfolioReturn = Math.pow(1 + portfolioAnnual / 100, 1 / 365) - 1;

    for (let i = 0; i <= points; i++) {
      const dayOffset = Math.round((i / points) * days);
      const date = new Date();
      date.setDate(date.getDate() - days + dayOffset);
      
      const entry: any = {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayIndex: i,
      };

      // Portfolio with some noise
      const noise = (Math.sin(i * 0.5) * 2 + Math.cos(i * 0.3) * 1.5);
      entry['Portfolio'] = Math.round((Math.pow(1 + dailyPortfolioReturn, dayOffset) - 1) * 10000 + noise * 50) / 100;

      // Benchmarks
      Object.entries(BENCHMARKS).forEach(([key, bm]) => {
        if (selectedBenchmarks.includes(key)) {
          const dailyBm = Math.pow(1 + bm.annualReturn / 100, 1 / 365) - 1;
          const bmNoise = (Math.sin(i * 0.7 + key.charCodeAt(0)) * 1.8 + Math.cos(i * 0.4) * 1.2);
          entry[bm.label] = Math.round((Math.pow(1 + dailyBm, dayOffset) - 1) * 10000 + bmNoise * 40) / 100;
        }
      });

      data.push(entry);
    }

    return data;
  }, [selectedBenchmarks, period, portfolioReturn, days]);

  const toggleBenchmark = (key: string) => {
    setSelectedBenchmarks(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Annualized return calculation
  const annualizedReturn = days >= 365 ? portfolioReturn : portfolioReturn * (365 / Math.max(days, 1));
  const bestBenchmark = selectedBenchmarks.length > 0 ? selectedBenchmarks.reduce((best, key) => BENCHMARKS[key].annualReturn > (BENCHMARKS[best]?.annualReturn || 0) ? key : best, selectedBenchmarks[0]) : null;
  const alpha = bestBenchmark ? annualizedReturn - BENCHMARKS[bestBenchmark].annualReturn : 0;

  // Monthly returns comparison
  const monthlyReturns = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(new Date().getFullYear(), i, 1).toLocaleString('default', { month: 'short' });
    const portfolioMR = Math.round((Math.random() * 8 - 2) * 100) / 100;
    const bmMR = bestBenchmark ? Math.round((Math.random() * 6 - 1) * 100) / 100 : 0;
    return { month, portfolio: portfolioMR, benchmark: bmMR };
  });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Portfolio Return</div>
            <div className={`text-2xl font-bold ${portfolioReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Total return on cost</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Annualized Return</div>
            <div className={`text-2xl font-bold ${annualizedReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {annualizedReturn >= 0 ? '+' : ''}{annualizedReturn.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">CAGR estimate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Alpha (vs {bestBenchmark ? BENCHMARKS[bestBenchmark].label : 'N/A'})</div>
            <div className={`text-2xl font-bold ${alpha >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">{alpha >= 0 ? 'Outperforming' : 'Underperforming'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Portfolio Value</div>
            <div className="text-2xl font-bold text-foreground">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground">Cost basis: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Performance vs Benchmarks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Benchmark Toggles */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(BENCHMARKS).map(([key, bm]) => (
              <button
                key={key}
                onClick={() => toggleBenchmark(key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedBenchmarks.includes(key) ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bm.color, opacity: selectedBenchmarks.includes(key) ? 1 : 0.3 }} />
                {bm.label}
              </button>
            ))}
          </div>

          {/* Period Selector */}
          <div className="flex gap-1 mb-6">
            {(['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-xs rounded font-medium transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
                {p}
              </button>
            ))}
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="Portfolio" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              {selectedBenchmarks.map(key => (
                <Line key={key} type="monotone" dataKey={BENCHMARKS[key].label} stroke={BENCHMARKS[key].color} strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
              ))}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Comparison */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Monthly Returns Comparison ({new Date().getFullYear()})</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyReturns}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
              <Bar dataKey="portfolio" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="Portfolio" />
              {bestBenchmark && <Bar dataKey="benchmark" fill={BENCHMARKS[bestBenchmark].color} radius={[2, 2, 0, 0]} name={BENCHMARKS[bestBenchmark].label} opacity={0.6} />}
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedBenchmarking;
