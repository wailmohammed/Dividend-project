import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { GitCompare, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

interface CompareStock {
  symbol: string;
  name: string;
  price: number;
  pe: number;
  dividendYield: number;
  marketCap: number;
  revenueGrowth: number;
  roe: number;
  debtToEquity: number;
  payoutRatio: number;
  dividendGrowth5Y: number;
  beta: number;
  safetyScore: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(210, 80%, 55%)', 'hsl(160, 70%, 45%)', 'hsl(45, 90%, 55%)'];

const generateMockData = (symbol: string, name: string): CompareStock => {
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    symbol, name,
    price: 50 + (hash % 400),
    pe: 8 + (hash % 35),
    dividendYield: Math.round((0.5 + (hash % 60) / 10) * 100) / 100,
    marketCap: (hash % 500 + 10) * 1e9,
    revenueGrowth: Math.round((-5 + (hash % 40)) * 10) / 10,
    roe: Math.round((5 + (hash % 35)) * 10) / 10,
    debtToEquity: Math.round((10 + (hash % 200)) * 10) / 10,
    payoutRatio: Math.round((15 + (hash % 70)) * 10) / 10,
    dividendGrowth5Y: Math.round((-2 + (hash % 25)) * 10) / 10,
    beta: Math.round((0.4 + (hash % 18) / 10) * 100) / 100,
    safetyScore: 40 + (hash % 55),
  };
};

const DEFAULTS: CompareStock[] = [
  generateMockData('AAPL', 'Apple Inc.'),
  generateMockData('MSFT', 'Microsoft Corp.'),
];

const metricLabel = (key: string) => ({
  pe: 'P/E Ratio',
  dividendYield: 'Dividend Yield %',
  revenueGrowth: 'Revenue Growth %',
  roe: 'Return on Equity %',
  debtToEquity: 'Debt/Equity',
  payoutRatio: 'Payout Ratio %',
  dividendGrowth5Y: '5Y Div Growth %',
  beta: 'Beta',
  safetyScore: 'Safety Score',
  marketCap: 'Market Cap',
  price: 'Price',
}[key] || key);

const formatVal = (key: string, val: number) => {
  if (key === 'marketCap') return `$${(val / 1e9).toFixed(0)}B`;
  if (key === 'price') return `$${val.toFixed(2)}`;
  if (['dividendYield', 'revenueGrowth', 'roe', 'payoutRatio', 'dividendGrowth5Y'].includes(key)) return `${val.toFixed(1)}%`;
  return val.toFixed(2);
};

// Higher is better for these
const higherBetter = ['dividendYield', 'revenueGrowth', 'roe', 'dividendGrowth5Y', 'safetyScore'];
const lowerBetter = ['pe', 'debtToEquity', 'payoutRatio', 'beta'];

const StockComparisonTool: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [stocks, setStocks] = useState<CompareStock[]>(isDemoMode ? DEFAULTS : []);

  const handleAdd = (symbol: string, name: string) => {
    if (stocks.length >= 4 || stocks.find(s => s.symbol === symbol)) return;
    setStocks(prev => [...prev, generateMockData(symbol, name)]);
  };

  const handleRemove = (symbol: string) => {
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
  };

  const metrics = ['pe', 'dividendYield', 'revenueGrowth', 'roe', 'debtToEquity', 'payoutRatio', 'dividendGrowth5Y', 'beta', 'safetyScore'];

  const getBestIndex = (key: string) => {
    if (stocks.length < 2) return -1;
    const vals = stocks.map(s => (s as any)[key]);
    if (higherBetter.includes(key)) return vals.indexOf(Math.max(...vals));
    if (lowerBetter.includes(key)) return vals.indexOf(Math.min(...vals));
    return -1;
  };

  // Radar data
  const radarData = ['Yield', 'Growth', 'Value', 'Safety', 'Profitability'].map(dim => {
    const entry: any = { dimension: dim };
    stocks.forEach(s => {
      const score = dim === 'Yield' ? Math.min(s.dividendYield * 20, 100)
        : dim === 'Growth' ? Math.min(Math.max(s.revenueGrowth + 10, 0) * 3, 100)
        : dim === 'Value' ? Math.min(Math.max(50 - s.pe + 20, 0) * 2, 100)
        : dim === 'Safety' ? s.safetyScore
        : Math.min(s.roe * 3, 100);
      entry[s.symbol] = Math.round(score);
    });
    return entry;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            Stock Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Stock selector */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {stocks.map((s, i) => (
              <Badge key={s.symbol} className="text-sm py-1.5 px-3 gap-2" style={{ borderColor: COLORS[i], color: COLORS[i] }} variant="outline">
                {s.symbol}
                <button onClick={() => handleRemove(s.symbol)}><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            {stocks.length < 4 && (
              <div className="w-64">
                <StockSearchAutocomplete onSelect={handleAdd} placeholder="Add stock to compare..." />
              </div>
            )}
          </div>

          {stocks.length < 2 ? (
            <div className="text-center text-muted-foreground py-12">Add at least 2 stocks to compare</div>
          ) : (
            <>
              {/* Radar Chart */}
              <div className="mb-8">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                    {stocks.map((s, i) => (
                      <Radar key={s.symbol} name={s.symbol} dataKey={s.symbol} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.1} strokeWidth={2} />
                    ))}
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Metric</th>
                      {stocks.map((s, i) => (
                        <th key={s.symbol} className="text-right py-3 px-2 font-bold" style={{ color: COLORS[i] }}>{s.symbol}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2.5 px-2 text-muted-foreground">Price</td>
                      {stocks.map(s => <td key={s.symbol} className="text-right py-2.5 px-2 font-medium text-foreground">${s.price.toFixed(2)}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2.5 px-2 text-muted-foreground">Market Cap</td>
                      {stocks.map(s => <td key={s.symbol} className="text-right py-2.5 px-2 font-medium text-foreground">{formatVal('marketCap', s.marketCap)}</td>)}
                    </tr>
                    {metrics.map(key => {
                      const bestIdx = getBestIndex(key);
                      return (
                        <tr key={key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-2 text-muted-foreground">{metricLabel(key)}</td>
                          {stocks.map((s, i) => (
                            <td key={s.symbol} className={`text-right py-2.5 px-2 font-medium ${i === bestIdx ? 'text-emerald-500 font-bold' : 'text-foreground'}`}>
                              {formatVal(key, (s as any)[key])}
                              {i === bestIdx && <TrendingUp className="w-3 h-3 inline ml-1" />}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockComparisonTool;
