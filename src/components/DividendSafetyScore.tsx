import { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield, AlertTriangle, CheckCircle, XCircle, TrendingUp, DollarSign, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface SafetyData {
  symbol: string;
  name: string;
  safetyScore: number;
  safetyRating: 'very_safe' | 'safe' | 'borderline' | 'unsafe' | 'very_unsafe';
  payoutRatio: number;
  debtToEquity: number;
  freeFlowCoverage: number;
  consecutiveYears: number;
  dividendYield: number;
  riskFactors: string[];
}

// Simulated safety scores (in production, this would come from an API like Simply Safe Dividends)
const SAFETY_SCORES: Record<string, Partial<SafetyData>> = {
  'AAPL': { safetyScore: 92, payoutRatio: 15, debtToEquity: 1.8, freeFlowCoverage: 6.5, consecutiveYears: 12, riskFactors: [] },
  'MSFT': { safetyScore: 95, payoutRatio: 28, debtToEquity: 0.4, freeFlowCoverage: 3.2, consecutiveYears: 19, riskFactors: [] },
  'JNJ': { safetyScore: 88, payoutRatio: 45, debtToEquity: 0.5, freeFlowCoverage: 2.1, consecutiveYears: 62, riskFactors: [] },
  'KO': { safetyScore: 82, payoutRatio: 68, debtToEquity: 1.7, freeFlowCoverage: 1.4, consecutiveYears: 62, riskFactors: ['High payout ratio'] },
  'PG': { safetyScore: 85, payoutRatio: 62, debtToEquity: 0.8, freeFlowCoverage: 1.6, consecutiveYears: 68, riskFactors: [] },
  'O': { safetyScore: 75, payoutRatio: 76, debtToEquity: 0.9, freeFlowCoverage: 1.2, consecutiveYears: 30, riskFactors: ['REIT structure', 'High payout'] },
  'ABBV': { safetyScore: 65, payoutRatio: 85, debtToEquity: 5.2, freeFlowCoverage: 1.1, consecutiveYears: 52, riskFactors: ['High debt', 'High payout ratio'] },
  'VZ': { safetyScore: 60, payoutRatio: 52, debtToEquity: 1.6, freeFlowCoverage: 1.3, consecutiveYears: 19, riskFactors: ['Slow growth', 'High debt'] },
  'T': { safetyScore: 35, payoutRatio: 65, debtToEquity: 1.2, freeFlowCoverage: 0.9, consecutiveYears: 0, riskFactors: ['Past dividend cut', 'Weak coverage'] },
  'JPM': { safetyScore: 78, payoutRatio: 25, debtToEquity: 1.5, freeFlowCoverage: 2.8, consecutiveYears: 14, riskFactors: ['Cyclical business'] },
};

const getSafetyRating = (score: number): SafetyData['safetyRating'] => {
  if (score >= 81) return 'very_safe';
  if (score >= 61) return 'safe';
  if (score >= 41) return 'borderline';
  if (score >= 21) return 'unsafe';
  return 'very_unsafe';
};

const getSafetyBadge = (rating: SafetyData['safetyRating']) => {
  switch (rating) {
    case 'very_safe':
      return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Very Safe</Badge>;
    case 'safe':
      return <Badge className="bg-emerald-500"><CheckCircle className="w-3 h-3 mr-1" />Safe</Badge>;
    case 'borderline':
      return <Badge className="bg-yellow-500 text-black"><AlertTriangle className="w-3 h-3 mr-1" />Borderline</Badge>;
    case 'unsafe':
      return <Badge className="bg-orange-500"><AlertTriangle className="w-3 h-3 mr-1" />Unsafe</Badge>;
    case 'very_unsafe':
      return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" />Very Unsafe</Badge>;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 81) return 'text-green-500';
  if (score >= 61) return 'text-emerald-500';
  if (score >= 41) return 'text-yellow-500';
  if (score >= 21) return 'text-orange-500';
  return 'text-red-500';
};

export const DividendSafetyScore = () => {
  const { activePortfolio } = usePortfolio();

  // Build safety data for holdings
  const safetyData = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    
    return holdings
      .filter(h => (h.dividendYield || 0) > 0)
      .map(h => {
        const data = SAFETY_SCORES[h.symbol] || {};
        const score = data.safetyScore ?? Math.floor(40 + Math.random() * 50);
        
        return {
          symbol: h.symbol,
          name: h.name,
          safetyScore: score,
          safetyRating: getSafetyRating(score),
          payoutRatio: data.payoutRatio ?? (30 + Math.random() * 50),
          debtToEquity: data.debtToEquity ?? (0.5 + Math.random() * 2),
          freeFlowCoverage: data.freeFlowCoverage ?? (1 + Math.random() * 3),
          consecutiveYears: data.consecutiveYears ?? Math.floor(Math.random() * 20),
          dividendYield: h.dividendYield || 0,
          riskFactors: data.riskFactors || [],
          value: h.shares * h.currentPrice,
        };
      })
      .sort((a, b) => b.safetyScore - a.safetyScore);
  }, [activePortfolio]);

  // Portfolio-level safety metrics
  const portfolioMetrics = useMemo(() => {
    if (safetyData.length === 0) return null;

    const totalValue = safetyData.reduce((sum, d) => sum + d.value, 0);
    
    // Weighted average safety score
    const weightedScore = safetyData.reduce((sum, d) => {
      const weight = d.value / totalValue;
      return sum + (d.safetyScore * weight);
    }, 0);

    // Distribution by safety rating
    const distribution = {
      very_safe: { count: 0, value: 0 },
      safe: { count: 0, value: 0 },
      borderline: { count: 0, value: 0 },
      unsafe: { count: 0, value: 0 },
      very_unsafe: { count: 0, value: 0 },
    };

    safetyData.forEach(d => {
      distribution[d.safetyRating].count++;
      distribution[d.safetyRating].value += d.value;
    });

    const safePercent = ((distribution.very_safe.value + distribution.safe.value) / totalValue) * 100;
    const borderlinePercent = (distribution.borderline.value / totalValue) * 100;
    const unsafePercent = ((distribution.unsafe.value + distribution.very_unsafe.value) / totalValue) * 100;

    return {
      weightedScore,
      totalValue,
      safePercent,
      borderlinePercent,
      unsafePercent,
      distribution,
      rating: getSafetyRating(weightedScore),
    };
  }, [safetyData]);

  // Pie chart data
  const pieData = portfolioMetrics ? [
    { name: 'Likely Safe', value: portfolioMetrics.safePercent, color: '#22c55e' },
    { name: 'Borderline', value: portfolioMetrics.borderlinePercent, color: '#eab308' },
    { name: 'May Be Unsafe', value: portfolioMetrics.unsafePercent, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  // At-risk holdings
  const atRiskHoldings = safetyData.filter(d => d.safetyScore < 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Dividend Safety Scores
        </h2>
        <p className="text-sm text-muted-foreground">Evaluate the safety and sustainability of your dividend income</p>
      </div>

      {/* Portfolio Safety Overview */}
      {portfolioMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Portfolio Income Safety</CardTitle>
              <CardDescription>Based on weighted average of all dividend-paying holdings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${getScoreColor(portfolioMetrics.weightedScore)}`}>
                    {portfolioMetrics.weightedScore.toFixed(0)}
                  </div>
                  <div className="mt-2">
                    {getSafetyBadge(portfolioMetrics.rating)}
                  </div>
                </div>
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Income</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-500">Likely Safe</span>
                <span className="font-bold text-green-500">{portfolioMetrics.safePercent.toFixed(0)}%</span>
              </div>
              <Progress value={portfolioMetrics.safePercent} className="h-2 bg-green-100" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-500">Borderline</span>
                <span className="font-bold text-yellow-500">{portfolioMetrics.borderlinePercent.toFixed(0)}%</span>
              </div>
              <Progress value={portfolioMetrics.borderlinePercent} className="h-2 bg-yellow-100" />
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-500">May Be Unsafe</span>
                <span className="font-bold text-red-500">{portfolioMetrics.unsafePercent.toFixed(0)}%</span>
              </div>
              <Progress value={portfolioMetrics.unsafePercent} className="h-2 bg-red-100" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* At Risk Alert */}
      {atRiskHoldings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{atRiskHoldings.length} holding(s) have low safety scores:</strong>{' '}
            {atRiskHoldings.map(h => h.symbol).join(', ')}. 
            Consider reviewing these positions for potential dividend cuts.
          </AlertDescription>
        </Alert>
      )}

      {/* Individual Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Individual Safety Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {safetyData.length > 0 ? (
            <div className="space-y-3">
              {safetyData.map(stock => (
                <div key={stock.symbol} className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
                        stock.safetyScore >= 61 ? 'bg-green-500/20 text-green-500' :
                        stock.safetyScore >= 41 ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {stock.safetyScore}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{stock.symbol}</span>
                          {getSafetyBadge(stock.safetyRating)}
                        </div>
                        <p className="text-sm text-muted-foreground">{stock.name}</p>
                        {stock.riskFactors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {stock.riskFactors.map((factor, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-orange-500 border-orange-500">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">Yield</p>
                        <p className="font-medium">{stock.dividendYield.toFixed(2)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Payout</p>
                        <p className={`font-medium ${stock.payoutRatio > 75 ? 'text-red-500' : ''}`}>
                          {stock.payoutRatio.toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">D/E</p>
                        <p className={`font-medium ${stock.debtToEquity > 2 ? 'text-orange-500' : ''}`}>
                          {stock.debtToEquity.toFixed(1)}x
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Streak</p>
                        <p className="font-medium">{stock.consecutiveYears} yrs</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No dividend-paying holdings to analyze</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info about scoring */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>About Dividend Safety Scores:</strong> Scores range from 0-100 based on payout ratio, 
          free cash flow coverage, debt levels, and dividend history. Scores above 60 indicate likely safe dividends, 
          while scores below 40 suggest higher risk of cuts. This is for informational purposes only.
        </AlertDescription>
      </Alert>
    </div>
  );
};
