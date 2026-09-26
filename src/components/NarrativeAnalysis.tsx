import { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';
import { cleanSymbol } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { FileText, Info, Search } from 'lucide-react';

interface CompanySnapshot {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  dividendYield: number | null;
  peRatio: number | null;
  marketCap: number | null;
  sector: string | null;
  source: string | null;
  updatedAt: string | null;
}

const usd = (value: number | null) => value == null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export const NarrativeAnalysis = () => {
  const { activePortfolio } = usePortfolio();
  const [search, setSearch] = useState('');
  const [snapshots, setSnapshots] = useState<Record<string, CompanySnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const holdings = activePortfolio?.holdings || [];
  const symbols = useMemo(() => [...new Set(holdings.map(holding => cleanSymbol(holding.symbol)))], [holdings]);

  useEffect(() => {
    let cancelled = false;
    if (!symbols.length) { setSnapshots({}); setLoading(false); return; }
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.from('market_data_cache')
          .select('symbol, price, change_percent, dividend_yield, pe_ratio, market_cap, sector, source, updated_at')
          .in('symbol', symbols);
        if (cancelled) return;
        if (queryError) { setError('Could not read the market-data cache.'); setSnapshots({}); return; }
        const rows: Record<string, CompanySnapshot> = {};
        (data || []).forEach((row: any) => {
          if (row.source === 'mock' || !(Number(row.price) > 0)) return;
          rows[row.symbol] = {
            symbol: row.symbol,
            price: Number(row.price),
            changePercent: row.change_percent == null ? null : Number(row.change_percent),
            dividendYield: row.dividend_yield == null ? null : Number(row.dividend_yield),
            peRatio: row.pe_ratio == null ? null : Number(row.pe_ratio),
            marketCap: row.market_cap == null ? null : Number(row.market_cap),
            sector: row.sector || null,
            source: row.source || null,
            updatedAt: row.updated_at || null,
          };
        });
        setSnapshots(rows);
      } catch {
        if (!cancelled) setError('Could not load the market-data cache.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [symbols.join('|')]);

  const filteredHoldings = holdings.filter(holding => {
    const query = search.trim().toLowerCase();
    return !query || holding.symbol.toLowerCase().includes(query) || holding.name.toLowerCase().includes(query);
  });

  if (!holdings.length) {
    return <Card><CardContent className="py-12 text-center"><FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h3 className="text-lg font-semibold">No holdings to research</h3><p className="mt-2 text-sm text-muted-foreground">Add holdings to see sourced company snapshots here.</p></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><FileText className="h-6 w-6 text-primary" />Company Research</h2>
        <p className="mt-1 text-muted-foreground">A portfolio view of the latest market metrics available from your connected data provider.</p>
      </div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter by ticker or company" /></div>
      <div className="flex items-start gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>Current quotes and available fundamentals are shown with their provider and update time. News, analyst consensus, filings, and historical financial statements require a dedicated source and are not generated here.</p></div>
      {error && <p role="status" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredHoldings.map(holding => {
          const symbol = cleanSymbol(holding.symbol);
          const snapshot = snapshots[symbol];
          const metrics = [
            ['Price', snapshot ? usd(snapshot.price) : '—'],
            ['Daily change', snapshot?.changePercent == null ? '—' : `${snapshot.changePercent > 0 ? '+' : ''}${snapshot.changePercent.toFixed(2)}%`],
            ['Dividend yield', snapshot?.dividendYield == null ? '—' : `${snapshot.dividendYield.toFixed(2)}%`],
            ['P/E ratio', snapshot?.peRatio == null ? '—' : snapshot.peRatio.toFixed(2)],
            ['Market cap', snapshot?.marketCap == null ? '—' : usd(snapshot.marketCap)],
            ['Sector', snapshot?.sector || '—'],
          ];
          return (
            <Card key={holding.id || symbol}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3"><div><CardTitle>{symbol}</CardTitle><CardDescription className="mt-1">{holding.name}</CardDescription></div><Badge variant="outline">{snapshot?.source?.replaceAll('_', ' ') || (loading ? 'Loading' : 'No quote')}</Badge></div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {metrics.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
                </dl>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Provider update: {snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : 'Unavailable'}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!filteredHoldings.length && <p className="py-10 text-center text-sm text-muted-foreground">No holdings match this search.</p>}
    </div>
  );
};

export default NarrativeAnalysis;
