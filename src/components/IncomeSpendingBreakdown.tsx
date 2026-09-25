import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import { Badge } from './ui/badge';
import { usePortfolio } from '@/context/PortfolioContext';

const IncomeSpendingBreakdown: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [timeRange, setTimeRange] = useState<'6m' | '1y' | '2y'>('1y');

  // Generate monthly cash flow data from holdings
  const annualDividendIncome = activePortfolio.holdings.reduce((acc, h) => {
    return acc + (Number(h.shares) * Number(h.currentPrice) * (Number(h.dividendYield || 0) / 100));
  }, 0);
  const monthlyDivIncome = annualDividendIncome / 12;

  const months = timeRange === '6m' ? 6 : timeRange === '1y' ? 12 : 24;
  const data = Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (months - 1 - i));
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const seasonalMultiplier = [3, 6, 9, 12].includes(d.getMonth() + 1) ? 1.8 : 0.7; // Quarterly dividend bump
    const dividends = Math.round(monthlyDivIncome * seasonalMultiplier * (0.9 + Math.random() * 0.2));
    const deposits = i % 1 === 0 ? Math.round(1000 + Math.random() * 500) : 0;
    const withdrawals = Math.random() > 0.8 ? -Math.round(500 + Math.random() * 1000) : 0;
    return { month: monthLabel, dividends, deposits, withdrawals: Math.abs(withdrawals), net: dividends + deposits + withdrawals };
  });

  const totalDividends = data.reduce((s, d) => s + d.dividends, 0);
  const totalDeposits = data.reduce((s, d) => s + d.deposits, 0);
  const totalWithdrawals = data.reduce((s, d) => s + d.withdrawals, 0);
  const netCashFlow = totalDividends + totalDeposits - totalWithdrawals;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Income & Cash Flow
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Monthly breakdown of dividends, deposits, and withdrawals</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['6m', '1y', '2y'] as const).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeRange === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> Dividend Income
            </div>
            <div className="text-xl font-bold text-emerald-500">${totalDividends.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ArrowUpRight className="w-3 h-3" /> Deposits
            </div>
            <div className="text-xl font-bold text-blue-500">${totalDeposits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ArrowDownRight className="w-3 h-3" /> Withdrawals
            </div>
            <div className="text-xl font-bold text-red-500">${totalWithdrawals.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> Net Cash Flow
            </div>
            <div className={`text-xl font-bold ${netCashFlow >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {netCashFlow >= 0 ? '+' : ''}${netCashFlow.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-6">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '12px' }}
                  formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]} />
                <Legend />
                <Bar dataKey="dividends" name="Dividends" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deposits" name="Deposits" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" name="Withdrawals" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Month</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Dividends</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Deposits</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Withdrawals</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(-6).reverse().map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 font-medium text-foreground">{row.month}</td>
                    <td className="py-2.5 text-right text-emerald-500 font-medium">${row.dividends.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-blue-500 font-medium">${row.deposits.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-red-500 font-medium">{row.withdrawals > 0 ? `-$${row.withdrawals.toLocaleString()}` : '—'}</td>
                    <td className={`py-2.5 text-right font-bold ${row.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {row.net >= 0 ? '+' : ''}${row.net.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomeSpendingBreakdown;
