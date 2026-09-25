import React, { useMemo } from 'react';
import { Activity, BarChart3, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useBenchmarkData } from '@/hooks/useBenchmarkData';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Skeleton } from './ui/skeleton';

const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export const PortfolioBenchmark: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { spy, qqq, loading, error, refetch } = useBenchmarkData();

  const costBasisSnapshot = useMemo(() => {
    const holdings = activePortfolio?.holdings ?? [];
    return holdings.reduce((totals, holding) => {
      const shares = Number(holding.shares) || 0;
      const currentPrice = Number(holding.currentPrice) || 0;
      const averagePrice = Number(holding.avgPrice) || 0;
      totals.marketValue += shares * currentPrice;
      totals.costBasis += shares * averagePrice;
      return totals;
    }, { marketValue: 0, costBasis: 0 });
  }, [activePortfolio?.holdings]);

  const unrealizedGain = costBasisSnapshot.marketValue - costBasisSnapshot.costBasis;
  const costBasisReturn = costBasisSnapshot.costBasis > 0
    ? (unrealizedGain / costBasisSnapshot.costBasis) * 100
    : null;

  const renderBenchmark = (name: string, symbol: string, data: typeof spy, accent: string) => (
    <Card className={`border-l-4 ${accent}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{name} <span className="font-mono">({symbol})</span></p>
            {loading && !data ? <Skeleton className="mt-2 h-8 w-28" /> : data ? (
              <>
                <p className={`mt-1 text-2xl font-bold ${data.changePercent >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {formatPercent(data.changePercent)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Today · ${data.price.toFixed(2)}</p>
              </>
            ) : <p className="mt-2 text-sm text-muted-foreground">Market data unavailable</p>}
          </div>
          {data && (data.changePercent >= 0
            ? <TrendingUp aria-hidden="true" className="h-5 w-5 text-emerald-500" />
            : <TrendingDown aria-hidden="true" className="h-5 w-5 text-destructive" />)}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <section className="space-y-6" aria-labelledby="performance-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="performance-title" className="flex items-center gap-2 text-xl font-bold text-foreground">
            <BarChart3 aria-hidden="true" className="h-5 w-5 text-primary" />
            Performance &amp; benchmarks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Your current cost-basis snapshot alongside today’s broad-market moves.</p>
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={loading} className="min-h-11 self-start sm:self-auto">
          <RefreshCw aria-hidden="true" className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh benchmarks'}
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <Activity aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>Benchmark prices could not be refreshed. Your portfolio snapshot is still available.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Portfolio · since cost basis</p>
            {costBasisReturn === null ? (
              <p className="mt-2 text-sm text-muted-foreground">Add average purchase prices to calculate.</p>
            ) : (
              <>
                <p className={`mt-1 text-2xl font-bold ${unrealizedGain >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {formatPercent(costBasisReturn)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unrealizedGain >= 0 ? '+' : '−'}${Math.abs(unrealizedGain).toLocaleString(undefined, { maximumFractionDigits: 2 })} unrealized
                </p>
              </>
            )}
          </CardContent>
        </Card>
        {renderBenchmark('S&P 500 ETF', 'SPY', spy, 'border-l-emerald-500')}
        {renderBenchmark('NASDAQ 100 ETF', 'QQQ', qqq, 'border-l-amber-500')}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Build a reliable performance history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            A fair comparison over time needs dated deposits, withdrawals, trades, and historical prices. This portfolio snapshot shows unrealized return against recorded average purchase prices; the ETF figures above show today’s market change. They cover different periods, so they are not ranked against each other.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Once daily portfolio values are stored, this page can show comparable return curves and calculate risk statistics from real observations.
          </p>
        </CardContent>
      </Card>
    </section>
  );
};

export default PortfolioBenchmark;
