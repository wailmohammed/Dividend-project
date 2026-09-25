import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const HalalScreener: React.FC = () => {
  const [marketCap, setMarketCap] = useState('100000');
  const [debt, setDebt] = useState('20000');
  const [cash, setCash] = useState('15000');
  const [revenue, setRevenue] = useState('50000');
  const [nonCompliantRevenue, setNonCompliantRevenue] = useState('1000');

  const num = (v: string) => (isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  const result = useMemo(() => {
    const cap = num(marketCap) || 1;
    const debtRatio = (num(debt) / cap) * 100;
    const cashRatio = (num(cash) / cap) * 100;
    const revRatio = num(revenue) > 0 ? (num(nonCompliantRevenue) / num(revenue)) * 100 : 0;
    const checks = [
      { label: 'Interest-bearing debt / market cap', value: debtRatio, limit: 30 },
      { label: 'Cash & interest securities / market cap', value: cashRatio, limit: 30 },
      { label: 'Non-compliant revenue / total revenue', value: revRatio, limit: 5 },
    ];
    return { checks, pass: checks.every(c => c.value <= c.limit), purification: revRatio };
  }, [marketCap, debt, cash, revenue, nonCompliantRevenue]);

  useSeo({
    title: 'Halal Stock Screener (AAOIFI Financial Ratios)',
    description: 'Screen any stock for Shariah compliance using AAOIFI thresholds: 30% debt, 30% cash and interest securities, and 5% non-compliant revenue.',
    canonicalPath: '/tools/halal-screener',
  });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-muted-foreground mb-6"><Link to="/tools" className="hover:underline">Tools</Link> / Halal Screener</nav>
        <h1 className="text-4xl font-bold mb-3">Halal stock screener</h1>
        <p className="text-muted-foreground mb-8">Enter the company's figures (same currency and units) to test the three AAOIFI financial ratios.</p>

        <Card className="p-6 space-y-4">
          {[
            { id: 'cap', label: 'Market capitalisation', value: marketCap, set: setMarketCap },
            { id: 'debt', label: 'Interest-bearing debt', value: debt, set: setDebt },
            { id: 'cash', label: 'Cash + interest-bearing securities', value: cash, set: setCash },
            { id: 'rev', label: 'Total revenue', value: revenue, set: setRevenue },
            { id: 'ncr', label: 'Non-compliant revenue', value: nonCompliantRevenue, set: setNonCompliantRevenue },
          ].map(f => (
            <div key={f.id}>
              <Label htmlFor={f.id}>{f.label}</Label>
              <Input id={f.id} inputMode="decimal" value={f.value} onChange={e => f.set(e.target.value)} className="mt-1" />
            </div>
          ))}
        </Card>

        <Card className="p-6 mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Screening result</h2>
            <Badge variant={result.pass ? 'default' : 'destructive'}>{result.pass ? 'Likely compliant' : 'Not compliant'}</Badge>
          </div>
          {result.checks.map(c => (
            <div key={c.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{c.label}</span>
              <span className={c.value <= c.limit ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                {c.value.toFixed(1)}% / {c.limit}%
              </span>
            </div>
          ))}
          {result.purification > 0 && (
            <p className="text-sm text-muted-foreground">
              Purification: donate approximately {result.purification.toFixed(2)}% of dividends received.
            </p>
          )}
        </Card>

        <section className="mt-10 text-sm text-muted-foreground space-y-2">
          <h2 className="text-lg font-semibold text-foreground">About these thresholds</h2>
          <p>AAOIFI screening rejects companies whose primary business is impermissible and applies financial ratio limits of 30% debt, 30% cash and interest-bearing securities, and 5% impermissible income. Guidance only — not a fatwa.</p>
        </section>
      </div>
    </main>
  );
};

export default HalalScreener;
