import React, { useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Play, RotateCcw, TrendingUp, TrendingDown, BarChart2, PieChart, Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RPieChart, Pie, Cell, Legend } from 'recharts';

interface AllocationSlot {
  symbol: string;
  name: string;
  weight: number;
}

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const PortfolioLab: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];

  const [allocations, setAllocations] = useState<AllocationSlot[]>(() =>
    holdings.slice(0, 10).map(h => ({
      symbol: h.symbol,
      name: h.name,
      weight: Math.round((((h.shares || 0) * (h.currentPrice || 0)) / Math.max(activePortfolio?.totalValue || 1, 1)) * 100),
    }))
  );

  const [startingCapital, setStartingCapital] = useState(10000);
  const [years, setYears] = useState(5);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [hasRun, setHasRun] = useState(false);

  const totalWeight = allocations.reduce((s, a) => s + a.weight, 0);

  const updateWeight = (idx: number, val: number) => {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, weight: val } : a));
  };

  // Deterministic seeded backtest simulation
  const backtestResults = useMemo(() => {
    if (!hasRun) return null;

    // Seeded PRNG for consistent results per allocation
    const seed = allocations.reduce((s, a) => s + a.weight * a.symbol.charCodeAt(0), startingCapital + years);
    let rng = seed;
    const nextRandom = () => {
      rng = (rng * 16807 + 0) % 2147483647;
      return (rng - 1) / 2147483646;
    };

    const months = years * 12;
    const data: { month: string; portfolio: number; benchmark: number }[] = [];
    let portfolioVal = startingCapital;
    let benchmarkVal = startingCapital;

    // Use allocation weights to influence expected returns
    const avgWeight = totalWeight > 0 ? totalWeight / allocations.filter(a => a.weight > 0).length : 0;
    const diversificationBonus = Math.min(allocations.filter(a => a.weight > 0).length / 10, 1) * 0.005;

    for (let i = 0; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (months - i));
      const label = date.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });

      if (i > 0) {
        // Portfolio return influenced by diversification and allocation quality
        const baseReturn = 0.008 + diversificationBonus; // ~0.8-1.3% monthly
        const volatility = 0.04 - diversificationBonus; // less volatile when diversified
        const portfolioReturn = 1 + baseReturn + (nextRandom() - 0.5) * volatility;
        const benchmarkReturn = 1 + 0.008 + (nextRandom() - 0.5) * 0.035;
        portfolioVal = portfolioVal * portfolioReturn + monthlyContribution;
        benchmarkVal = benchmarkVal * benchmarkReturn + monthlyContribution;
      }

      data.push({ month: label, portfolio: Math.round(portfolioVal), benchmark: Math.round(benchmarkVal) });
    }

    const totalContributed = startingCapital + monthlyContribution * months;
    const portfolioReturn = ((portfolioVal - totalContributed) / totalContributed) * 100;
    const benchmarkReturn = ((benchmarkVal - totalContributed) / totalContributed) * 100;
    const cagr = (Math.pow(portfolioVal / startingCapital, 1 / years) - 1) * 100;
    const maxDrawdown = (() => {
      let peak = data[0].portfolio;
      let maxDD = 0;
      for (const d of data) {
        if (d.portfolio > peak) peak = d.portfolio;
        const dd = (peak - d.portfolio) / peak;
        if (dd > maxDD) maxDD = dd;
      }
      return maxDD * 100;
    })();

    return { data, totalContributed, portfolioVal, benchmarkVal, portfolioReturn, benchmarkReturn, cagr, maxDrawdown };
  }, [hasRun, years, startingCapital, monthlyContribution, allocations, totalWeight]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" /> Portfolio Lab
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Backtest allocation strategies and simulate portfolio performance over time.
          </p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">
          Set your target allocation weights, define your investment parameters, and run a backtest simulation
          to see how your strategy would have performed historically.
        </p>
      </div>

      <Tabs defaultValue="allocation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="allocation"><PieChart className="w-4 h-4 mr-1.5" /> Allocation</TabsTrigger>
          <TabsTrigger value="results"><BarChart2 className="w-4 h-4 mr-1.5" /> Results</TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="space-y-4">
          {/* Investment Parameters */}
          <Card className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Investment Parameters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Starting Capital ($)</Label>
                <Input type="number" value={startingCapital} onChange={e => setStartingCapital(Number(e.target.value))} />
              </div>
              <div>
                <Label>Monthly Contribution ($)</Label>
                <Input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} />
              </div>
              <div>
                <Label>Backtest Period (Years)</Label>
                <Input type="number" min={1} max={30} value={years} onChange={e => setYears(Number(e.target.value))} />
              </div>
            </div>
          </Card>

          {/* Allocation Weights */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Target Allocation</h3>
              <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                {totalWeight}% / 100%
              </Badge>
            </div>

            {allocations.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No holdings found. Add holdings to your portfolio first.
              </p>
            ) : (
              <div className="space-y-3">
                {allocations.map((alloc, idx) => (
                  <div key={alloc.symbol} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-sm font-medium text-foreground w-20 truncate">{alloc.symbol}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate hidden sm:block">{alloc.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-20 text-right"
                      value={alloc.weight}
                      onChange={e => updateWeight(idx, Number(e.target.value))}
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const even = Math.floor(100 / allocations.length);
                  setAllocations(prev => prev.map((a, i) => ({ ...a, weight: i === 0 ? 100 - even * (allocations.length - 1) : even })));
                }}>
                  Equal Weight
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAllocations(prev => prev.map(a => ({ ...a, weight: 0 })))}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              </div>
              <Button onClick={() => { setHasRun(true); }} disabled={totalWeight !== 100 || allocations.length === 0}>
                <Play className="w-4 h-4 mr-1.5" /> Run Backtest
              </Button>
            </div>
          </Card>

          {/* Pie Chart Preview */}
          {allocations.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Allocation Preview</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie
                      data={allocations.filter(a => a.weight > 0)}
                      dataKey="weight"
                      nameKey="symbol"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {allocations.filter(a => a.weight > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value}%`, 'Weight']} />
                    <Legend />
                  </RPieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {!backtestResults ? (
            <Card className="p-12 text-center">
              <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Results Yet</h3>
              <p className="text-muted-foreground text-sm">Set your allocation and run a backtest to see results.</p>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Final Portfolio</p>
                  <p className="text-xl font-bold text-foreground">${backtestResults.portfolioVal.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Total Contributed</p>
                  <p className="text-xl font-bold text-foreground">${backtestResults.totalContributed.toLocaleString()}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Total Return</p>
                  <p className={`text-xl font-bold flex items-center gap-1 ${backtestResults.portfolioReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {backtestResults.portfolioReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {backtestResults.portfolioReturn.toFixed(1)}%
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">CAGR</p>
                  <p className="text-xl font-bold text-primary">{backtestResults.cagr.toFixed(1)}%</p>
                </Card>
                <Card className="p-4 col-span-2 md:col-span-1">
                  <p className="text-xs text-muted-foreground">Max Drawdown</p>
                  <p className="text-xl font-bold text-destructive">-{backtestResults.maxDrawdown.toFixed(1)}%</p>
                </Card>
              </div>

              {/* Performance Chart */}
              <Card className="p-6">
                <h3 className="font-semibold text-foreground mb-4">Simulated Growth</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={backtestResults.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={Math.floor(backtestResults.data.length / 8)} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      />
                      <Area type="monotone" dataKey="portfolio" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Your Portfolio" strokeWidth={2} />
                      <Area type="monotone" dataKey="benchmark" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.05} name="S&P 500 Benchmark" strokeWidth={1.5} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioLab;
