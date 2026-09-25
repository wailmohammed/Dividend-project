import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, TrendingUp, TrendingDown, Minus, Calendar, Target, AlertTriangle, CheckCircle, DollarSign, PieChart } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { format, subDays } from 'date-fns';

const WeeklyInsights: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgPrice, 0);
  const totalGainPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  const today = new Date();
  const weekStart = subDays(today, 7);

  const insights = useMemo(() => {
    const items: { icon: React.ReactNode; title: string; body: string; type: 'positive' | 'negative' | 'neutral' }[] = [];

    // Portfolio summary
    items.push({
      icon: <PieChart className="w-4 h-4" />,
      title: 'Portfolio Value',
      body: `Your portfolio is valued at $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${holdings.length} holdings. Overall ${totalGainPct >= 0 ? 'gain' : 'loss'} of ${Math.abs(totalGainPct).toFixed(1)}% from cost basis.`,
      type: totalGainPct >= 0 ? 'positive' : 'negative',
    });

    // Top performers
    const sorted = [...holdings].sort((a, b) => {
      const aRet = (a.currentPrice - a.avgPrice) / a.avgPrice;
      const bRet = (b.currentPrice - b.avgPrice) / b.avgPrice;
      return bRet - aRet;
    });

    if (sorted.length >= 1) {
      const best = sorted[0];
      const bestRet = ((best.currentPrice - best.avgPrice) / best.avgPrice * 100);
      items.push({
        icon: <TrendingUp className="w-4 h-4" />,
        title: 'Top Performer',
        body: `${best.symbol} (${best.name}) leads your portfolio with a ${bestRet.toFixed(1)}% return. Current price: $${best.currentPrice.toFixed(2)}.`,
        type: 'positive',
      });
    }

    if (sorted.length >= 2) {
      const worst = sorted[sorted.length - 1];
      const worstRet = ((worst.currentPrice - worst.avgPrice) / worst.avgPrice * 100);
      if (worstRet < 0) {
        items.push({
          icon: <TrendingDown className="w-4 h-4" />,
          title: 'Biggest Laggard',
          body: `${worst.symbol} (${worst.name}) is down ${Math.abs(worstRet).toFixed(1)}% from your cost basis. Consider reviewing if your thesis still holds.`,
          type: 'negative',
        });
      }
    }

    // Concentration check
    if (holdings.length > 0) {
      const maxHolding = sorted.reduce((max, h) => {
        const val = h.shares * h.currentPrice;
        return val > max.val ? { symbol: h.symbol, val, pct: (val / totalValue) * 100 } : max;
      }, { symbol: '', val: 0, pct: 0 });

      if (maxHolding.pct > 25) {
        items.push({
          icon: <AlertTriangle className="w-4 h-4" />,
          title: 'Concentration Risk',
          body: `${maxHolding.symbol} represents ${maxHolding.pct.toFixed(1)}% of your portfolio. Consider diversifying to reduce single-stock risk.`,
          type: 'negative',
        });
      }
    }

    // Dividend insight
    const divHoldings = holdings.filter(h => h.dividendYield > 0);
    if (divHoldings.length > 0) {
      const avgYield = divHoldings.reduce((s, h) => s + h.dividendYield, 0) / divHoldings.length;
      const estAnnualIncome = divHoldings.reduce((s, h) => s + h.shares * h.currentPrice * (h.dividendYield / 100), 0);
      items.push({
        icon: <DollarSign className="w-4 h-4" />,
        title: 'Dividend Income',
        body: `${divHoldings.length} holdings pay dividends with an average yield of ${avgYield.toFixed(2)}%. Estimated annual dividend income: $${estAnnualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
        type: 'positive',
      });
    }

    // Health check
    const unhealthyCount = holdings.filter(h => h.snowflake.health < 3).length;
    if (unhealthyCount > 0) {
      items.push({
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'Financial Health Concerns',
        body: `${unhealthyCount} holding${unhealthyCount > 1 ? 's' : ''} ${unhealthyCount > 1 ? 'have' : 'has'} below-average financial health scores. Review balance sheet strength for these positions.`,
        type: 'negative',
      });
    } else if (holdings.length > 0) {
      items.push({
        icon: <CheckCircle className="w-4 h-4" />,
        title: 'Healthy Portfolio',
        body: 'All holdings have adequate financial health scores. Your portfolio fundamentals look solid.',
        type: 'positive',
      });
    }

    // Sector diversity
    const sectors = new Set(holdings.map(h => h.sector));
    items.push({
      icon: <Target className="w-4 h-4" />,
      title: 'Sector Exposure',
      body: `Your portfolio spans ${sectors.size} sector${sectors.size !== 1 ? 's' : ''}. ${sectors.size >= 5 ? 'Good diversification across industries.' : 'Consider adding exposure to more sectors for better diversification.'}`,
      type: sectors.size >= 5 ? 'positive' : 'neutral',
    });

    return items;
  }, [holdings, totalValue, totalCost, totalGainPct]);

  const typeColors = {
    positive: 'border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/5',
    negative: 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5',
    neutral: 'border-muted bg-muted/30',
  };

  const typeIconColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Weekly Portfolio Insights</h2>
        <p className="text-muted-foreground">AI-curated summary of what matters in your portfolio this week</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Week of {format(weekStart, 'MMM d')} — {format(today, 'MMM d, yyyy')}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              Auto-generated
            </Badge>
          </div>
          <CardDescription>
            {holdings.length} holdings · ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total value
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${typeColors[insight.type]}`}>
              <div className={`mt-0.5 shrink-0 ${typeIconColors[insight.type]}`}>{insight.icon}</div>
              <div>
                <div className="font-medium text-sm">{insight.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{insight.body}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{holdings.length}</div>
            <div className="text-xs text-muted-foreground">Holdings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className={`text-2xl font-bold ${totalGainPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Total Return</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{new Set(holdings.map(h => h.sector)).size}</div>
            <div className="text-xs text-muted-foreground">Sectors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{holdings.filter(h => h.dividendYield > 0).length}</div>
            <div className="text-xs text-muted-foreground">Div. Payers</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WeeklyInsights;
