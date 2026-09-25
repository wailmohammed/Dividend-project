import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { AlertTriangle, CheckCircle, Globe, Building2, Layers } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(328, 85%, 57%)',
  'hsl(45, 93%, 47%)',
  'hsl(173, 80%, 40%)',
  'hsl(280, 67%, 44%)',
  'hsl(12, 76%, 61%)',
  'hsl(210, 79%, 46%)',
];

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  index?: number;
}

const CustomTreemapContent: React.FC<TreemapContentProps> = ({ x = 0, y = 0, width = 0, height = 0, name = '', value = 0, index = 0 }) => {
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} rx={4} />
      {width > 60 && height > 40 && (
        <>
          <text x={x + 8} y={y + 18} fill="white" fontSize={12} fontWeight="bold">{name}</text>
          <text x={x + 8} y={y + 34} fill="rgba(255,255,255,0.8)" fontSize={10}>{value.toFixed(1)}%</text>
        </>
      )}
    </g>
  );
};

const ConcentrationWarning: React.FC<{ items: { name: string; pct: number }[]; threshold: number; label: string }> = ({ items, threshold, label }) => {
  const concentrated = items.filter(i => i.pct > threshold);
  if (concentrated.length === 0) return (
    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <CheckCircle className="w-4 h-4" />
      <span>Good {label} diversification — no single {label.toLowerCase()} exceeds {threshold}%</span>
    </div>
  );
  return (
    <div className="space-y-1">
      {concentrated.map(c => (
        <div key={c.name} className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span><strong>{c.name}</strong> is {c.pct.toFixed(1)}% of portfolio — consider rebalancing (above {threshold}% threshold)</span>
        </div>
      ))}
    </div>
  );
};

const PortfolioDiversification: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];

  const totalValue = useMemo(() => holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0), [holdings]);

  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Unknown';
      map[sector] = (map[sector] || 0) + h.shares * h.currentPrice;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      const country = h.country || 'US';
      map[country] = (map[country] || 0) + h.shares * h.currentPrice;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const assetTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      map[h.assetType] = (map[h.assetType] || 0) + h.shares * h.currentPrice;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const topHoldings = useMemo(() => {
    return holdings
      .map(h => ({ name: h.symbol, value: h.shares * h.currentPrice, pct: totalValue > 0 ? (h.shares * h.currentPrice / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [holdings, totalValue]);

  const treemapData = sectorData.map(s => ({ name: s.name, size: s.pct }));

  const renderPieChart = (data: { name: string; value: number; pct: number }[], title: string, icon: React.ReactNode) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={2} strokeWidth={0}>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val: number) => `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 max-h-[140px] overflow-y-auto">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                </div>
                <span className="font-medium">{item.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Diversification</h2>
          <p className="text-muted-foreground">Add holdings to see your diversification analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Portfolio Diversification</h2>
        <p className="text-muted-foreground">Visualize your portfolio composition across sectors, countries, and asset types</p>
      </div>

      {/* Concentration Warnings */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Concentration Analysis</CardTitle>
          <CardDescription>Warnings when any single position exceeds recommended thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ConcentrationWarning items={topHoldings} threshold={25} label="Holding" />
          <ConcentrationWarning items={sectorData} threshold={40} label="Sector" />
          <ConcentrationWarning items={countryData} threshold={80} label="Country" />
        </CardContent>
      </Card>

      {/* Sector Treemap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4" />Sector Allocation Treemap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={treemapData} dataKey="size" nameKey="name" content={<CustomTreemapContent />} />
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderPieChart(sectorData, 'By Sector', <Building2 className="w-4 h-4" />)}
        {renderPieChart(countryData, 'By Country', <Globe className="w-4 h-4" />)}
        {renderPieChart(assetTypeData, 'By Asset Type', <Layers className="w-4 h-4" />)}
      </div>

      {/* Top Holdings Bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 10 Holdings by Weight</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topHoldings.map((h, i) => (
            <div key={h.name} className="flex items-center gap-3">
              <span className="text-sm font-mono w-12 text-muted-foreground">{h.name}</span>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(h.pct, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                />
              </div>
              <span className="text-sm font-medium w-16 text-right">{h.pct.toFixed(1)}%</span>
              <Badge variant="outline" className="text-xs">${(h.value / 1000).toFixed(1)}K</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioDiversification;
