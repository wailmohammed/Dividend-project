import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { TrendingUp, TrendingDown, Activity, BarChart3, Target, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';

interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  treynorRatio: number;
  calmarRatio: number;
  varDaily: number; // Value at Risk
}

export const RiskMetricsPanel: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { snapshots } = usePortfolioSnapshots(activePortfolio?.id);

  // Calculate risk metrics from portfolio snapshots
  const metrics = useMemo((): RiskMetrics => {
    if (!snapshots || snapshots.length < 2) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        beta: 1,
        alpha: 0,
        informationRatio: 0,
        treynorRatio: 0,
        calmarRatio: 0,
        varDaily: 0,
      };
    }

    // Sort snapshots by date
    const sorted = [...snapshots].sort((a, b) => 
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevValue = Number(sorted[i - 1].total_value);
      const currValue = Number(sorted[i].total_value);
      if (prevValue > 0) {
        returns.push((currValue - prevValue) / prevValue);
      }
    }

    if (returns.length === 0) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        beta: 1,
        alpha: 0,
        informationRatio: 0,
        treynorRatio: 0,
        calmarRatio: 0,
        varDaily: 0,
      };
    }

    // Calculate mean return
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    // Annualize mean return (assuming daily data)
    const annualizedReturn = meanReturn * 252;

    // Calculate standard deviation (volatility)
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const annualizedVolatility = stdDev * Math.sqrt(252);

    // Risk-free rate assumption (annualized)
    const riskFreeRate = 0.05; // 5% annual
    const dailyRiskFreeRate = riskFreeRate / 252;

    // Sharpe Ratio
    const sharpeRatio = annualizedVolatility > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
      : 0;

    // Sortino Ratio (only considers downside deviation)
    const downsideReturns = returns.filter(r => r < dailyRiskFreeRate);
    const downsideVariance = downsideReturns.length > 0 
      ? downsideReturns.reduce((sum, r) => sum + Math.pow(r - dailyRiskFreeRate, 2), 0) / downsideReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    const sortinoRatio = downsideDeviation > 0 
      ? (annualizedReturn - riskFreeRate) / downsideDeviation 
      : 0;

    // Maximum Drawdown
    let maxDrawdown = 0;
    let peak = sorted[0].total_value;
    for (const snapshot of sorted) {
      const value = Number(snapshot.total_value);
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Value at Risk (95% confidence, daily)
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor(returns.length * 0.05);
    const varDaily = sortedReturns[varIndex] ? Math.abs(sortedReturns[varIndex]) : 0;

    // Beta (assume market return of 10% annually with 15% volatility)
    const marketReturn = 0.10 / 252;
    const marketVolatility = 0.15 / Math.sqrt(252);
    const covariance = returns.reduce((sum, r) => sum + (r - meanReturn) * (marketReturn - marketReturn), 0) / returns.length;
    const beta = marketVolatility > 0 ? covariance / (marketVolatility * marketVolatility) + 1 : 1;

    // Alpha
    const alpha = annualizedReturn - (riskFreeRate + beta * (0.10 - riskFreeRate));

    // Treynor Ratio
    const treynorRatio = beta !== 0 ? (annualizedReturn - riskFreeRate) / beta : 0;

    // Calmar Ratio
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Information Ratio (using benchmark return of 10%)
    const benchmarkReturn = 0.10;
    const trackingError = annualizedVolatility * 0.5; // Simplified
    const informationRatio = trackingError > 0 
      ? (annualizedReturn - benchmarkReturn) / trackingError 
      : 0;

    return {
      sharpeRatio: isFinite(sharpeRatio) ? sharpeRatio : 0,
      sortinoRatio: isFinite(sortinoRatio) ? sortinoRatio : 0,
      maxDrawdown: isFinite(maxDrawdown) ? maxDrawdown * 100 : 0,
      volatility: isFinite(annualizedVolatility) ? annualizedVolatility * 100 : 0,
      beta: isFinite(beta) ? beta : 1,
      alpha: isFinite(alpha) ? alpha * 100 : 0,
      informationRatio: isFinite(informationRatio) ? informationRatio : 0,
      treynorRatio: isFinite(treynorRatio) ? treynorRatio : 0,
      calmarRatio: isFinite(calmarRatio) ? calmarRatio : 0,
      varDaily: isFinite(varDaily) ? varDaily * 100 : 0,
    };
  }, [snapshots]);

  // Generate drawdown chart data
  const drawdownData = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return [];
    
    const sorted = [...snapshots]
      .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
      .slice(-90); // Last 90 days

    let peak = Number(sorted[0]?.total_value) || 0;
    
    return sorted.map(s => {
      const value = Number(s.total_value);
      if (value > peak) peak = value;
      const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0;
      
      return {
        date: format(parseISO(s.snapshot_date), 'MMM dd'),
        value,
        drawdown: -drawdown, // Negative for visual effect
      };
    });
  }, [snapshots]);

  const getMetricColor = (value: number, type: 'ratio' | 'percent' | 'beta') => {
    if (type === 'ratio') {
      if (value >= 1.5) return 'text-green-500';
      if (value >= 1) return 'text-emerald-500';
      if (value >= 0.5) return 'text-yellow-500';
      return 'text-red-500';
    }
    if (type === 'beta') {
      if (value >= 0.8 && value <= 1.2) return 'text-green-500';
      if (value >= 0.5 && value <= 1.5) return 'text-yellow-500';
      return 'text-red-500';
    }
    // percent (for drawdown, volatility)
    if (value <= 10) return 'text-green-500';
    if (value <= 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskLevel = (): { level: string; color: string } => {
    const riskScore = (
      (metrics.volatility / 30) + 
      (metrics.maxDrawdown / 30) + 
      (Math.abs(metrics.beta - 1) * 2)
    ) / 3;

    if (riskScore < 0.3) return { level: 'Low', color: 'text-green-500' };
    if (riskScore < 0.6) return { level: 'Moderate', color: 'text-yellow-500' };
    if (riskScore < 0.8) return { level: 'High', color: 'text-orange-500' };
    return { level: 'Very High', color: 'text-red-500' };
  };

  const riskLevel = getRiskLevel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Risk Metrics
        </h2>
        <p className="text-sm text-muted-foreground">
          Advanced portfolio risk analysis and performance ratios
        </p>
      </div>

      {/* Overall Risk Level */}
      <Card className="border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Risk Level</p>
              <p className={`text-3xl font-bold ${riskLevel.color}`}>{riskLevel.level}</p>
            </div>
            <Shield className={`w-12 h-12 ${riskLevel.color}`} />
          </div>
        </CardContent>
      </Card>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Target className="w-4 h-4" />
              Sharpe Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(metrics.sharpeRatio, 'ratio')}`}>
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Risk-adjusted return</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              Sortino Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(metrics.sortinoRatio, 'ratio')}`}>
              {metrics.sortinoRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Downside risk-adjusted</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              Max Drawdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(metrics.maxDrawdown, 'percent')}`}>
              -{metrics.maxDrawdown.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Largest peak-to-trough</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Volatility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(metrics.volatility, 'percent')}`}>
              {metrics.volatility.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Annualized std dev</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Beta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${getMetricColor(metrics.beta, 'beta')}`}>
              {metrics.beta.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Alpha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${metrics.alpha >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {metrics.alpha >= 0 ? '+' : ''}{metrics.alpha.toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Treynor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${getMetricColor(metrics.treynorRatio, 'ratio')}`}>
              {metrics.treynorRatio.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Calmar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${getMetricColor(metrics.calmarRatio, 'ratio')}`}>
              {metrics.calmarRatio.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Daily VaR (95%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-500">
              -{metrics.varDaily.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drawdown Chart */}
      {drawdownData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Drawdown Analysis
            </CardTitle>
            <CardDescription>Portfolio value and drawdown over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownData}>
                  <defs>
                    <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(val) => `${val}%`} 
                    tick={{ fontSize: 11 }}
                    domain={['dataMin - 5', 0]}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'drawdown' ? `${value.toFixed(2)}%` : `$${value.toLocaleString()}`,
                      name === 'drawdown' ? 'Drawdown' : 'Value'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="drawdown" 
                    stroke="#ef4444"
                    fill="url(#drawdownGradient)"
                    strokeWidth={2}
                    name="Drawdown %"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="value" 
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    name="Portfolio Value"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Explanation */}
      <Card className="border-muted">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Sharpe Ratio</p>
              <p>Measures excess return per unit of total risk. Higher is better. Above 1.0 is good, above 2.0 is excellent.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Sortino Ratio</p>
              <p>Similar to Sharpe but only penalizes downside volatility. Better for asymmetric return distributions.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Max Drawdown</p>
              <p>The largest peak-to-trough decline. Shows worst-case historical loss scenario.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Value at Risk (VaR)</p>
              <p>Estimates the maximum daily loss with 95% confidence. A 5% VaR means 95% of days will have smaller losses.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RiskMetricsPanel;
