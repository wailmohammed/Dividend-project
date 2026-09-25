import { CalendarDays, Clock3, TrendingUp } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export const EarningsCalendar = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = [...(activePortfolio?.holdings || [])]
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <CalendarDays aria-hidden="true" className="h-6 w-6 text-primary" />
          Earnings calendar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Upcoming reporting dates for companies in your portfolio.</p>
      </header>

      <Alert>
        <Clock3 aria-hidden="true" className="h-4 w-4" />
        <AlertDescription>
          Verified earnings dates and analyst estimates are not available from the connected market-data feed yet. This page will show events when that source is connected; estimated dates and financial results are not invented.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings covered</CardTitle>
          <CardDescription>{holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'} in {activePortfolio?.name || 'your portfolio'}</CardDescription>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 text-center">
              <TrendingUp aria-hidden="true" className="mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="font-medium text-foreground">Add holdings to build your earnings watchlist</p>
              <p className="mt-1 text-sm text-muted-foreground">Your portfolio companies will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {holdings.map((holding) => (
                <li key={holding.id} className="flex min-h-14 items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{holding.symbol}</p>
                    <p className="truncate text-sm text-muted-foreground">{holding.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Schedule unavailable</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Earnings schedules change and can be revised by issuers. When connected, dates and estimate sources will be shown with their last update.
      </p>
    </div>
  );
};

export default EarningsCalendar;
