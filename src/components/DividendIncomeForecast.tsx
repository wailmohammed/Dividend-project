import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Area } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { DollarSign, TrendingUp, Calendar, Target, ArrowUpRight } from 'lucide-react';

const DividendIncomeForecast: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const [growthRate, setGrowthRate] = useState(5);

  // Current annual dividend income
  const currentIncome = useMemo(() => {
    return holdings.reduce((sum, h) => {
      return sum + (Number(h.shares) * Number(h.currentPrice) * (Number(h.dividendYield || 0) / 100));
    }, 0);
  }, [holdings]);

  // 10-year forecast
  const forecastData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 10; i++) {
      const year = new Date().getFullYear() + i;
      const income = currentIncome * Math.pow(1 + growthRate / 100, i);
      data.push({
        year,
        income: Math.round(income),
        monthly: Math.round(income / 12),
        cumulative: Math.round(currentIncome * ((Math.pow(1 + growthRate / 100, i + 1) - 1) / (growthRate / 100))),
      });
    }
    return data;
  }, [currentIncome, growthRate]);

  // Monthly breakdown (current year)
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, i) => {
      // Simulate quarterly payers
      const quarterlyIncome = i % 3 === 0 ? currentIncome * 0.7 / 4 : 0;
      const monthlyIncome = currentIncome * 0.3 / 12;
      return {
        month: m,
        income: Math.round(quarterlyIncome + monthlyIncome),
      };
    });
  }, [currentIncome]);

  // Per-holding yield breakdown
  const holdingBreakdown = useMemo(() => {
    return holdings
      .filter(h => Number(h.dividendYield) > 0)
      .map(h => {
        const value = Number(h.shares) * Number(h.currentPrice);
        const income = value * (Number(h.dividendYield) / 100);
        return {
          symbol: h.symbol,
          name: h.name,
          yield: Number(h.dividendYield),
          annualIncome: income,
          weight: currentIncome > 0 ? (income / currentIncome) * 100 : 0,
        };
      })
      .sort((a, b) => b.annualIncome - a.annualIncome);
  }, [holdings, currentIncome]);

  const year5Income = forecastData[5]?.income || 0;
  const year10Income = forecastData[10]?.income || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-500" /> Dividend Income Forecast
        </h2>
        <p className="text-muted-foreground">Project your future dividend income with growth modeling</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-foreground">${currentIncome.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Current Annual</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-foreground">${Math.round(currentIncome / 12).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Monthly Income</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-emerald-500">${year5Income.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">5-Year Projected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-primary">${year10Income.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">10-Year Projected</div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Rate Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Dividend Growth Rate:</span>
            {[3, 5, 7, 10].map(rate => (
              <button
                key={rate}
                onClick={() => setGrowthRate(rate)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  growthRate === rate
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {rate}%
              </button>
            ))}
            <Badge variant="outline" className="text-xs">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              {((year10Income / currentIncome - 1) * 100).toFixed(0)}% growth over 10y
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="forecast">
        <TabsList>
          <TabsTrigger value="forecast">10-Year Forecast</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Calendar</TabsTrigger>
          <TabsTrigger value="breakdown">Per-Holding</TabsTrigger>
        </TabsList>

        <TabsContent value="forecast">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Income Projection</CardTitle>
              <CardDescription>Annual dividend income at {growthRate}% growth</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastData}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--popover-foreground))' }}
                      formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name === 'income' ? 'Annual Income' : 'Cumulative']}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="income" name="Annual Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Income Calendar</CardTitle>
              <CardDescription>Expected dividend payments by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--popover-foreground))' }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, 'Income']}
                    />
                    <Bar dataKey="income" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Income by Holding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {holdingBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No dividend-paying holdings</p>
                ) : (
                  holdingBreakdown.map(h => (
                    <div key={h.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <div className="font-semibold text-sm">{h.symbol}</div>
                        <div className="text-xs text-muted-foreground">{h.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">${h.annualIncome.toFixed(0)}/yr</div>
                        <div className="text-xs text-muted-foreground">{h.yield.toFixed(2)}% yield • {h.weight.toFixed(1)}% of income</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DividendIncomeForecast;
