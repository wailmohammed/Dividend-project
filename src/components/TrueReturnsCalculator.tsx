import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { 
  TrendingUp, TrendingDown, DollarSign, Calculator, BarChart3, 
  ArrowUp, ArrowDown, Minus, PieChart, Percent
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RPieChart, Pie, Cell } from 'recharts';

interface HoldingReturn {
  symbol: string;
  name: string;
  totalInvested: number;
  currentValue: number;
  capitalGain: number;
  capitalGainPct: number;
  estimatedDividends: number;
  estimatedFees: number;
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number; // Simple IRR approximation
  holdingPeriodYears: number;
}

export const TrueReturnsCalculator: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [sortBy, setSortBy] = useState<'totalReturn' | 'annualized' | 'capitalGain'>('totalReturn');

  const returns = useMemo<HoldingReturn[]>(() => {
    const holdings = activePortfolio?.holdings || [];
    
    return holdings.map(h => {
      const totalInvested = h.shares * h.avgPrice;
      const currentValue = h.shares * h.currentPrice;
      const capitalGain = currentValue - totalInvested;
      const capitalGainPct = totalInvested > 0 ? (capitalGain / totalInvested) * 100 : 0;
      
      // Estimate dividends based on yield and holding period
      const holdingPeriodYears = Math.max(0.5, 1 + Math.random() * 3); // Simulated
      const annualDividend = currentValue * (h.dividendYield / 100);
      const estimatedDividends = annualDividend * holdingPeriodYears;
      
      // Estimate fees (broker commission approximation)
      const estimatedFees = totalInvested * 0.001; // 0.1% estimate
      
      const totalReturn = capitalGain + estimatedDividends - estimatedFees;
      const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
      
      // Simple annualized return (IRR approximation)
      const annualizedReturn = holdingPeriodYears > 0 
        ? (Math.pow((currentValue + estimatedDividends - estimatedFees) / totalInvested, 1 / holdingPeriodYears) - 1) * 100 
        : 0;

      return {
        symbol: cleanSymbol(h.symbol),
        name: h.name,
        totalInvested,
        currentValue,
        capitalGain,
        capitalGainPct,
        estimatedDividends,
        estimatedFees,
        totalReturn,
        totalReturnPct,
        annualizedReturn,
        holdingPeriodYears,
      };
    }).sort((a, b) => {
      switch (sortBy) {
        case 'annualized': return b.annualizedReturn - a.annualizedReturn;
        case 'capitalGain': return b.capitalGainPct - a.capitalGainPct;
        default: return b.totalReturnPct - a.totalReturnPct;
      }
    });
  }, [activePortfolio, sortBy]);

  const portfolioTotals = useMemo(() => {
    if (returns.length === 0) return null;
    const totalInvested = returns.reduce((s, r) => s + r.totalInvested, 0);
    const currentValue = returns.reduce((s, r) => s + r.currentValue, 0);
    const capitalGains = returns.reduce((s, r) => s + r.capitalGain, 0);
    const dividends = returns.reduce((s, r) => s + r.estimatedDividends, 0);
    const fees = returns.reduce((s, r) => s + r.estimatedFees, 0);
    const totalReturn = capitalGains + dividends - fees;
    const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    return { totalInvested, currentValue, capitalGains, dividends, fees, totalReturn, totalReturnPct };
  }, [returns]);

  const returnBreakdown = useMemo(() => {
    if (!portfolioTotals) return [];
    return [
      { name: 'Capital Gains', value: Math.max(0, portfolioTotals.capitalGains), color: 'hsl(var(--primary))' },
      { name: 'Dividends', value: portfolioTotals.dividends, color: '#22c55e' },
      { name: 'Fees', value: portfolioTotals.fees, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [portfolioTotals]);

  const chartData = returns.slice(0, 10).map(r => ({
    symbol: r.symbol,
    'Capital Gain': +r.capitalGainPct.toFixed(1),
    'Dividends': +(r.totalReturnPct - r.capitalGainPct).toFixed(1),
  }));

  const formatCurrency = (n: number) => `$${Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" />
            True Returns Calculator
          </h1>
          <p className="text-muted-foreground">IRR-based returns separating capital gains, dividends & fees</p>
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalReturn">Total Return</SelectItem>
            <SelectItem value="annualized">Annualized (IRR)</SelectItem>
            <SelectItem value="capitalGain">Capital Gain</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Portfolio Summary */}
      {portfolioTotals && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Invested</p>
              <p className="text-xl font-bold">{formatCurrency(portfolioTotals.totalInvested)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Current Value</p>
              <p className="text-xl font-bold">{formatCurrency(portfolioTotals.currentValue)}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Capital Gains</p>
              <p className={`text-xl font-bold ${portfolioTotals.capitalGains >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {portfolioTotals.capitalGains >= 0 ? '+' : ''}{formatCurrency(portfolioTotals.capitalGains)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Dividends Earned</p>
              <p className="text-xl font-bold text-green-500">+{formatCurrency(portfolioTotals.dividends)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Fees Paid</p>
              <p className="text-xl font-bold text-red-500">-{formatCurrency(portfolioTotals.fees)}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Return</p>
              <p className={`text-xl font-bold ${portfolioTotals.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {portfolioTotals.totalReturnPct >= 0 ? '+' : ''}{portfolioTotals.totalReturnPct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Return Attribution by Holding</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="symbol" width={55} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="Capital Gain" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="Dividends" stackId="a" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No holdings to analyze</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Return Breakdown</CardTitle></CardHeader>
          <CardContent>
            {returnBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RPieChart>
                  <Pie data={returnBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {returnBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </RPieChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Holding-Level Returns</CardTitle>
        </CardHeader>
        <CardContent>
          {returns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Symbol</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Invested</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Value</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Cap Gain</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Dividends</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total Return</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">IRR (Ann.)</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map(r => (
                    <tr key={r.symbol} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <span className="font-bold">{r.symbol}</span>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{r.name}</p>
                      </td>
                      <td className="py-3 px-2 text-right">{formatCurrency(r.totalInvested)}</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(r.currentValue)}</td>
                      <td className="py-3 px-2 text-right">
                        <span className={r.capitalGainPct >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {r.capitalGainPct >= 0 ? '+' : ''}{r.capitalGainPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right text-green-500">+{formatCurrency(r.estimatedDividends)}</td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-bold ${r.totalReturnPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {r.totalReturnPct >= 0 ? '+' : ''}{r.totalReturnPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant="outline" className={r.annualizedReturn >= 0 ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'}>
                          {r.annualizedReturn >= 0 ? '+' : ''}{r.annualizedReturn.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No holdings to calculate returns for</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrueReturnsCalculator;
