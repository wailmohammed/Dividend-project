import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DividendCalculator: React.FC = () => {
  const [invested, setInvested] = useState('50000');
  const [yieldPct, setYieldPct] = useState('4');
  const [growthPct, setGrowthPct] = useState('6');
  const [years, setYears] = useState('10');
  const [reinvest, setReinvest] = useState('yes');

  const num = (v: string) => (isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  const projection = useMemo(() => {
    let balance = num(invested);
    const y = num(yieldPct) / 100;
    const g = num(growthPct) / 100;
    const n = Math.max(0, Math.min(50, Math.round(num(years))));
    const rows: { year: number; income: number; balance: number }[] = [];
    let currentYield = y;
    for (let i = 1; i <= n; i++) {
      const income = balance * currentYield;
      if (reinvest === 'yes') balance += income;
      currentYield = currentYield * (1 + g);
      rows.push({ year: i, income, balance });
    }
    return rows;
  }, [invested, yieldPct, growthPct, years, reinvest]);

  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const last = projection[projection.length - 1];

  useSeo({
    title: 'Dividend Income Calculator with DRIP & Growth',
    description: 'Project future dividend income with yield on cost, annual dividend growth and reinvestment (DRIP). See year-by-year income and portfolio value.',
    canonicalPath: '/tools/dividend-calculator',
  });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <nav className="text-sm text-muted-foreground mb-6"><Link to="/tools" className="hover:underline">Tools</Link> / Dividend Calculator</nav>
        <h1 className="text-4xl font-bold mb-3">Dividend income calculator</h1>
        <p className="text-muted-foreground mb-8">Model how dividend growth and reinvestment compound your annual income.</p>

        <Card className="p-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="inv">Amount invested</Label>
            <Input id="inv" inputMode="decimal" value={invested} onChange={e => setInvested(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="yld">Starting dividend yield (%)</Label>
            <Input id="yld" inputMode="decimal" value={yieldPct} onChange={e => setYieldPct(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="grw">Annual dividend growth (%)</Label>
            <Input id="grw" inputMode="decimal" value={growthPct} onChange={e => setGrowthPct(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="yrs">Years</Label>
            <Input id="yrs" inputMode="numeric" value={years} onChange={e => setYears(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="drip">Reinvest dividends (yes/no)</Label>
            <Input id="drip" value={reinvest} onChange={e => setReinvest(e.target.value.toLowerCase())} className="mt-1" />
          </div>
        </Card>

        {last && (
          <Card className="p-6 mt-6">
            <p className="text-sm text-muted-foreground">Annual dividend income in year {last.year}</p>
            <p className="text-3xl font-bold text-primary mb-4">{fmt(last.income)}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Year-by-year dividend income projection</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th scope="col" className="py-1">Year</th>
                    <th scope="col" className="py-1">Income</th>
                    <th scope="col" className="py-1">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.map(r => (
                    <tr key={r.year} className="border-t border-border">
                      <td className="py-1">{r.year}</td>
                      <td className="py-1">{fmt(r.income)}</td>
                      <td className="py-1">{fmt(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
};

export default DividendCalculator;
