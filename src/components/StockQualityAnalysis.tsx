import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Info, ShieldCheck } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const StockQualityAnalysis = () => {
  const symbols = [...new Set((usePortfolio().activePortfolio?.holdings || []).map(h => cleanSymbol(h.symbol)))];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />Stock Quality Analysis</CardTitle>
        <CardDescription>Quality factors need current fundamentals, historical financials, and a transparent scoring method.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {symbols.length ? symbols.slice(0, 24).map(symbol => <Badge key={symbol} variant="outline">{symbol}</Badge>) : <p className="text-sm text-muted-foreground">Add holdings to prepare this analysis.</p>}
          {symbols.length > 24 && <Badge variant="secondary">+{symbols.length - 24} more</Badge>}
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <Badge variant="outline">Fundamental scores unavailable</Badge>
            <p>Scores and buy/sell recommendations are hidden until verified financial data and a published methodology are connected. A ticker-based score is not evidence of business quality.</p>
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />When enabled, each factor should include its source, reporting period, calculation, and last-updated date.</p>
      </CardContent>
    </Card>
  );
};

export default StockQualityAnalysis;
