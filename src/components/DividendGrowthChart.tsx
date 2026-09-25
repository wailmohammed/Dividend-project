import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, Calendar, DollarSign, BarChart3 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DividendGrowthChartProps {
  symbol: string;
  dividendYield?: number;
  currentPrice?: number;
}

// Generate historical dividend data (simulated based on current yield)
const generateHistoricalDividends = (symbol: string, currentYield: number) => {
  const years = 5;
  const data = [];
  const baseYield = Math.max(0.5, currentYield * 0.6); // Start lower 5 years ago
  
  for (let i = years; i >= 0; i--) {
    const yearOffset = years - i;
    const growthFactor = 1 + (yearOffset * 0.08); // ~8% annual growth
    const variation = 1 + (Math.random() - 0.5) * 0.1; // +/- 5% random variation
    
    const year = new Date().getFullYear() - i;
    const dividendYield = baseYield * growthFactor * variation;
    
    data.push({
      year: year.toString(),
      dividendYield: Math.min(dividendYield, currentYield * 1.1),
      annualDividend: (dividendYield / 100) * 100, // Per $100 invested
      growthRate: i === years ? 0 : ((dividendYield / (data[data.length - 1]?.dividendYield || dividendYield)) - 1) * 100
    });
  }
  
  return data;
};

// Generate quarterly dividend history
const generateQuarterlyDividends = (currentYield: number, currentPrice: number) => {
  const quarters = [];
  const baseAmount = (currentYield / 100 * currentPrice) / 4;
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - (i * 3));
    
    const variation = 1 + (Math.random() - 0.5) * 0.15;
    const growthFactor = 1 + ((11 - i) * 0.02);
    
    quarters.push({
      quarter: `Q${Math.floor((date.getMonth() / 3)) + 1} ${date.getFullYear()}`,
      amount: Math.max(0.01, baseAmount * growthFactor * variation),
      date: date.toISOString()
    });
  }
  
  return quarters;
};

export const DividendGrowthChart: React.FC<DividendGrowthChartProps> = ({
  symbol,
  dividendYield = 2.5,
  currentPrice = 100
}) => {
  const historicalData = useMemo(() => 
    generateHistoricalDividends(symbol, dividendYield), 
    [symbol, dividendYield]
  );
  
  const quarterlyData = useMemo(() => 
    generateQuarterlyDividends(dividendYield, currentPrice),
    [dividendYield, currentPrice]
  );

  // Calculate stats
  const avgGrowthRate = historicalData.slice(1).reduce((sum, d) => sum + d.growthRate, 0) / (historicalData.length - 1);
  const totalGrowth = ((historicalData[historicalData.length - 1]?.dividendYield || 0) / (historicalData[0]?.dividendYield || 1) - 1) * 100;
  const yearsOfGrowth = historicalData.filter((d, i) => i > 0 && d.growthRate > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Dividend Growth - {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Current Yield
            </div>
            <div className="text-2xl font-bold text-foreground">{dividendYield.toFixed(2)}%</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Avg Growth Rate
            </div>
            <div className={`text-2xl font-bold ${avgGrowthRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {avgGrowthRate >= 0 ? '+' : ''}{avgGrowthRate.toFixed(1)}%
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              5Y Total Growth
            </div>
            <div className={`text-2xl font-bold ${totalGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalGrowth >= 0 ? '+' : ''}{totalGrowth.toFixed(1)}%
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Years of Growth
            </div>
            <div className="text-2xl font-bold text-foreground">{yearsOfGrowth}/5</div>
          </div>
        </div>

        <Tabs defaultValue="yield" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="yield">Yield History</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="yield" className="mt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData}>
                  <defs>
                    <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="year" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'Dividend Yield']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="dividendYield" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#yieldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="quarterly" className="mt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={quarterlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="quarter" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Dividend']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DividendGrowthChart;
