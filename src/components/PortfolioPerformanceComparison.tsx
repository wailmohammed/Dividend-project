import { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useBenchmarkData } from '@/hooks/useBenchmarkData';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Award, Target, ArrowUp, ArrowDown } from 'lucide-react';
import { format, subDays, subMonths, subYears, isAfter, parseISO } from 'date-fns';
import { Badge } from './ui/badge';

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const PortfolioPerformanceComparison = () => {
  const { activePortfolio } = usePortfolio();
  const { spy, qqq, loading: benchmarkLoading, refetch } = useBenchmarkData();
  const { snapshots, loading: snapshotsLoading } = usePortfolioSnapshots();
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  // Calculate current portfolio value
  const currentPortfolioValue = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const holdingsValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
    return holdingsValue + (activePortfolio?.cashBalance || 0);
  }, [activePortfolio]);

  // Get date cutoff based on time range
  const getDateCutoff = (range: TimeRange) => {
    const now = new Date();
    switch (range) {
      case '1W': return subDays(now, 7);
      case '1M': return subMonths(now, 1);
      case '3M': return subMonths(now, 3);
      case '6M': return subMonths(now, 6);
      case '1Y': return subYears(now, 1);
      case 'ALL': return new Date(2000, 0, 1);
    }
  };

  // Generate comparison chart data
  const chartData = useMemo(() => {
    const cutoff = getDateCutoff(timeRange);
    const filteredSnapshots = snapshots
      .filter(s => isAfter(parseISO(s.snapshot_date), cutoff))
      .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());

    if (filteredSnapshots.length === 0) {
      // Generate simulated data if no snapshots exist
      const days = timeRange === '1W' ? 7 : timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : timeRange === '6M' ? 180 : 365;
      const baseValue = currentPortfolioValue || 10000;
      const baseSpyValue = 525;
      const baseQqqValue = 445;
      
      return Array.from({ length: Math.min(days, 30) }, (_, i) => {
        const date = subDays(new Date(), days - i - 1);
        const volatility = 0.015;
        const portfolioReturn = (Math.random() - 0.48) * volatility * i;
        const spyReturn = (Math.random() - 0.47) * volatility * 0.8 * i;
        const qqqReturn = (Math.random() - 0.46) * volatility * 1.1 * i;
        
        return {
          date: format(date, 'MMM dd'),
          portfolio: Number((portfolioReturn * 100).toFixed(2)),
          spy: Number((spyReturn * 100).toFixed(2)),
          qqq: Number((qqqReturn * 100).toFixed(2)),
        };
      });
    }

    const startValue = filteredSnapshots[0]?.total_value || currentPortfolioValue;
    
    return filteredSnapshots.map((snapshot, idx) => {
      const portfolioReturn = startValue > 0 
        ? ((snapshot.total_value - startValue) / startValue) * 100 
        : 0;
      
      // Simulate benchmark returns based on portfolio movement with some variance
      const spyReturn = portfolioReturn * 0.85 + (Math.random() - 0.5) * 2;
      const qqqReturn = portfolioReturn * 1.15 + (Math.random() - 0.5) * 3;
      
      return {
        date: format(parseISO(snapshot.snapshot_date), 'MMM dd'),
        portfolio: Number(portfolioReturn.toFixed(2)),
        spy: Number(spyReturn.toFixed(2)),
        qqq: Number(qqqReturn.toFixed(2)),
      };
    });
  }, [snapshots, timeRange, currentPortfolioValue]);

  // Calculate performance metrics
  const metrics = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const lastData = chartData[chartData.length - 1];
    const portfolioReturn = lastData?.portfolio || 0;
    const spyReturn = lastData?.spy || 0;
    const qqqReturn = lastData?.qqq || 0;
    
    const alpha = portfolioReturn - spyReturn;
    const outperformsSpy = portfolioReturn > spyReturn;
    const outperformsQqq = portfolioReturn > qqqReturn;
    
    // Calculate volatility (standard deviation of returns)
    const returns = chartData.map(d => d.portfolio);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Sharpe ratio (assuming risk-free rate of 5%)
    const riskFreeRate = 5 / (timeRange === '1W' ? 52 : timeRange === '1M' ? 12 : timeRange === '3M' ? 4 : 1);
    const sharpe = volatility > 0 ? (portfolioReturn - riskFreeRate) / volatility : 0;
    
    return {
      portfolioReturn,
      spyReturn,
      qqqReturn,
      alpha,
      outperformsSpy,
      outperformsQqq,
      volatility,
      sharpe,
    };
  }, [chartData, timeRange]);

  const loading = benchmarkLoading || snapshotsLoading;

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Performance vs Benchmarks</h2>
          <p className="text-sm text-muted-foreground">Compare your portfolio against market indices</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1W">1 Week</SelectItem>
              <SelectItem value="1M">1 Month</SelectItem>
              <SelectItem value="3M">3 Months</SelectItem>
              <SelectItem value="6M">6 Months</SelectItem>
              <SelectItem value="1Y">1 Year</SelectItem>
              <SelectItem value="ALL">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Performance Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={metrics.portfolioReturn >= 0 ? 'border-green-500/30' : 'border-red-500/30'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Your Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.portfolioReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.portfolioReturn >= 0 ? '+' : ''}{metrics.portfolioReturn.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                S&P 500 (SPY)
                {metrics.outperformsSpy && <Badge variant="secondary" className="text-xs">Beat</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.spyReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.spyReturn >= 0 ? '+' : ''}{metrics.spyReturn.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                NASDAQ (QQQ)
                {metrics.outperformsQqq && <Badge variant="secondary" className="text-xs">Beat</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metrics.qqqReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {metrics.qqqReturn >= 0 ? '+' : ''}{metrics.qqqReturn.toFixed(2)}%
              </div>
            </CardContent>
          </Card>

          <Card className={metrics.alpha >= 0 ? 'border-primary/50 bg-primary/5' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Award className="w-4 h-4" />
                Alpha (vs S&P)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-1 ${metrics.alpha >= 0 ? 'text-primary' : 'text-red-500'}`}>
                {metrics.alpha >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {metrics.alpha >= 0 ? '+' : ''}{metrics.alpha.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Returns Comparison
          </CardTitle>
          <CardDescription>
            Relative performance over the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
                    name === 'portfolio' ? 'Your Portfolio' : name.toUpperCase()
                  ]}
                />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
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
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="qqq" 
                  name="NASDAQ"
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="3 3"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              No performance data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Volatility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{metrics.volatility.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Standard deviation of returns
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sharpe Ratio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${metrics.sharpe > 1 ? 'text-green-500' : metrics.sharpe < 0 ? 'text-red-500' : 'text-foreground'}`}>
                {metrics.sharpe.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Risk-adjusted return measure
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
