import { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, ArrowRight, Lightbulb, Target, AlertTriangle, Zap, Shield } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

// Sector performance simulation based on market cycles
const SECTOR_CYCLE_DATA: Record<string, { phase: string; momentum: number; recommendation: 'overweight' | 'neutral' | 'underweight' }> = {
  'Technology': { phase: 'expansion', momentum: 75, recommendation: 'overweight' },
  'Healthcare': { phase: 'stable', momentum: 60, recommendation: 'neutral' },
  'Financial': { phase: 'expansion', momentum: 68, recommendation: 'overweight' },
  'Consumer Discretionary': { phase: 'late-cycle', momentum: 45, recommendation: 'underweight' },
  'Consumer Staples': { phase: 'defensive', momentum: 55, recommendation: 'neutral' },
  'Energy': { phase: 'recovery', momentum: 70, recommendation: 'overweight' },
  'Utilities': { phase: 'defensive', momentum: 40, recommendation: 'underweight' },
  'Real Estate': { phase: 'contraction', momentum: 35, recommendation: 'underweight' },
  'Materials': { phase: 'recovery', momentum: 65, recommendation: 'neutral' },
  'Industrials': { phase: 'expansion', momentum: 72, recommendation: 'overweight' },
  'Communication': { phase: 'stable', momentum: 58, recommendation: 'neutral' },
};

interface SectorAnalysis {
  sector: string;
  currentAllocation: number;
  targetAllocation: number;
  momentum: number;
  recommendation: 'overweight' | 'neutral' | 'underweight';
  phase: string;
  action: 'buy' | 'sell' | 'hold';
  delta: number;
}

export const SectorRotationAnalysis = () => {
  const { activePortfolio } = usePortfolio();
  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate sector allocations and generate recommendations
  const analysis = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);

    // Calculate current sector allocations
    const sectorAllocations: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Other';
      const value = h.shares * h.currentPrice;
      sectorAllocations[sector] = (sectorAllocations[sector] || 0) + value;
    });

    // Generate analysis for each sector
    const sectorAnalysis: SectorAnalysis[] = Object.keys(SECTOR_CYCLE_DATA).map(sector => {
      const currentValue = sectorAllocations[sector] || 0;
      const currentAllocation = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const cycleData = SECTOR_CYCLE_DATA[sector];
      
      // Calculate target allocation based on momentum
      let targetAllocation = 10; // Base 10%
      if (cycleData.recommendation === 'overweight') {
        targetAllocation = 15 + (cycleData.momentum - 60) * 0.2;
      } else if (cycleData.recommendation === 'underweight') {
        targetAllocation = 5 + (cycleData.momentum - 30) * 0.1;
      }

      const delta = targetAllocation - currentAllocation;
      let action: 'buy' | 'sell' | 'hold' = 'hold';
      if (delta > 3) action = 'buy';
      else if (delta < -3) action = 'sell';

      return {
        sector,
        currentAllocation,
        targetAllocation,
        momentum: cycleData.momentum,
        recommendation: cycleData.recommendation,
        phase: cycleData.phase,
        action,
        delta,
      };
    });

    // Sort by recommendation priority (overweight first)
    return sectorAnalysis.sort((a, b) => {
      const order = { overweight: 0, neutral: 1, underweight: 2 };
      return order[a.recommendation] - order[b.recommendation];
    });
  }, [activePortfolio, refreshKey]);

  // Top recommendations
  const buyRecommendations = analysis.filter(a => a.action === 'buy').slice(0, 3);
  const sellRecommendations = analysis.filter(a => a.action === 'sell').slice(0, 3);

  // Radar chart data for sector momentum
  const radarData = analysis.map(a => ({
    sector: a.sector.replace(' ', '\n').substring(0, 12),
    momentum: a.momentum,
    allocation: a.currentAllocation * 5, // Scale for visibility
  }));

  // Bar chart data for allocation comparison
  const barData = analysis.slice(0, 8).map(a => ({
    sector: a.sector.length > 10 ? a.sector.substring(0, 10) + '...' : a.sector,
    current: a.currentAllocation,
    target: a.targetAllocation,
  }));

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'expansion': return 'text-green-500 bg-green-500/10';
      case 'recovery': return 'text-emerald-500 bg-emerald-500/10';
      case 'stable': return 'text-blue-500 bg-blue-500/10';
      case 'late-cycle': return 'text-yellow-500 bg-yellow-500/10';
      case 'defensive': return 'text-orange-500 bg-orange-500/10';
      case 'contraction': return 'text-red-500 bg-red-500/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getMomentumColor = (momentum: number) => {
    if (momentum >= 70) return 'text-green-500';
    if (momentum >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Sector Rotation Analysis
          </h2>
          <p className="text-sm text-muted-foreground">Identify outperforming sectors and reallocation opportunities</p>
        </div>
        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Analysis
        </Button>
      </div>

      {/* Quick Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sectors to Buy */}
        <Card className="border-green-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-green-500">
              <TrendingUp className="w-5 h-5" />
              Sectors to Increase
            </CardTitle>
          </CardHeader>
          <CardContent>
            {buyRecommendations.length > 0 ? (
              <div className="space-y-3">
                {buyRecommendations.map(rec => (
                  <div key={rec.sector} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5">
                    <div>
                      <span className="font-medium">{rec.sector}</span>
                      <div className="text-sm text-muted-foreground">
                        {rec.currentAllocation.toFixed(1)}% → {rec.targetAllocation.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className={getPhaseColor(rec.phase)}>
                        {rec.phase}
                      </Badge>
                      <div className={`text-sm font-medium ${getMomentumColor(rec.momentum)}`}>
                        Momentum: {rec.momentum}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No buy recommendations at this time</p>
            )}
          </CardContent>
        </Card>

        {/* Sectors to Reduce */}
        <Card className="border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-500">
              <TrendingDown className="w-5 h-5" />
              Sectors to Reduce
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellRecommendations.length > 0 ? (
              <div className="space-y-3">
                {sellRecommendations.map(rec => (
                  <div key={rec.sector} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5">
                    <div>
                      <span className="font-medium">{rec.sector}</span>
                      <div className="text-sm text-muted-foreground">
                        {rec.currentAllocation.toFixed(1)}% → {rec.targetAllocation.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className={getPhaseColor(rec.phase)}>
                        {rec.phase}
                      </Badge>
                      <div className={`text-sm font-medium ${getMomentumColor(rec.momentum)}`}>
                        Momentum: {rec.momentum}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No sell recommendations at this time</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocation Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Current vs Target Allocation
          </CardTitle>
          <CardDescription>Compare your sector weights against recommended targets</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="sector" width={100} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => `${value.toFixed(1)}%`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="current" name="Current" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="target" name="Target" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Sector Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Detailed Sector Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysis.map(sector => (
              <div 
                key={sector.sector}
                className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold">{sector.sector}</span>
                      <Badge variant="secondary" className={getPhaseColor(sector.phase)}>
                        {sector.phase}
                      </Badge>
                      <Badge 
                        variant={sector.recommendation === 'overweight' ? 'default' : 'outline'}
                        className={
                          sector.recommendation === 'overweight' ? 'bg-green-500' :
                          sector.recommendation === 'underweight' ? 'bg-red-500 text-white' : ''
                        }
                      >
                        {sector.recommendation}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span>Current: <strong>{sector.currentAllocation.toFixed(1)}%</strong></span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span>Target: <strong>{sector.targetAllocation.toFixed(1)}%</strong></span>
                      <span className={sector.delta > 0 ? 'text-green-500' : sector.delta < 0 ? 'text-red-500' : 'text-muted-foreground'}>
                        ({sector.delta > 0 ? '+' : ''}{sector.delta.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">Momentum</div>
                      <div className="flex items-center gap-2">
                        <Progress value={sector.momentum} className="w-20 h-2" />
                        <span className={`text-sm font-medium ${getMomentumColor(sector.momentum)}`}>
                          {sector.momentum}
                        </span>
                      </div>
                    </div>
                    {sector.action !== 'hold' && (
                      <Button 
                        size="sm" 
                        variant={sector.action === 'buy' ? 'default' : 'destructive'}
                      >
                        {sector.action === 'buy' ? 'Add' : 'Reduce'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Cycle Info */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>About Sector Rotation:</strong> Different sectors perform better during different phases of the economic cycle. 
          Technology and Financials typically lead during expansion, while Utilities and Consumer Staples are defensive plays during contraction.
          These recommendations are based on current market cycle indicators and should be used as guidance alongside your own research.
        </AlertDescription>
      </Alert>
    </div>
  );
};
