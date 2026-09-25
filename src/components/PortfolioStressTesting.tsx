import { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { AlertTriangle, TrendingDown, Shield, Zap, Activity, DollarSign, RefreshCw, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface StressScenario {
  id: string;
  name: string;
  description: string;
  marketDrop: number;
  sectorImpacts: Record<string, number>;
  historicalDate?: string;
}

const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'custom',
    name: 'Custom Scenario',
    description: 'Define your own market drop percentage',
    marketDrop: -20,
    sectorImpacts: {},
  },
  {
    id: 'moderate_correction',
    name: 'Moderate Correction (-10%)',
    description: 'A typical market correction',
    marketDrop: -10,
    sectorImpacts: { Technology: -12, Healthcare: -8, Financial: -11, 'Consumer Discretionary': -13, Energy: -9, Utilities: -5 },
  },
  {
    id: 'bear_market',
    name: 'Bear Market (-20%)',
    description: 'Standard bear market decline',
    marketDrop: -20,
    sectorImpacts: { Technology: -25, Healthcare: -15, Financial: -22, 'Consumer Discretionary': -28, Energy: -18, Utilities: -10 },
  },
  {
    id: 'covid_crash',
    name: '2020 COVID Crash (-34%)',
    description: 'March 2020 pandemic sell-off',
    marketDrop: -34,
    sectorImpacts: { Technology: -28, Healthcare: -20, Financial: -40, 'Consumer Discretionary': -45, Energy: -55, Utilities: -25, 'Real Estate': -35 },
    historicalDate: 'Feb-Mar 2020',
  },
  {
    id: 'financial_crisis',
    name: '2008 Financial Crisis (-57%)',
    description: 'Global financial meltdown',
    marketDrop: -57,
    sectorImpacts: { Technology: -50, Healthcare: -35, Financial: -75, 'Consumer Discretionary': -55, Energy: -45, Utilities: -30, 'Real Estate': -65 },
    historicalDate: 'Oct 2007-Mar 2009',
  },
  {
    id: 'dot_com',
    name: '2000 Dot-Com Crash (-49%)',
    description: 'Tech bubble burst',
    marketDrop: -49,
    sectorImpacts: { Technology: -78, Healthcare: -20, Financial: -35, 'Consumer Discretionary': -40, Energy: -25, Utilities: -20 },
    historicalDate: 'Mar 2000-Oct 2002',
  },
  {
    id: 'rate_hike',
    name: 'Aggressive Rate Hikes (-25%)',
    description: 'Fed raising rates rapidly',
    marketDrop: -25,
    sectorImpacts: { Technology: -35, Healthcare: -18, Financial: -15, 'Consumer Discretionary': -30, Energy: -20, Utilities: -15, 'Real Estate': -40 },
  },
  {
    id: 'recession',
    name: 'Deep Recession (-40%)',
    description: 'Prolonged economic contraction',
    marketDrop: -40,
    sectorImpacts: { Technology: -35, Healthcare: -25, Financial: -50, 'Consumer Discretionary': -55, Energy: -40, Utilities: -15, Industrials: -45 },
  },
];

export const PortfolioStressTesting = () => {
  const { activePortfolio } = usePortfolio();
  const [selectedScenario, setSelectedScenario] = useState<string>('bear_market');
  const [customDrop, setCustomDrop] = useState<number>(20);

  const scenario = STRESS_SCENARIOS.find(s => s.id === selectedScenario) || STRESS_SCENARIOS[0];

  // Calculate portfolio value and stress test results
  const stressResults = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const cashBalance = activePortfolio?.cashBalance || 0;
    
    const currentValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
    const totalValue = currentValue + cashBalance;

    const marketDrop = selectedScenario === 'custom' ? -customDrop : scenario.marketDrop;
    const sectorImpacts = scenario.sectorImpacts;

    // Calculate impact per holding
    const holdingImpacts = holdings.map(h => {
      const value = h.shares * h.currentPrice;
      const sector = h.sector || 'Other';
      const sectorDrop = sectorImpacts[sector] || marketDrop;
      const impactPercent = sectorDrop / 100;
      const impactValue = value * impactPercent;
      const newValue = value + impactValue;

      return {
        symbol: h.symbol,
        name: h.name,
        sector,
        currentValue: value,
        impactPercent: sectorDrop,
        impactValue,
        newValue,
        allocation: (value / currentValue) * 100,
      };
    });

    // Calculate total portfolio impact
    const totalImpact = holdingImpacts.reduce((sum, h) => sum + h.impactValue, 0);
    const stressedPortfolioValue = currentValue + totalImpact + cashBalance;
    const portfolioDropPercent = currentValue > 0 ? (totalImpact / currentValue) * 100 : 0;

    // Calculate sector breakdown
    const sectorBreakdown: Record<string, { value: number; impact: number }> = {};
    holdingImpacts.forEach(h => {
      if (!sectorBreakdown[h.sector]) {
        sectorBreakdown[h.sector] = { value: 0, impact: 0 };
      }
      sectorBreakdown[h.sector].value += h.currentValue;
      sectorBreakdown[h.sector].impact += h.impactValue;
    });

    const sectorData = Object.entries(sectorBreakdown).map(([sector, data]) => ({
      sector,
      currentValue: data.value,
      stressedValue: data.value + data.impact,
      impact: data.impact,
      impactPercent: (data.impact / data.value) * 100,
    })).sort((a, b) => a.impact - b.impact);

    // Risk metrics
    const maxDrawdown = Math.min(...holdingImpacts.map(h => h.impactPercent));
    const beta = Math.abs(portfolioDropPercent / marketDrop);
    const cashCushion = (cashBalance / totalValue) * 100;

    return {
      currentValue: totalValue,
      stressedValue: stressedPortfolioValue,
      totalImpact,
      portfolioDropPercent,
      marketDrop,
      holdingImpacts: holdingImpacts.sort((a, b) => a.impactPercent - b.impactPercent),
      sectorData,
      maxDrawdown,
      beta,
      cashCushion,
      cashProtected: cashBalance,
    };
  }, [activePortfolio, selectedScenario, customDrop, scenario]);

  // Scenario comparison chart data
  const scenarioComparison = STRESS_SCENARIOS.filter(s => s.id !== 'custom').map(s => ({
    name: s.name.split(' ')[0],
    marketDrop: Math.abs(s.marketDrop),
    portfolioDrop: Math.abs(stressResults.portfolioDropPercent * (s.marketDrop / scenario.marketDrop)),
  }));

  const getRiskLevel = (drop: number) => {
    const absDroppct = Math.abs(drop);
    if (absDroppct >= 40) return { level: 'Severe', color: 'text-red-500', bg: 'bg-red-500' };
    if (absDroppct >= 25) return { level: 'High', color: 'text-orange-500', bg: 'bg-orange-500' };
    if (absDroppct >= 15) return { level: 'Moderate', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { level: 'Low', color: 'text-green-500', bg: 'bg-green-500' };
  };

  const risk = getRiskLevel(stressResults.portfolioDropPercent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Portfolio Stress Testing
          </h2>
          <p className="text-sm text-muted-foreground">Simulate how your portfolio would perform during market crashes</p>
        </div>
        <Select value={selectedScenario} onValueChange={setSelectedScenario}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRESS_SCENARIOS.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom Slider */}
      {selectedScenario === 'custom' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-lg font-medium">Custom Market Drop</Label>
                <Badge variant="destructive" className="text-lg px-3">-{customDrop}%</Badge>
              </div>
              <Slider
                value={[customDrop]}
                onValueChange={(v) => setCustomDrop(v[0])}
                min={5}
                max={70}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>-5% (Minor)</span>
                <span>-70% (Catastrophic)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario Description */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{scenario.name}:</strong> {scenario.description}
          {scenario.historicalDate && <span className="ml-2 text-muted-foreground">({scenario.historicalDate})</span>}
        </AlertDescription>
      </Alert>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Portfolio Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stressResults.portfolioDropPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              -${Math.abs(stressResults.totalImpact).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stressed Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stressResults.stressedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From ${stressResults.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Portfolio Beta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stressResults.beta > 1 ? 'text-red-500' : 'text-green-500'}`}>
              {stressResults.beta.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stressResults.beta > 1 ? 'More volatile than market' : 'Less volatile than market'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cash Protected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${stressResults.cashProtected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stressResults.cashCushion.toFixed(1)}% cash cushion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold ${risk.color}`}>
              {risk.level}
            </div>
            <div className="flex-1">
              <Progress 
                value={Math.min(Math.abs(stressResults.portfolioDropPercent), 100)} 
                className="h-4"
              />
            </div>
            <Badge className={risk.bg}>
              {Math.abs(stressResults.portfolioDropPercent).toFixed(1)}% Loss
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Max Single Stock Drop</p>
              <p className="font-bold text-red-500">{stressResults.maxDrawdown.toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Market Scenario</p>
              <p className="font-bold">{stressResults.marketDrop}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Recovery Needed</p>
              <p className="font-bold text-green-500">
                +{((1 / (1 + stressResults.portfolioDropPercent / 100) - 1) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sector Impact Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sector Impact Analysis</CardTitle>
          <CardDescription>How each sector would be affected in this scenario</CardDescription>
        </CardHeader>
        <CardContent>
          {stressResults.sectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stressResults.sectorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="sector" width={120} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                    name === 'currentValue' ? 'Current' : 'After Stress'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="currentValue" name="Current Value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="stressedValue" name="Stressed Value" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No holdings to analyze
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Holdings Impact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Holdings Impact Detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stressResults.holdingImpacts.length > 0 ? (
            <div className="space-y-3">
              {stressResults.holdingImpacts.slice(0, 10).map(holding => (
                <div key={holding.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium">{holding.symbol}</div>
                      <div className="text-xs text-muted-foreground">{holding.sector}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Current</div>
                      <div className="font-medium">${holding.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Impact</div>
                      <div className="font-medium text-red-500">{holding.impactPercent.toFixed(1)}%</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">After</div>
                      <div className="font-medium">${holding.newValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No holdings to stress test</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Import Label for the custom scenario slider
import { Label } from './ui/label';
