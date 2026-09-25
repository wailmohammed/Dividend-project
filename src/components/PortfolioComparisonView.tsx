import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart, Line } from 'recharts';
import { GitCompare, TrendingUp, TrendingDown, DollarSign, PieChart, Percent, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface PortfolioMetrics {
  id: string;
  name: string;
  totalValue: number;
  holdingsCount: number;
  cashBalance: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dividendYield: number;
  topSector: string;
  diversificationScore: number;
  avgHoldingSize: number;
}

export const PortfolioComparisonView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { portfolios, activePortfolio } = usePortfolio();
  const [selectedPortfolios, setSelectedPortfolios] = useState<string[]>(() => 
    portfolios.slice(0, 3).map(p => p.id)
  );
  const [expandedMetrics, setExpandedMetrics] = useState(true);

  // Calculate metrics for each portfolio
  const portfolioMetrics = useMemo((): PortfolioMetrics[] => {
    return portfolios.map(portfolio => {
      const holdings = (portfolio as any).holdings || [];
      const transactions = (portfolio as any).transactions || [];
      
      const cashBalance = (portfolio as any).cashBalance || 0;
      const totalValue = holdings.reduce((sum: number, h: any) => 
        sum + ((h.shares || 0) * (h.currentPrice || h.avgPrice || 0)), 0
      ) + cashBalance;
      
      const totalCost = holdings.reduce((sum: number, h: any) => 
        sum + ((h.shares || 0) * (h.avgPrice || 0)), 0
      );
      
      const totalGain = holdings.reduce((sum: number, h: any) => {
        const value = (h.shares || 0) * (h.currentPrice || 0);
        const cost = (h.shares || 0) * (h.avgPrice || 0);
        return sum + (value - cost);
      }, 0);
      
      const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
      
      const dividendYield = holdings.length > 0
        ? holdings.reduce((sum: number, h: any) => sum + (h.dividendYield || 0), 0) / holdings.length
        : 0;
      
      // Get top sector
      const sectorMap: Record<string, number> = {};
      holdings.forEach((h: any) => {
        const sector = h.sector || 'Unknown';
        const value = (h.shares || 0) * (h.currentPrice || 0);
        sectorMap[sector] = (sectorMap[sector] || 0) + value;
      });
      const topSector = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      
      // Diversification score (based on number of holdings and sector spread)
      const uniqueSectors = new Set(holdings.map((h: any) => h.sector || 'Unknown')).size;
      const diversificationScore = Math.min(100, (holdings.length * 5) + (uniqueSectors * 10));
      
      const avgHoldingSize = holdings.length > 0 ? totalValue / holdings.length : 0;

      return {
        id: portfolio.id,
        name: portfolio.name,
        totalValue,
        holdingsCount: holdings.length,
        cashBalance,
        totalCost,
        totalGain,
        totalGainPercent,
        dividendYield,
        topSector,
        diversificationScore,
        avgHoldingSize
      };
    });
  }, [portfolios]);

  const selectedMetrics = portfolioMetrics.filter(m => selectedPortfolios.includes(m.id));

  // Prepare chart data
  const comparisonBarData = [
    {
      metric: 'Total Value',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, m.totalValue]))
    },
    {
      metric: 'Total Cost',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, m.totalCost]))
    },
    {
      metric: 'Total Gain',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, Math.abs(m.totalGain)]))
    },
    {
      metric: 'Cash',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, m.cashBalance]))
    }
  ];

  const radarData = [
    {
      metric: 'Holdings Count',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, Math.min(100, m.holdingsCount * 10)]))
    },
    {
      metric: 'Return %',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, Math.min(100, Math.max(0, m.totalGainPercent + 50))]))
    },
    {
      metric: 'Div Yield',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, Math.min(100, m.dividendYield * 20)]))
    },
    {
      metric: 'Diversification',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, m.diversificationScore]))
    },
    {
      metric: 'Avg Size',
      ...Object.fromEntries(selectedMetrics.map(m => [m.name, Math.min(100, (m.avgHoldingSize / 1000) * 10)]))
    }
  ];

  const togglePortfolio = (id: string) => {
    setSelectedPortfolios(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  if (portfolios.length < 2) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <GitCompare className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Not Enough Portfolios</h2>
          <p className="text-muted-foreground text-center max-w-md">
            You need at least 2 portfolios to compare performance. Create another portfolio to use this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample portfolio comparison. Sign in to compare your real portfolios.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Portfolio Comparison</h1>
          <p className="text-muted-foreground">Compare performance across your portfolios</p>
        </div>
      </div>

      {/* Portfolio Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Select Portfolios to Compare</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {portfolios.map((portfolio, index) => (
              <div key={portfolio.id} className="flex items-center space-x-2">
                <Checkbox
                  id={portfolio.id}
                  checked={selectedPortfolios.includes(portfolio.id)}
                  onCheckedChange={() => togglePortfolio(portfolio.id)}
                />
                <Label htmlFor={portfolio.id} className="flex items-center gap-2 cursor-pointer">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  {portfolio.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedMetrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Select at least one portfolio to view comparison</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Value Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Value Comparison
              </CardTitle>
              <CardDescription>Compare portfolio values side by side</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="metric" stroke="hsl(var(--muted-foreground))" width={80} />
                    <Tooltip 
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Legend />
                    {selectedMetrics.map((m, index) => (
                      <Bar 
                        key={m.id} 
                        dataKey={m.name} 
                        fill={COLORS[index % COLORS.length]} 
                        radius={[0, 4, 4, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Radar Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                Portfolio Profile Comparison
              </CardTitle>
              <CardDescription>Compare portfolio characteristics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                    {selectedMetrics.map((m, index) => (
                      <Radar
                        key={m.id}
                        name={m.name}
                        dataKey={m.name}
                        stroke={COLORS[index % COLORS.length]}
                        fill={COLORS[index % COLORS.length]}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Metrics Table */}
          <Card>
            <CardHeader>
              <button 
                onClick={() => setExpandedMetrics(!expandedMetrics)}
                className="flex items-center justify-between w-full"
              >
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-primary" />
                  Detailed Metrics
                </CardTitle>
                {expandedMetrics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </CardHeader>
            {expandedMetrics && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      {selectedMetrics.map((m, index) => (
                        <TableHead key={m.id} className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            {m.name}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Total Value</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right font-bold">
                          ${m.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Cost</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">
                          ${m.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Gain/Loss</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className={`text-right font-medium ${m.totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {m.totalGain >= 0 ? '+' : ''}${m.totalGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Return %</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">
                          <Badge className={m.totalGainPercent >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}>
                            {m.totalGainPercent >= 0 ? '+' : ''}{m.totalGainPercent.toFixed(2)}%
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Holdings</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">{m.holdingsCount}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Cash Balance</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">
                          ${m.cashBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Avg Dividend Yield</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">{m.dividendYield.toFixed(2)}%</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Top Sector</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">
                          <Badge variant="outline">{m.topSector}</Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Diversification Score</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">{m.diversificationScore}/100</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Avg Holding Size</TableCell>
                      {selectedMetrics.map(m => (
                        <TableCell key={m.id} className="text-right">
                          ${m.avgHoldingSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
