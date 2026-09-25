import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { useLanguage, LanguageToggle } from '@/context/LanguageContext';

interface Row { share_code: string; portfolio_name: string; holdings_count: number; return_pct: number; views_count: number; }

const HalalLeaderboard = () => {
  const { t } = useLanguage();
  useSeo({ title: 'Public Portfolio Leaderboard — WealthOS', description: 'Opt-in public portfolios ranked by return. Percentages only, no amounts shown.', canonicalPath: '/tools/leaderboard' });
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    (supabase.rpc as any)('public_portfolio_leaderboard').then(({ data }: any) => setRows(data ?? []));
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Link to="/tools" className="text-sm text-muted-foreground hover:text-foreground">← {t('Tools')}</Link>
          <LanguageToggle />
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="w-7 h-7 text-primary" /> {t('Leaderboard')}</h1>
        <p className="text-muted-foreground">Portfolios their owners chose to make public, ranked by total return. Only percentages are shown — never amounts.</p>
        <Card>
          <CardHeader><CardTitle className="text-base">Top public portfolios</CardTitle></CardHeader>
          <CardContent>
            {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> :
              rows.length === 0 ? <p className="text-sm text-muted-foreground">No public portfolios yet. Make yours public from Share Portfolio.</p> :
              <ol className="divide-y divide-border">
                {rows.map((r, i) => (
                  <li key={r.share_code} className="py-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3"><span className="w-6 text-muted-foreground">{i + 1}</span>
                      <Link to={`/portfolio/${r.share_code}`} className="font-medium hover:underline">{r.portfolio_name}</Link>
                      <span className="text-xs text-muted-foreground">{r.holdings_count} holdings</span></span>
                    <span className={`font-bold ${r.return_pct >= 0 ? 'text-primary' : 'text-destructive'}`}>{r.return_pct >= 0 ? '+' : ''}{Number(r.return_pct).toFixed(2)}%</span>
                  </li>))}
              </ol>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
export default HalalLeaderboard;
