import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, Info } from 'lucide-react';
import { cleanSymbol } from '@/lib/utils';

export const DividendCaptureStrategy = () => {
  const holdings = usePortfolio().activePortfolio?.holdings || [];
  const payers = useMemo(() => holdings.filter(h => Number(h.dividendYield) > 0), [holdings]);
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6 text-primary" />Dividend Calendar & Capture</h2>
        <p className="text-muted-foreground">Track verified ex-dividend and payment dates for portfolio holdings.</p>
      </header>
      <Card>
        <CardHeader><CardTitle>Upcoming dates unavailable</CardTitle><CardDescription>A dividend yield does not establish the next ex-date, payment date, or expected payment amount.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">{payers.length ? payers.map(h => <Badge key={h.symbol} variant="outline">{cleanSymbol(h.symbol)} · {Number(h.dividendYield).toFixed(2)}% yield on file</Badge>) : <p className="text-sm text-muted-foreground">No dividend-paying holdings with a yield on file.</p>}</div>
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p>No capture dates, expected payments, recovery periods, or risk ratings are estimated from ticker symbols. Connect a verified dividend calendar for declared amounts and dates. Buying solely to capture a dividend carries price and tax risks.</p></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DividendCaptureStrategy;
