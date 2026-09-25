import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { AlertTriangle, PieChart, Target, TrendingUp } from 'lucide-react';
import type { Holding } from '@/types';

const EXP_KEY = 'wealthos.monthlyExpenses';
const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const DividendIncomeInsights = ({ holdings }: { holdings: Holding[] }) => {
  const [expenses, setExpenses] = useState(() => localStorage.getItem(EXP_KEY) ?? '3000');

  const stats = useMemo(() => {
    const rows = holdings
      .filter(h => h.shares > 0 && (h.dividendYield ?? 0) > 0)
      .map(h => {
        const price = h.currentPrice || h.avgPrice;
        const income = h.shares * price * (h.dividendYield / 100);
        const cost = h.shares * h.avgPrice;
        return { symbol: h.symbol, name: h.name, income, cost, yoc: cost > 0 ? (income / cost) * 100 : 0 };
      })
      .sort((a, b) => b.income - a.income);
    const total = rows.reduce((s, r) => s + r.income, 0);
    const totalCost = holdings.reduce((s, h) => s + h.shares * h.avgPrice, 0);
    const value = holdings.reduce((s, h) => s + h.shares * (h.currentPrice || h.avgPrice), 0);
    const top2 = rows.slice(0, 2).reduce((s, r) => s + r.income, 0);
    return {
      rows, total,
      yoc: totalCost > 0 ? (total / totalCost) * 100 : 0,
      curYield: value > 0 ? (total / value) * 100 : 0,
      top2Share: total > 0 ? (top2 / total) * 100 : 0,
    };
  }, [holdings]);

  const monthlyExp = Math.max(0, parseFloat(expenses) || 0);
  const coverage = monthlyExp > 0 ? (stats.total / 12 / monthlyExp) * 100 : 0;

  if (!stats.rows.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Yield on cost</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-primary">{stats.yoc.toFixed(2)}%</span>
            <span className="text-sm text-muted-foreground mb-1">vs {stats.curYield.toFixed(2)}% current yield</span>
          </div>
          <ul className="text-sm space-y-1">
            {[...stats.rows].sort((a, b) => b.yoc - a.yoc).slice(0, 5).map(r => (
              <li key={r.symbol} className="flex justify-between"><span className="font-medium">{r.symbol}</span><span>{r.yoc.toFixed(2)}%</span></li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" /> Income concentration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">Your top 2 payers give <span className="font-bold">{stats.top2Share.toFixed(0)}%</span> of your dividend income.</p>
          {stats.top2Share >= 40 && (
            <p className="text-sm flex gap-2 text-destructive"><AlertTriangle className="w-4 h-4 shrink-0" /> High risk: one dividend cut would hit your income hard.</p>
          )}
          <ul className="text-sm space-y-2">
            {stats.rows.slice(0, 5).map(r => {
              const pct = stats.total > 0 ? (r.income / stats.total) * 100 : 0;
              return (
                <li key={r.symbol}>
                  <div className="flex justify-between"><span className="font-medium">{r.symbol}</span><span>{pct.toFixed(1)}% · {fmt(r.income)}</span></div>
                  <Progress value={pct} className="h-1.5 mt-1" />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Financial independence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="fi-exp" className="text-xs">Monthly expenses</Label>
            <Input id="fi-exp" inputMode="decimal" value={expenses} className="mt-1"
              onChange={e => { setExpenses(e.target.value); localStorage.setItem(EXP_KEY, e.target.value); }} />
          </div>
          <p className="text-sm">Dividends cover <span className="font-bold text-primary">{coverage.toFixed(1)}%</span> of your monthly expenses ({fmt(stats.total / 12)}/mo).</p>
          <Progress value={Math.min(100, coverage)} className="h-2" />
          {coverage < 100 && stats.curYield > 0 && (
            <p className="text-xs text-muted-foreground">
              About {fmt(((monthlyExp * 12 - stats.total) / stats.curYield) * 100)} more invested at your current yield would cover everything.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
