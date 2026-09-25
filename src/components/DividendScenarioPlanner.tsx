import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { usePortfolio } from '@/context/PortfolioContext';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { TrendingUp, Calculator, DollarSign, Percent, ArrowRight, Leaf, Zap, Target } from 'lucide-react';
import { addYears, format } from 'date-fns';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ScenarioProjection {
  year: number;
  yearLabel: string;
  noReinvest: number;
  drip: number;
  aggressive: number;
  conservative: number;
  dividendsNoReinvest: number;
  dividendsDrip: number;
  dividendsAggressive: number;
  dividendsConservative: number;
}

interface ScenarioConfig {
  name: string;
  reinvestPercent: number;
  additionalContribution: number;
  yieldGrowth: number;
  priceGrowth: number;
  color: string;
  icon: typeof TrendingUp;
}

const scenarios: Record<string, ScenarioConfig> = {
  noReinvest: {
    name: 'No Reinvestment',
    reinvestPercent: 0,
    additionalContribution: 0,
    yieldGrowth: 0,
    priceGrowth: 5,
    color: '#64748b',
    icon: DollarSign
  },
  drip: {
    name: 'Full DRIP',
    reinvestPercent: 100,
    additionalContribution: 0,
    yieldGrowth: 3,
    priceGrowth: 7,
    color: '#10b981',
    icon: Leaf
  },
  aggressive: {
    name: 'Aggressive Growth',
    reinvestPercent: 100,
    additionalContribution: 500,
    yieldGrowth: 5,
    priceGrowth: 10,
    color: '#6366f1',
    icon: Zap
  },
  conservative: {
    name: 'Conservative',
    reinvestPercent: 50,
    additionalContribution: 200,
    yieldGrowth: 2,
    priceGrowth: 4,
    color: '#f59e0b',
    icon: Target
  }
};

export const DividendScenarioPlanner = () => {
  const { activePortfolio } = usePortfolio();
  
  // User inputs
  const [projectionYears, setProjectionYears] = useState(20);
  const [customReinvestPercent, setCustomReinvestPercent] = useState(100);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [dividendGrowthRate, setDividendGrowthRate] = useState(5);
  const [priceGrowthRate, setPriceGrowthRate] = useState(7);
  const [enableDrip, setEnableDrip] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<string>('all');

  // Calculate current portfolio dividend data
  const portfolioStats = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    
    let totalValue = 0;
    let totalAnnualDividends = 0;
    
    holdings.forEach(h => {
      const value = (h.shares || 0) * (h.currentPrice || h.avgPrice || 0);
      const yieldPercent = h.dividendYield || 0;
      totalValue += value;
      totalAnnualDividends += value * (yieldPercent / 100);
    });
    
    const avgYield = totalValue > 0 ? (totalAnnualDividends / totalValue) * 100 : 3.5;
    
    return {
      totalValue: totalValue || 10000, // Default for demo
      annualDividends: totalAnnualDividends || 350,
      avgYield: avgYield || 3.5
    };
  }, [activePortfolio]);

  // Generate projections for all scenarios
  const projectionData = useMemo((): ScenarioProjection[] => {
    const data: ScenarioProjection[] = [];
    const now = new Date();
    
    // Initialize values for each scenario
    let values = {
      noReinvest: portfolioStats.totalValue,
      drip: portfolioStats.totalValue,
      aggressive: portfolioStats.totalValue,
      conservative: portfolioStats.totalValue
    };
    
    for (let year = 0; year <= projectionYears; year++) {
      const date = addYears(now, year);
      
      // Calculate dividends for each scenario based on current value and yield
      const dividends = {
        noReinvest: values.noReinvest * (portfolioStats.avgYield / 100),
        drip: values.drip * (portfolioStats.avgYield / 100) * Math.pow(1 + scenarios.drip.yieldGrowth / 100, year),
        aggressive: values.aggressive * (portfolioStats.avgYield / 100) * Math.pow(1 + scenarios.aggressive.yieldGrowth / 100, year),
        conservative: values.conservative * (portfolioStats.avgYield / 100) * Math.pow(1 + scenarios.conservative.yieldGrowth / 100, year)
      };
      
      data.push({
        year,
        yearLabel: format(date, 'yyyy'),
        noReinvest: Math.round(values.noReinvest),
        drip: Math.round(values.drip),
        aggressive: Math.round(values.aggressive),
        conservative: Math.round(values.conservative),
        dividendsNoReinvest: Math.round(dividends.noReinvest),
        dividendsDrip: Math.round(dividends.drip),
        dividendsAggressive: Math.round(dividends.aggressive),
        dividendsConservative: Math.round(dividends.conservative)
      });
      
      // Update values for next year
      if (year < projectionYears) {
        // No reinvest: just price growth
        values.noReinvest *= (1 + scenarios.noReinvest.priceGrowth / 100);
        
        // DRIP: reinvest all dividends + price growth
        values.drip = values.drip * (1 + scenarios.drip.priceGrowth / 100) + dividends.drip;
        
        // Aggressive: reinvest + monthly contributions + higher growth
        values.aggressive = values.aggressive * (1 + scenarios.aggressive.priceGrowth / 100) + dividends.aggressive + (scenarios.aggressive.additionalContribution * 12);
        
        // Conservative: partial reinvest + some contributions + modest growth
        values.conservative = values.conservative * (1 + scenarios.conservative.priceGrowth / 100) + (dividends.conservative * 0.5) + (scenarios.conservative.additionalContribution * 12);
      }
    }
    
    return data;
  }, [portfolioStats, projectionYears]);

  // Custom scenario projection
  const customProjection = useMemo(() => {
    const data: { year: number; value: number; dividends: number; cumDividends: number }[] = [];
    let currentValue = portfolioStats.totalValue;
    let cumDividends = 0;
    
    for (let year = 0; year <= projectionYears; year++) {
      const annualDividends = currentValue * (portfolioStats.avgYield / 100) * Math.pow(1 + dividendGrowthRate / 100, year);
      cumDividends += annualDividends;
      
      data.push({
        year,
        value: Math.round(currentValue),
        dividends: Math.round(annualDividends),
        cumDividends: Math.round(cumDividends)
      });
      
      if (year < projectionYears) {
        const reinvestedDividends = annualDividends * (customReinvestPercent / 100);
        currentValue = currentValue * (1 + priceGrowthRate / 100) + reinvestedDividends + (monthlyContribution * 12);
      }
    }
    
    return data;
  }, [portfolioStats, projectionYears, customReinvestPercent, monthlyContribution, dividendGrowthRate, priceGrowthRate]);

  // Final values summary
  const finalSummary = useMemo(() => {
    const lastIndex = projectionData.length - 1;
    if (lastIndex < 0) return null;
    
    const final = projectionData[lastIndex];
    const initial = portfolioStats.totalValue;
    
    return {
      noReinvest: {
        value: final.noReinvest,
        gain: final.noReinvest - initial,
        gainPercent: ((final.noReinvest - initial) / initial) * 100,
        annualDividends: final.dividendsNoReinvest
      },
      drip: {
        value: final.drip,
        gain: final.drip - initial,
        gainPercent: ((final.drip - initial) / initial) * 100,
        annualDividends: final.dividendsDrip
      },
      aggressive: {
        value: final.aggressive,
        gain: final.aggressive - initial,
        gainPercent: ((final.aggressive - initial) / initial) * 100,
        annualDividends: final.dividendsAggressive
      },
      conservative: {
        value: final.conservative,
        gain: final.conservative - initial,
        gainPercent: ((final.conservative - initial) / initial) * 100,
        annualDividends: final.dividendsConservative
      },
      custom: {
        value: customProjection[customProjection.length - 1]?.value || 0,
        annualDividends: customProjection[customProjection.length - 1]?.dividends || 0,
        totalDividends: customProjection[customProjection.length - 1]?.cumDividends || 0
      }
    };
  }, [projectionData, customProjection, portfolioStats.totalValue]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">Year {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toLocaleString()}
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
          <Calculator className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings Yet</h3>
          <p className="text-muted-foreground">Add holdings to see dividend scenario projections.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="comparison">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="comparison">Scenario Comparison</TabsTrigger>
          <TabsTrigger value="custom">Custom Scenario</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-6">
          {/* Scenario Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(scenarios).map(([key, scenario]) => {
              const Icon = scenario.icon;
              const summary = finalSummary?.[key as keyof typeof finalSummary];
              if (!summary || typeof summary !== 'object' || !('value' in summary)) return null;
              
              const summaryData = summary as { value: number; gain?: number; gainPercent?: number; annualDividends?: number };
              
              return (
                <Card 
                  key={key} 
                  className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/50"
                  style={{ borderColor: `${scenario.color}40` }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${scenario.color}20` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: scenario.color }} />
                      </div>
                      <span className="font-medium text-sm">{scenario.name}</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: scenario.color }}>
                      ${summaryData.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      +{summaryData.gainPercent?.toFixed(0) || 0}% over {projectionYears} years
                    </p>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">Annual Dividends</p>
                      <p className="font-semibold text-emerald-500">
                        ${summaryData.annualDividends?.toLocaleString() || 0}/yr
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Projection Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Label>Projection Period:</Label>
                  <Select value={projectionYears.toString()} onValueChange={(v) => setProjectionYears(parseInt(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Years</SelectItem>
                      <SelectItem value="10">10 Years</SelectItem>
                      <SelectItem value="15">15 Years</SelectItem>
                      <SelectItem value="20">20 Years</SelectItem>
                      <SelectItem value="25">25 Years</SelectItem>
                      <SelectItem value="30">30 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Label>Show Scenario:</Label>
                  <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scenarios</SelectItem>
                      <SelectItem value="noReinvest">No Reinvestment</SelectItem>
                      <SelectItem value="drip">Full DRIP</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                      <SelectItem value="conservative">Conservative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Portfolio Value Projection
              </CardTitle>
              <CardDescription>
                Compare different reinvestment strategies over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionData}>
                    <defs>
                      {Object.entries(scenarios).map(([key, scenario]) => (
                        <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={scenario.color} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={scenario.color} stopOpacity={0}/>
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="year" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(v) => `Yr ${v}`}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {(selectedScenario === 'all' || selectedScenario === 'noReinvest') && (
                      <Area 
                        type="monotone" 
                        dataKey="noReinvest" 
                        name="No Reinvestment"
                        stroke={scenarios.noReinvest.color}
                        fill={`url(#gradient-noReinvest)`}
                        strokeWidth={2}
                      />
                    )}
                    {(selectedScenario === 'all' || selectedScenario === 'conservative') && (
                      <Area 
                        type="monotone" 
                        dataKey="conservative" 
                        name="Conservative"
                        stroke={scenarios.conservative.color}
                        fill={`url(#gradient-conservative)`}
                        strokeWidth={2}
                      />
                    )}
                    {(selectedScenario === 'all' || selectedScenario === 'drip') && (
                      <Area 
                        type="monotone" 
                        dataKey="drip" 
                        name="Full DRIP"
                        stroke={scenarios.drip.color}
                        fill={`url(#gradient-drip)`}
                        strokeWidth={2}
                      />
                    )}
                    {(selectedScenario === 'all' || selectedScenario === 'aggressive') && (
                      <Area 
                        type="monotone" 
                        dataKey="aggressive" 
                        name="Aggressive"
                        stroke={scenarios.aggressive.color}
                        fill={`url(#gradient-aggressive)`}
                        strokeWidth={2}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Dividend Income Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Annual Dividend Income Projection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="year" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(v) => `Yr ${v}`}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="dividendsNoReinvest" name="No Reinvest" fill={scenarios.noReinvest.color} />
                    <Bar dataKey="dividendsConservative" name="Conservative" fill={scenarios.conservative.color} />
                    <Bar dataKey="dividendsDrip" name="DRIP" fill={scenarios.drip.color} />
                    <Bar dataKey="dividendsAggressive" name="Aggressive" fill={scenarios.aggressive.color} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          {/* Custom Scenario Controls */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Investment Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Monthly Contribution</Label>
                    <span className="text-sm font-medium">${monthlyContribution}</span>
                  </div>
                  <Slider
                    value={[monthlyContribution]}
                    onValueChange={(v) => setMonthlyContribution(v[0])}
                    min={0}
                    max={5000}
                    step={50}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Dividend Reinvestment %</Label>
                    <span className="text-sm font-medium">{customReinvestPercent}%</span>
                  </div>
                  <Slider
                    value={[customReinvestPercent]}
                    onValueChange={(v) => setCustomReinvestPercent(v[0])}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Enable DRIP</Label>
                  <Switch checked={enableDrip} onCheckedChange={setEnableDrip} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Growth Assumptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Dividend Growth Rate</Label>
                    <span className="text-sm font-medium">{dividendGrowthRate}%</span>
                  </div>
                  <Slider
                    value={[dividendGrowthRate]}
                    onValueChange={(v) => setDividendGrowthRate(v[0])}
                    min={0}
                    max={15}
                    step={0.5}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Price Appreciation Rate</Label>
                    <span className="text-sm font-medium">{priceGrowthRate}%</span>
                  </div>
                  <Slider
                    value={[priceGrowthRate]}
                    onValueChange={(v) => setPriceGrowthRate(v[0])}
                    min={0}
                    max={15}
                    step={0.5}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Projection Period</Label>
                    <span className="text-sm font-medium">{projectionYears} years</span>
                  </div>
                  <Slider
                    value={[projectionYears]}
                    onValueChange={(v) => setProjectionYears(v[0])}
                    min={5}
                    max={40}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Custom Projection Results */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Final Portfolio Value</p>
                <p className="text-2xl font-bold text-primary">
                  ${finalSummary?.custom.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Annual Dividends (Final Year)</p>
                <p className="text-2xl font-bold text-emerald-500">
                  ${finalSummary?.custom.annualDividends.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Dividends Received</p>
                <p className="text-2xl font-bold text-blue-500">
                  ${finalSummary?.custom.totalDividends.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Contributions</p>
                <p className="text-2xl font-bold">
                  ${(monthlyContribution * 12 * projectionYears).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Custom Projection Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Scenario Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={customProjection}>
                    <defs>
                      <linearGradient id="customGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="year" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(v) => `Yr ${v}`}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="value" 
                      name="Portfolio Value"
                      stroke="hsl(var(--primary))"
                      fill="url(#customGradient)"
                      strokeWidth={2}
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="dividends" 
                      name="Annual Dividends" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="cumDividends" 
                      name="Cumulative Dividends"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
