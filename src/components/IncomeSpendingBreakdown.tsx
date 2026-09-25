import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Wallet } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDividends } from '@/hooks/useDividends';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type Period = '6m' | '1y' | '2y';

const IncomeSpendingBreakdown: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { dividends, loading: dividendsLoading } = useDividends(activePortfolio?.id);
  const [period, setPeriod] = useState<Period>('1y');
  const months = period === '6m' ? 6 : period === '1y' ? 12 : 24;

  const data = useMemo(() => {
    const now = new Date();
    const rows = Array.from({ length: months }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, month: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), purchases: 0, sales: 0, dividends: 0 };
    });
    const byMonth = new Map(rows.map((row) => [row.key, row]));
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    (activePortfolio?.transactions || []).forEach((transaction) => {
      const date = new Date(transaction.date);
      if (Number.isNaN(date.getTime()) || date < start || date > now) return;
      const row = byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (!row) return;
      const value = Math.abs(Number(transaction.totalValue) || Number(transaction.shares) * Number(transaction.price) || 0);
      if (transaction.type === 'BUY') row.purchases += value;
      if (transaction.type === 'SELL') row.sales += value;
    });

    dividends.filter((dividend) => !dividend.is_estimated).forEach((dividend) => {
      const date = new Date(`${dividend.pay_date || dividend.ex_date}T00:00:00`);
      if (Number.isNaN(date.getTime()) || date < start || date > now) return;
      const row = byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (row) row.dividends += Number(dividend.amount) || 0;
    });

    return rows;
  }, [activePortfolio?.transactions, dividends, months]);

  const totals = useMemo(() => data.reduce((sum, row) => ({
    purchases: sum.purchases + row.purchases,
    sales: sum.sales + row.sales,
    dividends: sum.dividends + row.dividends,
  }), { purchases: 0, sales: 0, dividends: 0 }), [data]);
  const hasRecordedActivity = data.some((row) => row.purchases > 0 || row.sales > 0 || row.dividends > 0);
  const netRecordedActivity = totals.sales + totals.dividends - totals.purchases;

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Wallet aria-hidden="true" className="h-5 w-5 text-primary" />Recorded cash activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Purchases and sales from your transaction ledger, plus completed dividends. Estimates and unrecorded deposits are excluded.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Activity period">
          {(['6m', '1y', '2y'] as const).map((range) => (
            <button key={range} type="button" aria-pressed={period === range} onClick={() => setPeriod(range)}
              className={`min-h-11 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === range ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Completed dividends" value={totals.dividends} icon={<CircleDollarSign aria-hidden="true" className="h-4 w-4" />} color="text-emerald-500" />
        <MetricCard label="Purchases recorded" value={totals.purchases} icon={<ArrowDownRight aria-hidden="true" className="h-4 w-4" />} color="text-blue-500" />
        <MetricCard label="Sales recorded" value={totals.sales} icon={<ArrowUpRight aria-hidden="true" className="h-4 w-4" />} color="text-violet-500" />
        <MetricCard label="Net recorded activity" value={netRecordedActivity} icon={<Wallet aria-hidden="true" className="h-4 w-4" />} color={netRecordedActivity >= 0 ? 'text-emerald-500' : 'text-destructive'} signed />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly ledger activity</CardTitle></CardHeader>
        <CardContent>
          {dividendsLoading ? (
            <div role="status" className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading saved activity…</div>
          ) : !hasRecordedActivity ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
              <Wallet aria-hidden="true" className="mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium text-foreground">No activity recorded in this period</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Add transactions or completed dividend payments to build this history. Deposits and withdrawals are not tracked in the current ledger.</p>
            </div>
          ) : (
            <>
              <div className="h-72" role="img" aria-label="Monthly purchases, sales, and completed dividends from recorded activity">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '12px' }} formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`]} />
                    <Legend />
                    <Bar dataKey="dividends" name="Completed dividends" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="purchases" name="Purchases" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sales" name="Sales" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[540px] text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted-foreground">
                    <tr><th scope="col" className="py-2 font-medium">Month</th><th scope="col" className="py-2 text-right font-medium">Dividends</th><th scope="col" className="py-2 text-right font-medium">Purchases</th><th scope="col" className="py-2 text-right font-medium">Sales</th></tr>
                  </thead>
                  <tbody>
                    {[...data].reverse().slice(0, 6).map((row) => (
                      <tr key={row.month} className="border-b border-border/50">
                        <th scope="row" className="py-2.5 text-left font-medium text-foreground">{row.month}</th>
                        <td className="py-2.5 text-right tabular-nums">{formatMoney(row.dividends)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatMoney(row.purchases)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatMoney(row.sales)}</td>
                      </tr>
                    ))}
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

const formatMoney = (amount: number) => `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const MetricCard = ({ label, value, icon, color, signed = false }: { label: string; value: number; icon: React.ReactNode; color: string; signed?: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{signed && value > 0 ? '+' : ''}{formatMoney(value)}</p>
    </CardContent>
  </Card>
);

export default IncomeSpendingBreakdown;
