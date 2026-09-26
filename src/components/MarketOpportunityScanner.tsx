import { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { fetchMarketPrices, PriceData } from '@/services/marketDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, Radar } from 'lucide-react';

const MarketOpportunityScanner = () => {
  const { activePortfolio } = usePortfolio();
  const symbols = useMemo(() => [...new Set((activePortfolio?.holdings || []).map(holding => cleanSymbol(holding.symbol)))], [activePortfolio?.holdings]);
  const [quotes, setQuotes] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!symbols.length) { setQuotes({}); return; }
    setLoading(true);
    fetchMarketPrices(symbols, 'mixed').then(data => { if (!cancelled) setQuotes(data); })
      .catch(() => { if (!cancelled) setQuotes({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbols.join('|')]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Radar className="h-6 w-6 text-primary" />Market Opportunity Scanner</h2>
        <p className="mt-1 text-sm text-muted-foreground">Market-data coverage for your portfolio symbols. No unsupported target prices or opportunity scores are shown.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Quote coverage</CardTitle><CardDescription>{symbols.length} symbols in the selected portfolio</CardDescription></CardHeader>
        <CardContent>
          {!symbols.length ? <p className="py-8 text-center text-sm text-muted-foreground">Add portfolio holdings to review provider coverage.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-2 py-3">Symbol</th><th className="px-2 py-3 text-right">Price</th><th className="px-2 py-3 text-right">Daily change</th><th className="px-2 py-3 text-right">Provider</th><th className="px-2 py-3 text-right">Updated</th></tr></thead>
              <tbody>{symbols.map(symbol => {
                const quote = quotes[symbol];
                return <tr key={symbol} className="border-b border-border/50"><td className="px-2 py-3 font-semibold">{symbol}</td><td className="px-2 py-3 text-right">{quote ? new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(quote.price) : loading ? 'Loading…' : 'Unavailable'}</td><td className="px-2 py-3 text-right">{quote ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '—'}</td><td className="px-2 py-3 text-right">{quote?.source?.replaceAll('_', ' ') || '—'}</td><td className="px-2 py-3 text-right text-xs text-muted-foreground">{quote?.lastUpdated ? new Date(quote.lastUpdated).toLocaleString() : '—'}</td></tr>;
              })}</tbody>
            </table></div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4 text-primary" />Screening inputs required</CardTitle><CardDescription>Recommendations need comparable, dated company data</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground"><Badge variant="outline">Financial statements: unavailable</Badge><Badge variant="outline">Valuation history: unavailable</Badge><Badge variant="outline">Dividend forecast: unavailable</Badge><Badge variant="outline">News and catalysts: unavailable</Badge><p className="basis-full">A quote alone cannot establish that a stock is undervalued or likely to outperform. Scores, target prices, and buy/sell ideas remain hidden until these sources are connected.</p></CardContent>
      </Card>
    </div>
  );
};

export default MarketOpportunityScanner;
