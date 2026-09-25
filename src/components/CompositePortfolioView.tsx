import React, { useMemo } from 'react';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, TrendingUp, TrendingDown, DollarSign, PieChart, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CompositePortfolioView: React.FC = () => {
  const { portfolios: portfolioSummaries } = usePortfolio();
  const { portfolios: dbPortfolios, holdings, loading } = usePortfolioData();

  const composite = useMemo(() => {
    const bySymbol = new Map<string, { symbol: string; name: string; totalValue: number; totalShares: number; portfolios: string[] }>();
    const bySector = new Map<string, number>();
    let totalValue = 0;
    let totalCash = 0;
    let totalCost = 0;

    const portfolioNameMap = new Map<string, string>();
    dbPortfolios.forEach(p => portfolioNameMap.set(p.id, p.name));

    dbPortfolios.forEach(p => { totalCash += p.cash_balance || 0; });

    holdings.forEach(h => {
      const value = (h.shares || 0) * (h.current_price || h.avg_price || 0);
      const cost = (h.shares || 0) * (h.avg_price || 0);
      totalValue += value;
      totalCost += cost;

      const portfolioName = portfolioNameMap.get(h.portfolio_id) || 'Unknown';
      const existing = bySymbol.get(h.symbol);
      if (existing) {
        existing.totalValue += value;
        existing.totalShares += h.shares;
        if (!existing.portfolios.includes(portfolioName)) existing.portfolios.push(portfolioName);
      } else {
        bySymbol.set(h.symbol, { symbol: h.symbol, name: h.name, totalValue: value, totalShares: h.shares, portfolios: [portfolioName] });
      }

      const sector = h.sector || 'Unknown';
      bySector.set(sector, (bySector.get(sector) || 0) + value);
    });

    totalValue += totalCash;

    const perPortfolio = dbPortfolios.map(p => {
      const pHoldings = holdings.filter(h => h.portfolio_id === p.id);
      const holdingsValue = pHoldings.reduce((s, h) => s + (h.shares || 0) * (h.current_price || h.avg_price || 0), 0);
      return { name: p.name, value: holdingsValue + (p.cash_balance || 0) };
    });

    return {
      totalValue,
      totalCash,
      totalCost,
      totalGain: totalValue - totalCash - totalCost,
      holdingCount: bySymbol.size,
      portfolioCount: dbPortfolios.length,
      topHoldings: Array.from(bySymbol.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 10),
      sectorData: Array.from(bySector.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      perPortfolio,
    };
  }, [dbPortfolios, holdings]);

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading composite data...</div>;
  }

  if (dbPortfolios.length === 0) {
    return (
      <div className="text-center py-20">
        <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">No Portfolios Found</h2>
        <p className="text-muted-foreground">Create at least one portfolio to see the composite view.</p>
      </div>
    );
  }

  const gainPercent = composite.totalCost > 0 ? (composite.totalGain / composite.totalCost) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary" /> Composite Portfolio
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Unified view of all {composite.portfolioCount} portfolio{composite.portfolioCount !== 1 ? 's' : ''} combined.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Net Worth</p>
          <p className="text-2xl font-bold text-foreground">${composite.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Cash Balance</p>
          <p className="text-2xl font-bold text-foreground">${composite.totalCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Gain/Loss</p>
          <p className={`text-2xl font-bold flex items-center gap-1 ${composite.totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {composite.totalGain >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            ${Math.abs(composite.totalGain).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-xs ${gainPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(1)}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Unique Holdings</p>
          <p className="text-2xl font-bold text-foreground">{composite.holdingCount}</p>
        </Card>
      </div>

      {/* Per-Portfolio Breakdown */}
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary" /> Portfolio Breakdown
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={composite.perPortfolio} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Allocation */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" /> Combined Sector Allocation
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RPieChart>
                <Pie data={composite.sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} stroke="none">
                  {composite.sectorData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                />
              </RPieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {composite.sectorData.slice(0, 8).map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-foreground/80 truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Holdings */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> Top Holdings (Across All Portfolios)
          </h3>
          <div className="space-y-3">
            {composite.topHoldings.map((h, i) => (
              <div key={h.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{h.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">${h.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <div className="flex gap-1 justify-end flex-wrap">
                    {h.portfolios.map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0">{p}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {composite.topHoldings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No holdings found across portfolios.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CompositePortfolioView;
