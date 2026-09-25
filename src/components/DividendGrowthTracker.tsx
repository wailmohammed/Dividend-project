import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CalendarDays, CircleDollarSign } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDividends } from '@/hooks/useDividends';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

export const DividendGrowthTracker = () => {
  const { activePortfolio } = usePortfolio();
  const { dividends, loading } = useDividends(activePortfolio?.id);

  const yearlyIncome = useMemo(() => {
    const totals = new Map<number, { year: number; amount: number; payments: number }>();
    dividends
      .filter((dividend) => !dividend.is_estimated)
      .forEach((dividend) => {
        const paidOn = dividend.pay_date || dividend.ex_date;
        const date = new Date(`${paidOn}T00:00:00`);
        if (Number.isNaN(date.getTime()) || date > new Date()) return;
        const year = date.getFullYear();
        const total = totals.get(year) || { year, amount: 0, payments: 0 };
        total.amount += Number(dividend.amount) || 0;
        total.payments += 1;
        totals.set(year, total);
      });
    return [...totals.values()].sort((a, b) => a.year - b.year).slice(-6);
  }, [dividends]);

  const totalRecorded = yearlyIncome.reduce((sum, year) => sum + year.amount, 0);
  const paymentCount = yearlyIncome.reduce((sum, year) => sum + year.payments, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 aria-hidden="true" className="h-5 w-5 text-primary" />
          Recorded dividend income
        </CardTitle>
        <CardDescription>Completed payments saved in your ledger. Forecasts are excluded.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : yearlyIncome.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
            <CalendarDays aria-hidden="true" className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="font-medium text-foreground">No completed dividend payments recorded yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">As payment records are added, this chart will show annual income history. A single current yield cannot tell us how a company’s dividend has grown.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDollarSign aria-hidden="true" className="h-4 w-4" />Recorded income</p>
                <p className="mt-1 text-xl font-semibold text-foreground">${totalRecorded.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays aria-hidden="true" className="h-4 w-4" />Payments recorded</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{paymentCount}</p>
              </div>
            </div>
            <div className="h-64" role="img" aria-label="Annual dividend payments recorded in your ledger">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyIncome} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                  <XAxis dataKey="year" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, 'Recorded income']} />
                  <Bar dataKey="amount" name="Recorded income" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Totals reflect the dividend records currently saved for this portfolio; missing records can make a year appear lower.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
