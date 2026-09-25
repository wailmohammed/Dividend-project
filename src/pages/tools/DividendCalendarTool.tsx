import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, Search, AlertTriangle } from 'lucide-react';
import type { SafetyRating } from '@/hooks/useDividendSafety';

const POPULAR = ['KO', 'PG', 'JNJ', 'O', 'MSFT', 'ABT', 'PEP', 'MCD', 'CVX', 'XOM', 'HD', 'VZ', 'MAIN', 'STAG', 'SCHD', 'JEPI'];

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

const DividendCalendarTool: React.FC = () => {
  const [rows, setRows] = useState<SafetyRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = async (symbols: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('dividend-safety', { body: { symbols } });
      if (fnError) throw fnError;
      const fetched: SafetyRating[] = (data?.ratings || []).map((r: any) => ({ ...r, risks: Array.isArray(r.risks) ? r.risks : [] }));
      setRows(prev => {
        const map = new Map(prev.map(r => [r.symbol, r]));
        for (const r of fetched) map.set(r.symbol, r);
        return Array.from(map.values()).sort((a, b) => (a.next_ex_date || '9999').localeCompare(b.next_ex_date || '9999'));
      });
    } catch (e: any) {
      setError('Live dividend data is unavailable right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(POPULAR); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = query.trim().toUpperCase();
    if (symbol) load([symbol]);
    setQuery('');
  };

  useSeo({
    title: 'Dividend Calendar 2026: Ex-Dividend & Pay Dates',
    description: 'Free dividend calendar with upcoming ex-dividend dates, pay dates, yields and dividend safety scores for popular dividend stocks. Search any ticker.',
    canonicalPath: '/tools/dividend-calendar',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is an ex-dividend date?',
          acceptedAnswer: { '@type': 'Answer', text: 'The ex-dividend date is the first day a stock trades without the right to the next dividend. To receive the payout you must own the shares before this date.' },
        },
        {
          '@type': 'Question',
          name: 'How is the dividend safety score calculated?',
          acceptedAnswer: { '@type': 'Answer', text: 'The score combines the payout ratio, free cash-flow coverage of the dividend, debt levels, the consecutive dividend growth streak and five-year dividend growth into a 1-100 rating.' },
        },
      ],
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <nav className="text-sm text-muted-foreground mb-6"><Link to="/tools" className="hover:underline">Tools</Link> / Dividend Calendar</nav>
        <h1 className="text-4xl font-bold mb-3 flex items-center gap-3"><CalendarDays className="w-8 h-8 text-primary" />Dividend calendar</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Upcoming ex-dividend dates, pay dates, yields and safety scores for popular dividend payers. Search any ticker to add it to the table.
        </p>

        <form onSubmit={onSearch} className="flex gap-2 mb-6 max-w-md">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search a ticker, e.g. AAPL"
            aria-label="Search a stock ticker"
          />
          <Button type="submit"><Search className="w-4 h-4 mr-2" />Search</Button>
        </form>

        {error && (
          <Card className="p-4 mb-6 border-amber-500/40 text-amber-600 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </Card>
        )}

        <Card className="p-4 overflow-x-auto">
          {loading && rows.length === 0 ? (
            <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Upcoming ex-dividend and pay dates</caption>
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th scope="col" className="py-2 pr-3">Ticker</th>
                  <th scope="col" className="py-2 pr-3">Next ex-date</th>
                  <th scope="col" className="py-2 pr-3">Est. pay date</th>
                  <th scope="col" className="py-2 pr-3 text-right">Yield</th>
                  <th scope="col" className="py-2 pr-3 text-right">Annual dividend</th>
                  <th scope="col" className="py-2 pr-3">Frequency</th>
                  <th scope="col" className="py-2 pr-3 text-center">Safety</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.symbol} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{r.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.name}</div>
                    </td>
                    <td className="py-2 pr-3">{fmtDate(r.next_ex_date)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.next_pay_date)}</td>
                    <td className="py-2 pr-3 text-right">{r.dividend_yield ? `${Number(r.dividend_yield).toFixed(2)}%` : '—'}</td>
                    <td className="py-2 pr-3 text-right">{r.annual_dividend ? `$${Number(r.annual_dividend).toFixed(2)}` : '—'}</td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">{r.frequency || '—'}</td>
                    <td className="py-2 pr-3 text-center">
                      <Badge variant="outline">{r.grade} · {r.score}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <section className="mt-10 space-y-4 text-sm text-muted-foreground max-w-3xl">
          <h2 className="text-xl font-semibold text-foreground">How to use the dividend calendar</h2>
          <p>To receive a dividend you must own the shares before the ex-dividend date. Pay dates shown here are estimated from each company's historical schedule and can shift by a few days.</p>
          <h2 className="text-xl font-semibold text-foreground">What the safety score means</h2>
          <p>Scores run from 1 to 100 and combine the payout ratio, free cash-flow coverage, debt levels, the consecutive dividend growth streak and five-year dividend growth. A score above 80 (grade A) points to a well-covered dividend; below 40 (grade D or F) suggests a real risk of a cut.</p>
          <p><Link to="/tools/dividend-calculator" className="text-primary hover:underline">Project your future dividend income →</Link></p>
        </section>
      </div>
    </main>
  );
};

export default DividendCalendarTool;
