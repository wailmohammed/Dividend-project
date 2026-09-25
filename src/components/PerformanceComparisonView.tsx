import React, { useMemo } from 'react';
import { BarChart3, Camera } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import PortfolioBenchmark from './PortfolioBenchmark';
import PortfolioPerformanceChart from './PortfolioPerformanceChart';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const PerformanceComparisonView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio } = usePortfolio();
  const { snapshots, loading, saveSnapshot } = usePortfolioSnapshots(activePortfolio?.id);

  const portfolioValue = useMemo(() => {
    const currentHoldingsValue = (activePortfolio?.holdings || []).reduce(
      (sum, holding) => sum + Number(holding.shares || 0) * Number(holding.currentPrice || 0), 0,
    );
    return currentHoldingsValue + Number(activePortfolio?.cashBalance || 0);
  }, [activePortfolio?.holdings, activePortfolio?.cashBalance]);

  const recordSnapshot = async () => {
    if (activePortfolio?.id && portfolioValue > 0) {
      await saveSnapshot(activePortfolio.id, portfolioValue, Number(activePortfolio.cashBalance || 0));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <BarChart3 aria-hidden="true" className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Demo portfolio data is illustrative. Historical performance appears only when dated snapshots are recorded.
          </AlertDescription>
        </Alert>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance</h1>
          <p className="mt-1 text-muted-foreground">Recorded portfolio value and separate current benchmark quotes.</p>
        </div>
        <Button onClick={() => void recordSnapshot()} disabled={isDemoMode || loading || portfolioValue <= 0} className="min-h-11 self-start sm:self-auto">
          <Camera aria-hidden="true" className="mr-2 h-4 w-4" />
          Record today’s value
        </Button>
      </header>

      <PortfolioPerformanceChart totalValue={portfolioValue} />
      <PortfolioBenchmark />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved portfolio snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground" role="status">Loading snapshots…</p>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved snapshots yet. Record today’s value to start building a history.</p>
          ) : (
            <ul className="divide-y divide-border">
              {[...snapshots].reverse().slice(0, 8).map((snapshot) => (
                <li key={snapshot.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <time dateTime={snapshot.snapshot_date} className="text-muted-foreground">
                    {new Date(`${snapshot.snapshot_date}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </time>
                  <span className="font-medium tabular-nums text-foreground">
                    ${Number(snapshot.total_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {snapshots.length > 8 && <p className="mt-2 text-xs text-muted-foreground">Showing 8 of {snapshots.length} recorded days.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceComparisonView;
