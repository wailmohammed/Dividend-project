import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import type { SafetyRating } from '@/hooks/useDividendSafety';

const fmt = (n: number | null | undefined, d = 2) => (n == null ? '—' : Number(n).toFixed(d));

const DividendStockPage: React.FC = () => {
  const { ticker = '' } = useParams();
  const symbol = ticker.toUpperCase();
  const navigate = useNavigate();
  const [rating, setRating] = useState<SafetyRating | null>(null);
  const [detail, setDetail] = useState<{ yearly: Record<string, number>; scores: { recorded_on: string; score: number; grade: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useSeo({
    title: `${symbol} Dividend Safety Score, History & Next Ex-Date | Free`,
    description: `Is ${symbol}'s dividend safe? Free safety grade, payout ratio, growth streak, dividend cut history and upcoming ex-dividend date for ${symbol}.`,
    canonicalPath: `/dividend/${symbol}`,
  });

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    Promise.all([
      supabase.functions.invoke('dividend-safety', { body: { symbols: [symbol] } }),
      supabase.functions.invoke('dividend-safety', { body: { detail: symbol } }),
    ]).then(([r, d]) => {
      if (!alive) return;
      const row = r.data?.ratings?.[0];
      if (!row) setError(`No dividend data found for ${symbol}.`);
      setRating(row ? { ...row, risks: Array.isArray(row.risks) ? row.risks : [] } : null);
      setDetail(d.data || null);
    }).catch(() => alive && setError('Live data is unavailable right now. Please try again shortly.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [symbol]);

  const thisYear = new Date().getFullYear();
  const yearly = Object.entries(detail?.yearly || {})
    .map(([y, v]) => ({ year: Number(y), total: Number(v) }))
    .filter(r => r.year < thisYear)
    .sort((a, b) => a.year - b.year)
    .map((r, i, arr) => ({ ...r, cut: i > 0 && r.total < arr[i - 1].total * 0.97 }));
  const cuts = yearly.filter(y => y.cut);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <nav className="text-sm text-muted-foreground"><Link to="/tools" className="hover:underline">Free tools</Link> / Dividend safety</nav>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (q.trim()) navigate(`/dividend/${q.trim().toUpperCase()}`); }}>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Check another ticker, e.g. KO" />
          <Button type="submit">Check</Button>
        </form>
        <h1 className="text-3xl font-bold">{symbol} dividend safety {rating?.name ? `— ${rating.name}` : ''}</h1>

        {loading && <Skeleton className="h-48 w-full" />}
        {error && !loading && <Card className="p-4 text-sm text-muted-foreground">{error}</Card>}

        {rating && !loading && (
          <>
            <Card className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-muted-foreground">Safety grade</div><div className="text-4xl font-bold text-primary">{rating.grade}</div><div className="text-sm">{rating.score}/100</div></div>
              <div><div className="text-xs text-muted-foreground">Yield</div><div className="text-xl font-semibold">{fmt(rating.dividend_yield)}%</div><div className="text-sm">${fmt(rating.annual_dividend)}/yr · {rating.frequency || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Payout / coverage</div><div className="text-xl font-semibold">{fmt(rating.payout_ratio, 0)}%</div><div className="text-sm">{fmt(rating.coverage_ratio)}x cash coverage</div></div>
              <div><div className="text-xs text-muted-foreground">Next ex-date</div><div className="text-xl font-semibold">{rating.next_ex_date || '—'}</div><div className="text-sm">{rating.growth_streak ?? 0} yrs of growth</div></div>
            </Card>
            {rating.risks.length > 0 && (
              <Card className="p-4"><h2 className="font-semibold mb-2">Things to watch</h2>
                <ul className="list-disc pl-5 text-sm space-y-1">{rating.risks.map(r => <li key={r}>{r}</li>)}</ul></Card>
            )}
          </>
        )}

        {yearly.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold">Dividends paid per year</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {cuts.length === 0 ? 'No dividend cuts in the last 10 years.' : `Cut in ${cuts.map(c => c.year).join(', ')} (shown in red).`}
            </p>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={yearly}>
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Bar dataKey="total">{yearly.map(y => <Cell key={y.year} fill={y.cut ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {(detail?.scores?.length || 0) > 1 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Safety score history</h2>
            <div className="h-48"><ResponsiveContainer>
              <LineChart data={detail!.scores}>
                <XAxis dataKey="recorded_on" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                <Line dataKey="score" stroke="hsl(var(--primary))" dot={false} />
              </LineChart>
            </ResponsiveContainer></div>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">Scores are calculated from public market data and are not financial advice. <Link to="/tools/safety-track-record" className="underline">See our track record</Link>. <Badge variant="outline">Free</Badge></p>
      </div>
    </main>
  );
};

export default DividendStockPage;
