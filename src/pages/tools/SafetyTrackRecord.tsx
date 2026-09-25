import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Row { symbol: string; score: number; grade: string; recorded_on: string }
interface Change { symbol: string; from: string; to: string; fromScore: number; toScore: number; date: string }

const SafetyTrackRecord: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: 'Dividend Safety Score Track Record | Every Grade Change, Public',
    description: 'A public, date-stamped record of every dividend safety grade we have issued and every upgrade or downgrade, so you can judge our scores yourself.',
    canonicalPath: '/tools/safety-track-record',
  });

  useEffect(() => {
    supabase.from('dividend_safety_history').select('symbol,score,grade,recorded_on').order('recorded_on')
      .limit(5000).then(({ data }) => { setRows((data as Row[]) || []); setLoading(false); });
  }, []);

  const bySymbol = new Map<string, Row[]>();
  rows.forEach(r => bySymbol.set(r.symbol, [...(bySymbol.get(r.symbol) || []), r]));
  const changes: Change[] = [];
  bySymbol.forEach(list => list.forEach((r, i) => {
    if (i > 0 && r.grade !== list[i - 1].grade)
      changes.push({ symbol: r.symbol, from: list[i - 1].grade, to: r.grade, fromScore: list[i - 1].score, toScore: r.score, date: r.recorded_on });
  }));
  changes.sort((a, b) => b.date.localeCompare(a.date));
  const firstDate = rows[0]?.recorded_on;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <nav className="text-sm text-muted-foreground"><Link to="/tools" className="hover:underline">Free tools</Link> / Track record</nav>
        <h1 className="text-3xl font-bold">Our dividend safety track record</h1>
        <p className="text-muted-foreground">We save every score, every day, and never edit the past. Below is every grade change since {firstDate || 'launch'} — judge the warnings for yourself.</p>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Stocks tracked</div><div className="text-2xl font-bold">{bySymbol.size}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Scores recorded</div><div className="text-2xl font-bold">{rows.length}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Grade changes</div><div className="text-2xl font-bold">{changes.length}</div></Card>
        </div>
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Grade changes</h2>
          {loading ? <Skeleton className="h-32" /> : changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grade changes yet. The record grows daily as scores are refreshed.</p>
          ) : (
            <ul className="divide-y divide-border">{changes.map(c => (
              <li key={c.symbol + c.date} className="py-2 flex items-center justify-between text-sm">
                <Link to={`/dividend/${c.symbol}`} className="font-medium hover:underline">{c.symbol}</Link>
                <span>{c.from} → {c.to} <Badge variant={c.toScore < c.fromScore ? 'destructive' : 'secondary'}>{c.toScore < c.fromScore ? 'Downgrade' : 'Upgrade'}</Badge></span>
                <span className="text-muted-foreground">{c.date}</span>
              </li>))}</ul>
          )}
        </Card>
      </div>
    </main>
  );
};

export default SafetyTrackRecord;
