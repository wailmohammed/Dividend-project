import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { Calculator, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';

interface DRIPProjection {
  year: number;
  portfolioValue: number;
  totalShares: number;
  annualDividends: number;
  totalContributions: number;
  totalDividendsReceived: number;
}

export const DRIPCalculator: React.FC = () => {
  const [initialInvestment, setInitialInvestment] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [dividendYield, setDividendYield] = useState(3.5);
  const [dividendGrowth, setDividendGrowth] = useState(5);
  const [priceGrowth, setPriceGrowth] = useState(7);
  const [years, setYears] = useState(20);
  const [dripEnabled, setDripEnabled] = useState(true);

  const projections = useMemo(() => {
    const data: DRIPProjection[] = [];
    
    let portfolioValue = initialInvestment;
    let totalShares = initialInvestment / 100; // Assume $100 starting price
    let currentYield = dividendYield / 100;
    let sharePrice = 100;
    let totalContributions = initialInvestment;
    let totalDividendsReceived = 0;

    for (let year = 0; year <= years; year++) {
      const annualDividends = portfolioValue * currentYield;
      
      data.push({
        year,
        portfolioValue: Math.round(portfolioValue),
        totalShares: Math.round(totalShares * 100) / 100,
        annualDividends: Math.round(annualDividends),
        totalContributions: Math.round(totalContributions),
        totalDividendsReceived: Math.round(totalDividendsReceived),
      });

      if (year < years) {
        // Apply price growth
        sharePrice *= (1 + priceGrowth / 100);
        
        // Add monthly contributions
        const yearlyContributions = monthlyContribution * 12;
        const newShares = yearlyContributions / sharePrice;
        totalShares += newShares;
        totalContributions += yearlyContributions;
        
        // Calculate and reinvest dividends if DRIP is enabled
        const dividendsEarned = portfolioValue * currentYield;
        totalDividendsReceived += dividendsEarned;
        
        if (dripEnabled) {
          const dripShares = dividendsEarned / sharePrice;
          totalShares += dripShares;
        }
        
        // Update portfolio value
        portfolioValue = totalShares * sharePrice;
        
        // Grow dividend yield
        currentYield *= (1 + dividendGrowth / 100);
      }
    }

    return data;
  }, [initialInvestment, monthlyContribution, dividendYield, dividendGrowth, priceGrowth, years, dripEnabled]);

  const finalData = projections[projections.length - 1];
  const totalReturn = finalData.portfolioValue - finalData.totalContributions;
  const returnPercent = (totalReturn / finalData.totalContributions) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          DRIP Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="initial">Initial Investment ($)</Label>
              <Input
                id="initial"
                type="number"
                value={initialInvestment}
                onChange={(e) => setInitialInvestment(Number(e.target.value))}
                min={0}
              />
            </div>
            <div>
              <Label htmlFor="monthly">Monthly Contribution ($)</Label>
              <Input
                id="monthly"
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Dividend Yield: {dividendYield}%</Label>
              <Slider
                value={[dividendYield]}
                onValueChange={([v]) => setDividendYield(v)}
                min={0}
                max={15}
                step={0.1}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Dividend Growth Rate: {dividendGrowth}%</Label>
              <Slider
                value={[dividendGrowth]}
                onValueChange={([v]) => setDividendGrowth(v)}
                min={0}
                max={20}
                step={0.5}
                className="mt-2"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Price Growth Rate: {priceGrowth}%</Label>
              <Slider
                value={[priceGrowth]}
                onValueChange={([v]) => setPriceGrowth(v)}
                min={-10}
                max={20}
                step={0.5}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Investment Period: {years} years</Label>
              <Slider
                value={[years]}
                onValueChange={([v]) => setYears(v)}
                min={1}
                max={40}
                step={1}
                className="mt-2"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="drip">Reinvest Dividends (DRIP)</Label>
              <Switch
                id="drip"
                checked={dripEnabled}
                onCheckedChange={setDripEnabled}
              />
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-foreground">
              ${finalData.portfolioValue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Final Portfolio Value</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold text-emerald-500">
              +{returnPercent.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Total Return</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-4 text-center">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold text-blue-500">
              ${finalData.totalDividendsReceived.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total Dividends</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold text-amber-500">
              ${finalData.annualDividends.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Final Year Dividends</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projections}>
              <defs>
                <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="contribGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                label={{ value: 'Years', position: 'bottom', offset: -5 }}
              />
              <YAxis 
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                tick={{ fontSize: 12 }} 
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name === 'portfolioValue' ? 'Portfolio Value' :
                  name === 'totalContributions' ? 'Total Contributions' :
                  name === 'annualDividends' ? 'Annual Dividends' : name
                ]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="portfolioValue" 
                name="Portfolio Value"
                stroke="#6366f1"
                fill="url(#valueGradient)"
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="totalContributions" 
                name="Total Contributions"
                stroke="#10b981"
                fill="url(#contribGradient)"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="annualDividends" 
                name="Annual Dividends"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Projection Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Year</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Portfolio Value</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Contributions</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Annual Dividends</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total Dividends</th>
              </tr>
            </thead>
            <tbody>
              {projections.filter((_, i) => i % Math.ceil(years / 10) === 0 || i === projections.length - 1).map((row) => (
                <tr key={row.year} className="border-b border-border hover:bg-muted/50">
                  <td className="py-2 px-3 font-medium text-foreground">{row.year}</td>
                  <td className="py-2 px-3 text-right text-foreground">${row.portfolioValue.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">${row.totalContributions.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-emerald-500">${row.annualDividends.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-blue-500">${row.totalDividendsReceived.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default DRIPCalculator;
