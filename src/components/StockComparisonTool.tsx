import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { GitCompare, Info, RefreshCw, X } from 'lucide-react';
import { fetchMarketPrices, PriceData } from '@/services/marketDataService';

interface SelectedStock { symbol: string; name: string }

const COLORS = ['hsl(var(--primary))', 'hsl(210, 80%, 55%)', 'hsl(160, 70%, 45%)', 'hsl(45, 90%, 55%)'];

const StockComparisonTool: React.FC = () => {
  const [stocks, setStocks] = useState<SelectedStock[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const symbols = useMemo(() => stocks.map(stock => stock.symbol), [stocks]);

  const loadPrices = async () => {
    if (!symbols.length) { setPrices({}); return; }
    setLoading(true);
    setError('');
    try {
      const data = await fetchMarketPrices(symbols, 'mixed');
      setPrices(data);
      if (!Object.keys(data).length) setError('No verified quotes are available from the configured market-data providers.');
    } catch {
      setPrices({});
      setError('Could not load quotes. Try again when your market-data provider is available.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPrices(); }, [symbols.join('|')]);

  const addStock = (symbol: string, name: string) => {
    const normalized = symbol.toUpperCase();
    if (stocks.length >= 4 || stocks.some(stock => stock.symbol === normalized)) return;
    setStocks(current => [...current, { symbol: normalized, name }]);
  };

  const removeStock = (symbol: string) => setStocks(current => current.filter(stock => stock.symbol !== symbol));

  const rows = [
    { label: 'Latest price', value: (quote: PriceData) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(quote.price) },
    { label: 'Daily change', value: (quote: PriceData) => `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}` },
    { label: 'Daily change %', value: (quote: PriceData) => `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` },
    { label: 'Provider', value: (quote: PriceData) => quote.source.replaceAll('_', ' ') },
    { label: 'Updated', value: (quote: PriceData) => quote.lastUpdated ? new Date(quote.lastUpdated).toLocaleString() : '—' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><GitCompare className="h-5 w-5 text-primary" />Stock Comparison</CardTitle>
              <CardDescription className="mt-2">Compare dated quotes from your connected data providers. Add up to four symbols.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadPrices()} disabled={loading || !stocks.length}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh quotes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {stocks.map((stock, index) => (
              <Badge key={stock.symbol} className="gap-2 px-3 py-1.5 text-sm" style={{ borderColor: COLORS[index], color: COLORS[index] }} variant="outline">
                {stock.symbol}<button aria-label={`Remove ${stock.symbol}`} onClick={() => removeStock(stock.symbol)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {stocks.length < 4 && <div className="w-64"><StockSearchAutocomplete onSelect={addStock} placeholder="Add stock to compare..." /></div>}
          </div>

          {error && <div role="status" className="mb-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{error}</div>}
          {!stocks.length ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="font-medium">Choose stocks to compare</p>
              <p className="mt-1 text-sm text-muted-foreground">Price and day-change rows appear when a configured provider returns a quote. Financial ratios, dividend history, and safety scores require a separate sourced fundamentals feed.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> Quotes can be delayed or end-of-day depending on provider. Only returned fields are shown; this comparison does not infer company fundamentals.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-border"><th className="py-3 px-2 text-left font-medium text-muted-foreground">Quote</th>
                    {stocks.map((stock, index) => <th key={stock.symbol} className="py-3 px-2 text-right font-bold" style={{ color: COLORS[index] }}><span>{stock.symbol}</span><span className="block text-xs font-normal text-muted-foreground">{stock.name}</span></th>)}
                  </tr></thead>
                  <tbody>{rows.map(row => <tr key={row.label} className="border-b border-border/50"><td className="py-3 px-2 text-muted-foreground">{row.label}</td>
                    {stocks.map(stock => { const quote = prices[stock.symbol]; return <td key={stock.symbol} className="py-3 px-2 text-right font-medium">{quote ? row.value(quote) : loading ? 'Loading…' : 'Unavailable'}</td>; })}
                  </tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockComparisonTool;
