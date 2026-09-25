import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, RefreshCw, TrendingUp, TrendingDown, Clock, Info, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const INDICES = [
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'NASDAQ 100 ETF' },
  { symbol: 'DIA', name: 'Dow Jones ETF' },
  { symbol: 'IWM', name: 'Russell 2000 ETF' },
];

interface MarketQuote { symbol: string; name: string; price: number | null; change: number | null; changePercent: number | null; }

const GlobalMarketOverview = () => {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: requestError } = await supabase.functions.invoke('market-data', {
        body: { symbols: INDICES.map(index => index.symbol), type: 'stock' },
      });
      if (requestError) throw requestError;
      const next = INDICES.map(index => {
        const quote = data?.prices?.[index.symbol];
        const price = Number(quote?.price);
        return {
          ...index,
          price: Number.isFinite(price) && price > 0 ? price : null,
          change: Number.isFinite(Number(quote?.change)) ? Number(quote.change) : null,
          changePercent: Number.isFinite(Number(quote?.changePercent)) ? Number(quote.changePercent) : null,
        };
      });
      setQuotes(next);
      setLastUpdated(new Date());
    } catch (cause) {
      console.error('Could not refresh market overview quotes', cause);
      setQuotes([]);
      setError(true);
      toast.error('Market quotes could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6 text-primary" />Market Overview</h2>
          <p className="text-muted-foreground">Live index ETF quotes from your connected market data source.</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh quotes
        </Button>
      </header>

      {lastUpdated && <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Quote request completed {lastUpdated.toLocaleTimeString()}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(quotes.length ? quotes : INDICES.map(index => ({ ...index, price: null, change: null, changePercent: null }))).map(quote => (
          <Card key={quote.symbol}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{quote.name}</p>
              <p className="text-xs text-muted-foreground">{quote.symbol}</p>
              <p className="mt-3 text-2xl font-bold">{quote.price === null ? '—' : `$${quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
              {quote.changePercent === null ? <p className="mt-1 text-sm text-muted-foreground">Change unavailable</p> : (
                <p className={`mt-1 flex items-center gap-1 text-sm ${quote.changePercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {quote.changePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {quote.change !== null && `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} · `}{quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Broader market data</CardTitle><CardDescription>Sector performance, breadth, valuation multiples, and market news are not available from the current connected feed.</CardDescription></CardHeader>
        <CardContent><div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p>{loading ? 'Loading market quotes…' : error ? 'The quote request failed. Retry when your market data service is available.' : 'Only successfully returned quotes are shown. Broader market indicators will appear when a verified source is configured.'} Quotes may be delayed; check the provider for its timestamp and exchange coverage.</p></div></CardContent>
      </Card>
    </div>
  );
};

export default GlobalMarketOverview;
