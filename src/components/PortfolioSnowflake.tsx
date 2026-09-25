import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { SnowflakeScore } from '@/types';

const PortfolioSnowflake: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);

  const aggregatedScore: SnowflakeScore = useMemo(() => {
    if (holdings.length === 0) return { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };

    // Weighted average by portfolio value
    const weighted = holdings.reduce(
      (acc, h) => {
        const weight = totalValue > 0 ? (h.shares * h.currentPrice) / totalValue : 1 / holdings.length;
        acc.value += h.snowflake.value * weight;
        acc.future += h.snowflake.future * weight;
        acc.past += h.snowflake.past * weight;
        acc.health += h.snowflake.health * weight;
        acc.dividend += h.snowflake.dividend * weight;
        return acc;
      },
      { value: 0, future: 0, past: 0, health: 0, dividend: 0 }
    );

    const total = weighted.value + weighted.future + weighted.past + weighted.health + weighted.dividend;
    return { ...weighted, total };
  }, [holdings, totalValue]);

  const chartData = [
    { subject: 'Value', score: aggregatedScore.value, fullMark: 5 },
    { subject: 'Future', score: aggregatedScore.future, fullMark: 5 },
    { subject: 'Past', score: aggregatedScore.past, fullMark: 5 },
    { subject: 'Health', score: aggregatedScore.health, fullMark: 5 },
    { subject: 'Dividend', score: aggregatedScore.dividend, fullMark: 5 },
  ];

  const getScoreLabel = (score: number): { label: string; color: string } => {
    if (score >= 4) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (score >= 3) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 2) return { label: 'Average', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Weak', color: 'text-red-600 dark:text-red-400' };
  };

  const totalLabel = getScoreLabel(aggregatedScore.total / 5);

  // Per-holding breakdown
  const holdingScores = useMemo(() => {
    return holdings
      .map(h => ({
        symbol: h.symbol,
        name: h.name,
        weight: totalValue > 0 ? (h.shares * h.currentPrice / totalValue) * 100 : 0,
        total: h.snowflake.total,
        snowflake: h.snowflake,
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [holdings, totalValue]);

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Snowflake</h2>
          <p className="text-muted-foreground">Add holdings to see your aggregate portfolio health</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Portfolio Snowflake</h2>
        <p className="text-muted-foreground">Aggregate quality score across all holdings, weighted by portfolio value</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Snowflake */}
        <Card>
          <CardHeader className="pb-0 text-center">
            <CardTitle className="text-lg">Overall Portfolio Quality</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={`text-4xl font-bold ${totalLabel.color}`}>{aggregatedScore.total.toFixed(1)}</span>
              <span className="text-muted-foreground text-lg">/25</span>
            </div>
            <Badge variant="outline" className={`${totalLabel.color} mt-1`}>{totalLabel.label}</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13, fontWeight: 500 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar name="Portfolio" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Dimension Breakdown</CardTitle>
            <CardDescription>Weighted average scores across your holdings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {chartData.map(item => {
              const label = getScoreLabel(item.score);
              return (
                <div key={item.subject}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{item.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${label.color}`}>{item.score.toFixed(1)}/5</span>
                      <Badge variant="outline" className={`text-xs ${label.color}`}>{label.label}</Badge>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(item.score / 5) * 100}%`, opacity: 0.5 + (item.score / 5) * 0.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Per-holding scores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Holdings Quality Breakdown</CardTitle>
          <CardDescription>How each holding contributes to portfolio quality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Stock</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Weight</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Value</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Future</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Past</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Health</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Dividend</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {holdingScores.map(h => (
                  <tr key={h.symbol} className="border-b border-muted hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-2">
                      <div className="font-medium">{h.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[120px]">{h.name}</div>
                    </td>
                    <td className="text-right py-2 px-2">{h.weight.toFixed(1)}%</td>
                    <td className={`text-right py-2 px-2 ${getScoreLabel(h.snowflake.value).color}`}>{h.snowflake.value}</td>
                    <td className={`text-right py-2 px-2 ${getScoreLabel(h.snowflake.future).color}`}>{h.snowflake.future}</td>
                    <td className={`text-right py-2 px-2 ${getScoreLabel(h.snowflake.past).color}`}>{h.snowflake.past}</td>
                    <td className={`text-right py-2 px-2 ${getScoreLabel(h.snowflake.health).color}`}>{h.snowflake.health}</td>
                    <td className={`text-right py-2 px-2 ${getScoreLabel(h.snowflake.dividend).color}`}>{h.snowflake.dividend}</td>
                    <td className="text-right py-2 px-2 font-bold">{h.total}/25</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioSnowflake;
