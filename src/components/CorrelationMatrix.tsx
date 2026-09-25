import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { GitBranch, Info, BarChart2 } from 'lucide-react';

/** Correlation requires date-aligned historical price series for each holding.
 * The portfolio currently stores position and quote data, not those time series.
 * Keep this view explicit until a verified history provider is connected.
 */
export const CorrelationMatrix = () => {
  const holdings = usePortfolio().activePortfolio?.holdings || [];
  const symbols = [...new Set(holdings.map(h => h.symbol?.replace('.US', '').toUpperCase()).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-primary" />
          Portfolio Correlation
        </h2>
        <p className="text-muted-foreground">Compare how holdings move together using aligned historical prices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary" />Historical price data needed</CardTitle>
          <CardDescription>
            Correlation values require verified daily price history over the same dates for every holding. That history is not connected here yet, so no matrix or diversification score is shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" aria-label="Holdings included when price history is connected">
            {symbols.length ? symbols.slice(0, 30).map(symbol => <Badge key={symbol} variant="outline">{symbol}</Badge>) : <p className="text-sm text-muted-foreground">Add holdings to prepare this analysis.</p>}
            {symbols.length > 30 && <Badge variant="secondary">+{symbols.length - 30} more</Badge>}
          </div>
          <div className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Sector membership alone cannot establish correlation. Once dated price history is available, this page can calculate pairwise returns over a shared period and show the date range and data coverage.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CorrelationMatrix;
