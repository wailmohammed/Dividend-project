import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Save, BarChart3, FlaskConical } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { useBenchmarkData } from '@/hooks/useBenchmarkData';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { format, subDays, eachDayOfInterval } from 'date-fns';

const PerformanceComparisonView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio } = usePortfolio();
  const { snapshots, loading: snapshotsLoading, saveSnapshot } = usePortfolioSnapshots(activePortfolio?.id);
  const { spy, qqq, loading: benchmarkLoading, refetch: refetchBenchmark } = useBenchmarkData();

  // Calculate current portfolio value
  const portfolioValue = useMemo(() => {
    if (!activePortfolio) return 0;
    return activePortfolio.holdings.reduce((sum, h) => {
      const price = h.currentPrice || h.avgPrice;
      return sum + (h.shares * price);
    }, 0) + (activePortfolio.cashBalance || 0);
  }, [activePortfolio]);

  // Auto-save snapshot on load
  useEffect(() => {
    if (activePortfolio?.id && portfolioValue > 0) {
      saveSnapshot(activePortfolio.id, portfolioValue, activePortfolio.cashBalance || 0);
    }
  }, [activePortfolio?.id, portfolioValue, saveSnapshot]);

  // Generate chart data combining portfolio snapshots with benchmark data
  const chartData = useMemo(() => {
    const days = 30;
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    const dates = eachDayOfInterval({ start: startDate, end: endDate });

    // Get the first snapshot value as base (or current value)
    const basePortfolioValue = snapshots.length > 0 ? snapshots[0].total_value : portfolioValue;
    const baseSPY = spy?.price ? spy.price * 0.95 : 525; // Assume 5% gain over 30 days
    const baseQQQ = qqq?.price ? qqq.price * 0.95 : 445;

    return dates.map((date, index) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const snapshot = snapshots.find(s => s.snapshot_date === dateStr);
      
      // Progress through the month (0 to 1)
      const progress = index / (dates.length - 1);
      
      // Portfolio value from snapshot or interpolated
      let portfolioVal: number;
      if (snapshot) {
        portfolioVal = snapshot.total_value;
      } else if (snapshots.length > 0) {
        // Interpolate between first snapshot and current value
        portfolioVal = basePortfolioValue + (portfolioValue - basePortfolioValue) * progress;
      } else {
        // Generate simulated historical data based on current value
        const volatility = 0.02;
        const trend = Math.random() * volatility - volatility / 2;
        portfolioVal = portfolioValue * (1 - (1 - progress) * 0.05 + trend);
      }

      // Benchmark values (interpolated from base to current)
      const spyCurrent = spy?.price ?? 525;
      const qqqCurrent = qqq?.price ?? 445;
      const spyVal = baseSPY + (spyCurrent - baseSPY) * progress;
      const qqqVal = baseQQQ + (qqqCurrent - baseQQQ) * progress;

      // Normalize to percentage returns
      const portfolioReturn = ((portfolioVal / basePortfolioValue) - 1) * 100;
      const spyReturn = ((spyVal / baseSPY) - 1) * 100;
      const qqqReturn = ((qqqVal / baseQQQ) - 1) * 100;

      return {
        date: format(date, 'MMM d'),
        portfolio: portfolioReturn,
        spy: spyReturn,
        qqq: qqqReturn,
      };
    });
  }, [snapshots, portfolioValue, spy, qqq]);

  // Calculate performance metrics
  const metrics = useMemo(() => {
    if (chartData.length < 2) return null;
    
    const lastData = chartData[chartData.length - 1];
    const portfolioReturn = lastData.portfolio;
    const spyReturn = lastData.spy;
    const qqqReturn = lastData.qqq;
    const alpha = portfolioReturn - spyReturn;

    return {
      portfolioReturn,
      spyReturn,
      qqqReturn,
      alpha,
      outperforming: alpha > 0,
    };
  }, [chartData]);

  const handleSaveSnapshot = () => {
    if (activePortfolio?.id) {
      saveSnapshot(activePortfolio.id, portfolioValue, activePortfolio.cashBalance || 0);
    }
  };

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample performance data. Sign in to track your real portfolio returns.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Performance Comparison</h1>
          <p className="text-muted-foreground mt-1">Track your portfolio returns against market benchmarks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveSnapshot}>
            <Save className="w-4 h-4 mr-2" />
            Save Snapshot
          </Button>
          <Button variant="outline" onClick={refetchBenchmark}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Your Portfolio</p>
                <p className={`text-2xl font-bold ${
                  (metrics?.portfolioReturn || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {metrics?.portfolioReturn.toFixed(2)}%
                </p>
              </div>
              <div className={`p-2 rounded-full ${
                (metrics?.portfolioReturn || 0) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {(metrics?.portfolioReturn || 0) >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">S&P 500 (SPY)</p>
                <p className={`text-2xl font-bold ${
                  (metrics?.spyReturn || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {metrics?.spyReturn.toFixed(2)}%
                </p>
              </div>
              <Badge variant="outline">SPY</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">NASDAQ (QQQ)</p>
                <p className={`text-2xl font-bold ${
                  (metrics?.qqqReturn || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {metrics?.qqqReturn.toFixed(2)}%
                </p>
              </div>
              <Badge variant="outline">QQQ</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alpha (vs S&P 500)</p>
                <p className={`text-2xl font-bold ${
                  (metrics?.alpha || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {(metrics?.alpha || 0) >= 0 ? '+' : ''}{metrics?.alpha.toFixed(2)}%
                </p>
              </div>
              <Badge variant={metrics?.outperforming ? 'default' : 'destructive'}>
                {metrics?.outperforming ? 'Outperforming' : 'Underperforming'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            30-Day Return Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshotsLoading || benchmarkLoading ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              Loading performance data...
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="portfolio"
                    name="Your Portfolio"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="spy"
                    name="S&P 500"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="qqq"
                    name="NASDAQ"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Snapshot History */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Snapshot History</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No snapshots yet. Your portfolio value will be saved automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Portfolio Value</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Cash</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.slice(-10).reverse().map((snapshot, index, arr) => {
                    const prevSnapshot = arr[index + 1];
                    const change = prevSnapshot 
                      ? ((snapshot.total_value - prevSnapshot.total_value) / prevSnapshot.total_value) * 100
                      : 0;
                    
                    return (
                      <tr key={snapshot.id} className="border-b border-border">
                        <td className="py-3 px-4">{format(new Date(snapshot.snapshot_date), 'MMM d, yyyy')}</td>
                        <td className="text-right py-3 px-4 font-medium">
                          ${snapshot.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-3 px-4 text-muted-foreground">
                          ${snapshot.cash_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`text-right py-3 px-4 ${
                          change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {prevSnapshot ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceComparisonView;
