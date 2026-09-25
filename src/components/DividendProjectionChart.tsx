import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { usePortfolio } from '@/context/PortfolioContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Line 
} from 'recharts';
import { TrendingUp, Calendar, DollarSign, Target } from 'lucide-react';
import { addMonths, format } from 'date-fns';

interface DividendProjection {
  month: string;
  monthYear: string;
  estimated: number;
  cumulative: number;
}

export const DividendProjectionChart = () => {
  const { activePortfolio } = usePortfolio();
  
  // Calculate dividend data from holdings
  const dividendStats = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    
    let totalAnnualDividends = 0;
    let totalValue = 0;
    
    holdings.forEach(h => {
      const value = (h.shares || 0) * (h.currentPrice || h.avgPrice || 0);
      const yieldPercent = h.dividendYield || 0;
      totalValue += value;
      totalAnnualDividends += value * (yieldPercent / 100);
    });
    
    const avgYield = totalValue > 0 ? (totalAnnualDividends / totalValue) * 100 : 0;
    
    return {
      totalAnnual: totalAnnualDividends,
      monthly: totalAnnualDividends / 12,
      quarterly: totalAnnualDividends / 4,
      avgYield,
      totalValue
    };
  }, [activePortfolio]);

  // Generate 12-month projection
  const projectionData = useMemo((): DividendProjection[] => {
    const data: DividendProjection[] = [];
    let cumulative = 0;
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = addMonths(now, i);
      const month = format(date, 'MMM');
      const monthYear = format(date, 'MMM yyyy');
      // Without confirmed payment dates per holding, show an even monthly
      // average instead of implying a payout schedule we do not know.
      const estimated = dividendStats.monthly;
      
      cumulative += estimated;
      
      data.push({
        month,
        monthYear,
        estimated: Math.round(estimated * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100
      });
    }
    
    return data;
  }, [dividendStats]);

  // Calculate yearly targets
  const yearlyProjection = useMemo(() => {
    const projected = projectionData.reduce((sum, d) => sum + d.estimated, 0);
    return {
      projected,
      monthly: projected / 12,
      daily: projected / 365
    };
  }, [projectionData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!activePortfolio || activePortfolio.holdings.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings Yet</h3>
          <p className="text-muted-foreground">Add holdings to see dividend projections.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">12-Month Projection</p>
                <p className="text-xl font-bold text-emerald-500">
                  ${yearlyProjection.projected.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Average</p>
                <p className="text-xl font-bold">
                  ${yearlyProjection.monthly.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average Yield</p>
                <p className="text-xl font-bold">
                  {dividendStats.avgYield.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Target className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daily Income</p>
                <p className="text-xl font-bold">
                  ${yearlyProjection.daily.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            12-Month Dividend Income Projection
          </CardTitle>
          <CardDescription>
            Annualized from current holdings and stated yields, divided evenly by 12. Actual payment dates and amounts can vary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projectionData}>
                <defs>
                  <linearGradient id="dividendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="estimated" 
                  name="Monthly Dividend" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="cumulative" 
                  name="Cumulative" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Monthly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {projectionData.map((month) => (
              <div 
                key={month.monthYear}
                className="p-3 rounded-lg border bg-muted/50 border-border transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{month.month}</span>
                </div>
                <p className="text-lg font-bold text-emerald-500">
                  ${month.estimated.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total: ${month.cumulative.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
