import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePortfolio } from '@/context/PortfolioContext';
import { useHoldingCategories } from '@/hooks/useHoldingCategories';
import { cleanSymbol } from '@/lib/utils';
import {
  TrendingUp, DollarSign, Zap, Shield, BarChart3, Tags, PieChart as PieChartIcon, Target
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

type Strategy = 'Growth' | 'Income' | 'Speculative' | 'Value' | 'Index';

const STRATEGY_CONFIG: Record<Strategy, { color: string; icon: React.ReactNode; description: string }> = {
  Growth: { color: '#6366f1', icon: <TrendingUp className="w-4 h-4" />, description: 'High growth, lower yield, higher P/E' },
  Income: { color: '#22c55e', icon: <DollarSign className="w-4 h-4" />, description: 'Dividend-focused, stable cash flow' },
  Speculative: { color: '#f97316', icon: <Zap className="w-4 h-4" />, description: 'High risk/reward, volatile' },
  Value: { color: '#3b82f6', icon: <Target className="w-4 h-4" />, description: 'Undervalued, margin of safety' },
  Index: { color: '#8b5cf6', icon: <Shield className="w-4 h-4" />, description: 'Broad market ETFs and index funds' },
};

// Heuristic to auto-assign strategies based on holding characteristics
const autoAssignStrategy = (symbol: string, dividendYield: number, assetType: string): Strategy => {
  const sym = cleanSymbol(symbol).toUpperCase();
  
  // ETFs/Index
  if (assetType === 'ETF' || ['VOO', 'VTI', 'SPY', 'QQQ', 'SCHD', 'VIG', 'VXUS', 'BND'].includes(sym)) return 'Index';
  
  // Crypto = speculative
  if (assetType === 'Crypto') return 'Speculative';
  
  // High yield = Income
  if (dividendYield >= 3) return 'Income';
  
  // Well-known growth
  if (['NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'NFLX', 'CRM', 'SNOW', 'CRWD'].includes(sym)) return 'Growth';
  
  // Value
  if (['VZ', 'INTC', 'BMY', 'CVS', 'T'].includes(sym)) return 'Value';
  
  // Default based on yield
  if (dividendYield > 0 && dividendYield < 2) return 'Growth';
  if (dividendYield >= 2) return 'Income';
  
  return 'Growth';
};

export const PortfolioStrategyCategories: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  
  // Persisted category overrides
  const { categories: overrides, setCategory: handleOverride } = useHoldingCategories();

  const categorizedHoldings = useMemo(() => {
    return holdings.map(h => {
      const symbol = cleanSymbol(h.symbol);
      const strategy = overrides[symbol] || autoAssignStrategy(h.symbol, h.dividendYield, h.assetType);
      const value = h.shares * h.currentPrice;
      const gain = (h.currentPrice - h.avgPrice) / h.avgPrice * 100;
      return { ...h, symbol, strategy, value, gain };
    });
  }, [holdings, overrides]);

  const strategyStats = useMemo(() => {
    const stats: Record<Strategy, { count: number; value: number; avgGain: number; avgYield: number; symbols: string[] }> = {
      Growth: { count: 0, value: 0, avgGain: 0, avgYield: 0, symbols: [] },
      Income: { count: 0, value: 0, avgGain: 0, avgYield: 0, symbols: [] },
      Speculative: { count: 0, value: 0, avgGain: 0, avgYield: 0, symbols: [] },
      Value: { count: 0, value: 0, avgGain: 0, avgYield: 0, symbols: [] },
      Index: { count: 0, value: 0, avgGain: 0, avgYield: 0, symbols: [] },
    };
    
    categorizedHoldings.forEach(h => {
      const s = stats[h.strategy];
      s.count++;
      s.value += h.value;
      s.avgGain += h.gain;
      s.avgYield += h.dividendYield;
      s.symbols.push(h.symbol);
    });
    
    Object.values(stats).forEach(s => {
      if (s.count > 0) {
        s.avgGain /= s.count;
        s.avgYield /= s.count;
      }
    });
    
    return stats;
  }, [categorizedHoldings]);

  const totalValue = categorizedHoldings.reduce((s, h) => s + h.value, 0);

  const pieData = Object.entries(strategyStats)
    .filter(([, s]) => s.value > 0)
    .map(([key, s]) => ({
      name: key,
      value: s.value,
      color: STRATEGY_CONFIG[key as Strategy].color,
      pct: totalValue > 0 ? (s.value / totalValue * 100) : 0,
    }));

  const barData = Object.entries(strategyStats)
    .filter(([, s]) => s.count > 0)
    .map(([key, s]) => ({
      strategy: key,
      'Avg Return': +s.avgGain.toFixed(1),
      'Avg Yield': +s.avgYield.toFixed(2),
    }));

  const onOverride = (symbol: string, strategy: Strategy) => {
    handleOverride(symbol, strategy);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Tags className="w-6 h-6 text-primary" />
          Strategy Categories
        </h1>
        <p className="text-muted-foreground">Categorize your holdings by investment strategy and compare performance</p>
      </div>

      {/* Strategy Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STRATEGY_CONFIG).map(([key, config]) => {
          const stats = strategyStats[key as Strategy];
          return (
            <Card key={key} style={{ borderColor: stats.count > 0 ? config.color + '40' : undefined }}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2" style={{ color: config.color }}>
                  {config.icon}
                  <span className="font-bold text-sm">{key}</span>
                </div>
                <p className="text-2xl font-bold">{stats.count}</p>
                <p className="text-xs text-muted-foreground">
                  {totalValue > 0 ? `${((stats.value / totalValue) * 100).toFixed(0)}% of portfolio` : 'No holdings'}
                </p>
                {stats.count > 0 && (
                  <p className={`text-xs mt-1 ${stats.avgGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    Avg return: {stats.avgGain >= 0 ? '+' : ''}{stats.avgGain.toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-primary" />Strategy Allocation</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} dataKey="value" label={({ name, pct }) => `${name}: ${pct.toFixed(0)}%`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${v.toFixed(0)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">No holdings</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Performance by Strategy</CardTitle></CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="strategy" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="Avg Return" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Avg Yield" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Holdings with Category Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings & Strategy Tags</CardTitle>
          <CardDescription>Auto-categorized based on characteristics. Override by selecting a different strategy.</CardDescription>
        </CardHeader>
        <CardContent>
          {categorizedHoldings.length > 0 ? (
            <div className="space-y-2">
              {categorizedHoldings.map(h => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-bold w-16">{h.symbol}</span>
                    <span className="text-sm text-muted-foreground truncate max-w-[150px]">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-medium ${h.gain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {h.gain >= 0 ? '+' : ''}{h.gain.toFixed(1)}%
                    </span>
                    <span className="text-sm text-muted-foreground">${h.value.toFixed(0)}</span>
                    <Select value={h.strategy} onValueChange={(v: Strategy) => onOverride(h.symbol, v)}>
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STRATEGY_CONFIG) as Strategy[]).map(s => (
                          <SelectItem key={s} value={s}>
                            <span className="flex items-center gap-1.5">
                              {STRATEGY_CONFIG[s].icon} {s}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Tags className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No holdings to categorize</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioStrategyCategories;
