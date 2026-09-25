import { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, Award, Crown, Calendar, ArrowUp, ArrowDown, Minus, RefreshCw, Star } from 'lucide-react';
import { Progress } from './ui/progress';

interface DividendGrowthData {
  symbol: string;
  name: string;
  currentYield: number;
  dividendGrowth1Y: number;
  dividendGrowth3Y: number;
  dividendGrowth5Y: number;
  dividendGrowth10Y: number;
  consecutiveYears: number;
  payoutRatio: number;
  dividendStreak: 'king' | 'aristocrat' | 'achiever' | 'challenger' | 'none';
  lastIncreaseDate: string;
  lastIncreasePercent: number;
}

// Simulated dividend growth data (in production, this would come from an API)
const DIVIDEND_GROWTH_DATA: Record<string, Partial<DividendGrowthData>> = {
  'AAPL': { dividendGrowth1Y: 4.2, dividendGrowth3Y: 6.8, dividendGrowth5Y: 7.2, dividendGrowth10Y: 9.5, consecutiveYears: 12, payoutRatio: 15, lastIncreasePercent: 4.2 },
  'MSFT': { dividendGrowth1Y: 10.3, dividendGrowth3Y: 10.5, dividendGrowth5Y: 10.1, dividendGrowth10Y: 12.4, consecutiveYears: 19, payoutRatio: 28, lastIncreasePercent: 10.3 },
  'JNJ': { dividendGrowth1Y: 5.3, dividendGrowth3Y: 5.8, dividendGrowth5Y: 6.0, dividendGrowth10Y: 6.3, consecutiveYears: 62, payoutRatio: 45, lastIncreasePercent: 5.3 },
  'KO': { dividendGrowth1Y: 4.5, dividendGrowth3Y: 3.8, dividendGrowth5Y: 3.5, dividendGrowth10Y: 4.8, consecutiveYears: 62, payoutRatio: 68, lastIncreasePercent: 4.5 },
  'PG': { dividendGrowth1Y: 3.0, dividendGrowth3Y: 5.5, dividendGrowth5Y: 5.8, dividendGrowth10Y: 4.2, consecutiveYears: 68, payoutRatio: 62, lastIncreasePercent: 3.0 },
  'O': { dividendGrowth1Y: 3.2, dividendGrowth3Y: 3.0, dividendGrowth5Y: 3.5, dividendGrowth10Y: 4.5, consecutiveYears: 30, payoutRatio: 76, lastIncreasePercent: 2.1 },
  'ABBV': { dividendGrowth1Y: 4.7, dividendGrowth3Y: 8.5, dividendGrowth5Y: 17.5, dividendGrowth10Y: 14.2, consecutiveYears: 52, payoutRatio: 85, lastIncreasePercent: 4.7 },
  'VZ': { dividendGrowth1Y: 1.9, dividendGrowth3Y: 2.0, dividendGrowth5Y: 2.0, dividendGrowth10Y: 2.5, consecutiveYears: 19, payoutRatio: 52, lastIncreasePercent: 1.9 },
  'T': { dividendGrowth1Y: 0, dividendGrowth3Y: -15, dividendGrowth5Y: -5, dividendGrowth10Y: 2, consecutiveYears: 0, payoutRatio: 65, lastIncreasePercent: 0 },
  'SCHD': { dividendGrowth1Y: 3.8, dividendGrowth3Y: 12.5, dividendGrowth5Y: 11.8, dividendGrowth10Y: 10.2, consecutiveYears: 12, payoutRatio: 55, lastIncreasePercent: 3.8 },
  'JPM': { dividendGrowth1Y: 5.0, dividendGrowth3Y: 9.2, dividendGrowth5Y: 13.5, dividendGrowth10Y: 14.8, consecutiveYears: 14, payoutRatio: 25, lastIncreasePercent: 5.0 },
};

const getDividendStreak = (years: number): DividendGrowthData['dividendStreak'] => {
  if (years >= 50) return 'king';
  if (years >= 25) return 'aristocrat';
  if (years >= 10) return 'achiever';
  if (years >= 5) return 'challenger';
  return 'none';
};

const getStreakBadge = (streak: DividendGrowthData['dividendStreak']) => {
  switch (streak) {
    case 'king':
      return <Badge className="bg-yellow-500 text-black"><Crown className="w-3 h-3 mr-1" />Dividend King</Badge>;
    case 'aristocrat':
      return <Badge className="bg-purple-500"><Award className="w-3 h-3 mr-1" />Aristocrat</Badge>;
    case 'achiever':
      return <Badge className="bg-blue-500"><Star className="w-3 h-3 mr-1" />Achiever</Badge>;
    case 'challenger':
      return <Badge variant="secondary"><TrendingUp className="w-3 h-3 mr-1" />Challenger</Badge>;
    default:
      return null;
  }
};

export const DividendGrowthTracker = () => {
  const { activePortfolio } = usePortfolio();
  const [sortBy, setSortBy] = useState<'growth1Y' | 'growth5Y' | 'streak' | 'yield'>('growth5Y');

  // Build dividend growth data for holdings
  const growthData = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    
    return holdings
      .filter(h => (h.dividendYield || 0) > 0)
      .map(h => {
        const data = DIVIDEND_GROWTH_DATA[h.symbol] || {};
        const consecutiveYears = data.consecutiveYears || Math.floor(Math.random() * 20);
        
        return {
          symbol: h.symbol,
          name: h.name,
          currentYield: h.dividendYield || 0,
          dividendGrowth1Y: data.dividendGrowth1Y ?? (Math.random() * 10 - 2),
          dividendGrowth3Y: data.dividendGrowth3Y ?? (Math.random() * 12 - 1),
          dividendGrowth5Y: data.dividendGrowth5Y ?? (Math.random() * 15),
          dividendGrowth10Y: data.dividendGrowth10Y ?? (Math.random() * 12),
          consecutiveYears,
          payoutRatio: data.payoutRatio ?? (30 + Math.random() * 50),
          dividendStreak: getDividendStreak(consecutiveYears),
          lastIncreaseDate: '2024-04-15',
          lastIncreasePercent: data.lastIncreasePercent ?? (Math.random() * 8),
        } as DividendGrowthData;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'growth1Y': return b.dividendGrowth1Y - a.dividendGrowth1Y;
          case 'growth5Y': return b.dividendGrowth5Y - a.dividendGrowth5Y;
          case 'streak': return b.consecutiveYears - a.consecutiveYears;
          case 'yield': return b.currentYield - a.currentYield;
          default: return 0;
        }
      });
  }, [activePortfolio, sortBy]);

  // Portfolio-level metrics
  const portfolioMetrics = useMemo(() => {
    if (growthData.length === 0) return null;
    
    const avgGrowth1Y = growthData.reduce((sum, d) => sum + d.dividendGrowth1Y, 0) / growthData.length;
    const avgGrowth5Y = growthData.reduce((sum, d) => sum + d.dividendGrowth5Y, 0) / growthData.length;
    const avgStreak = growthData.reduce((sum, d) => sum + d.consecutiveYears, 0) / growthData.length;
    const kingsCount = growthData.filter(d => d.dividendStreak === 'king').length;
    const aristocratsCount = growthData.filter(d => d.dividendStreak === 'aristocrat').length;
    const achieversCount = growthData.filter(d => d.dividendStreak === 'achiever').length;

    return {
      avgGrowth1Y,
      avgGrowth5Y,
      avgStreak,
      kingsCount,
      aristocratsCount,
      achieversCount,
      totalDividendPayers: growthData.length,
    };
  }, [growthData]);

  // Chart data
  const chartData = growthData.slice(0, 10).map(d => ({
    symbol: d.symbol,
    '1Y': d.dividendGrowth1Y,
    '3Y': d.dividendGrowth3Y,
    '5Y': d.dividendGrowth5Y,
  }));

  const getGrowthIndicator = (growth: number) => {
    if (growth > 5) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (growth > 0) return <ArrowUp className="w-4 h-4 text-green-400" />;
    if (growth === 0) return <Minus className="w-4 h-4 text-muted-foreground" />;
    return <ArrowDown className="w-4 h-4 text-red-500" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth >= 10) return 'text-green-500';
    if (growth >= 5) return 'text-green-400';
    if (growth >= 0) return 'text-foreground';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Dividend Growth Tracker
          </h2>
          <p className="text-sm text-muted-foreground">Track year-over-year dividend increases for your holdings</p>
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="growth5Y">5Y Growth</SelectItem>
            <SelectItem value="growth1Y">1Y Growth</SelectItem>
            <SelectItem value="streak">Streak Years</SelectItem>
            <SelectItem value="yield">Current Yield</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Portfolio Metrics */}
      {portfolioMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Avg 1Y Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${getGrowthColor(portfolioMetrics.avgGrowth1Y)}`}>
                {portfolioMetrics.avgGrowth1Y >= 0 ? '+' : ''}{portfolioMetrics.avgGrowth1Y.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Avg 5Y Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${getGrowthColor(portfolioMetrics.avgGrowth5Y)}`}>
                {portfolioMetrics.avgGrowth5Y >= 0 ? '+' : ''}{portfolioMetrics.avgGrowth5Y.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Avg Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{portfolioMetrics.avgStreak.toFixed(0)} yrs</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Crown className="w-3 h-3 text-yellow-500" /> Kings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-yellow-500">{portfolioMetrics.kingsCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Award className="w-3 h-3 text-purple-500" /> Aristocrats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-500">{portfolioMetrics.aristocratsCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="w-3 h-3 text-blue-500" /> Achievers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-500">{portfolioMetrics.achieversCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Div Payers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{portfolioMetrics.totalDividendPayers}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Growth Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dividend Growth Comparison</CardTitle>
          <CardDescription>Compare 1Y, 3Y, and 5Y annualized dividend growth rates</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `${v}%`} domain={[-5, 20]} />
                <YAxis type="category" dataKey="symbol" width={60} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="1Y" name="1 Year" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="3Y" name="3 Year" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="5Y" name="5 Year" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No dividend-paying holdings in portfolio
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Dividend Growth Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          {growthData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Symbol</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Yield</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">1Y Growth</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">5Y Growth</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">10Y Growth</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Streak</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {growthData.map(stock => (
                    <tr key={stock.symbol} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <span className="font-medium">{stock.symbol}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{stock.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {getStreakBadge(stock.dividendStreak)}
                      </td>
                      <td className="py-3 px-2 text-right font-medium">{stock.currentYield.toFixed(2)}%</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getGrowthIndicator(stock.dividendGrowth1Y)}
                          <span className={getGrowthColor(stock.dividendGrowth1Y)}>
                            {stock.dividendGrowth1Y >= 0 ? '+' : ''}{stock.dividendGrowth1Y.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getGrowthIndicator(stock.dividendGrowth5Y)}
                          <span className={getGrowthColor(stock.dividendGrowth5Y)}>
                            {stock.dividendGrowth5Y >= 0 ? '+' : ''}{stock.dividendGrowth5Y.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={getGrowthColor(stock.dividendGrowth10Y)}>
                          {stock.dividendGrowth10Y >= 0 ? '+' : ''}{stock.dividendGrowth10Y.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant="outline">{stock.consecutiveYears} yrs</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress 
                            value={Math.min(stock.payoutRatio, 100)} 
                            className={`w-12 h-2 ${stock.payoutRatio > 80 ? 'bg-red-200' : ''}`}
                          />
                          <span className={stock.payoutRatio > 80 ? 'text-red-500' : ''}>{stock.payoutRatio.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No dividend-paying holdings found</p>
              <p className="text-sm mt-1">Add stocks with dividend yield to track growth</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
