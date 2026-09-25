import React, { useMemo, useState, useEffect } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { cleanSymbol } from '@/lib/utils';
import { 
  AlertTriangle, 
  Shield, 
  PieChart, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Info,
  Activity,
  BarChart3,
  Target,
  GitBranch,
  FlaskConical
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PortfolioStressTesting } from './PortfolioStressTesting';
import { DividendSafetyScore } from './DividendSafetyScore';
import { SectorRotationAnalysis } from './SectorRotationAnalysis';
import { CorrelationMatrix } from './CorrelationMatrix';
import { Skeleton } from './ui/skeleton';


interface RiskWarning {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: string;
}

const SECTOR_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 80%, 55%)',
  'hsl(160, 70%, 45%)',
  'hsl(45, 90%, 55%)',
  'hsl(340, 75%, 55%)',
  'hsl(270, 60%, 55%)',
  'hsl(190, 70%, 50%)',
  'hsl(20, 85%, 55%)',
  'hsl(100, 60%, 45%)',
  'hsl(300, 50%, 50%)',
  'hsl(230, 55%, 60%)',
  'hsl(0, 70%, 55%)',
];

// Stable sector → color mapping: the same sector always gets the same color,
// regardless of ordering or which symbols are currently held.
export const colorForSector = (sector: string): string => {
  const key = (sector || 'Unknown').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return SECTOR_COLORS[hash % SECTOR_COLORS.length];
};

export const RiskAnalysisView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio, loadingPortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];

  const [activeTab, setActiveTab] = useState('overview');
  const [sectorUpdatedAt, setSectorUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!loadingPortfolio) setSectorUpdatedAt(new Date());
  }, [loadingPortfolio, holdings.length]);

  const riskAnalysis = useMemo(() => {
    if (holdings.length === 0) {
      return {
        sectorConcentration: [],
        positionConcentration: [],
        diversificationScore: 0,
        warnings: [],
        riskLevel: 'unknown' as const
      };
    }

    const totalValue = holdings.reduce((sum, h) => {
      const price = h.currentPrice || h.avgPrice;
      return sum + (price * h.shares);
    }, 0);

    const sectorMap = new Map<string, number>();
    holdings.forEach(h => {
      const sector = h.sector || 'Unknown';
      const price = h.currentPrice || h.avgPrice;
      const value = price * h.shares;
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    });

    const sectorConcentration = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    const positionConcentration = holdings
      .map(h => {
        const price = h.currentPrice || h.avgPrice;
        const value = price * h.shares;
        return {
          symbol: cleanSymbol(h.symbol),
          name: h.name,
          value,
          percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    let diversificationScore = 0;
    const holdingsCountScore = Math.min(holdings.length * 3, 30);
    diversificationScore += holdingsCountScore;

    const sectorCount = sectorMap.size;
    const sectorSpreadScore = Math.min(sectorCount * 5, 35);
    diversificationScore += sectorSpreadScore;

    const topHoldingPct = positionConcentration[0]?.percentage || 0;
    const concentrationScore = Math.max(0, 35 - (topHoldingPct - 10) * 1.5);
    diversificationScore += concentrationScore;

    diversificationScore = Math.min(100, Math.max(0, diversificationScore));

    const warnings: RiskWarning[] = [];

    positionConcentration.forEach((pos, idx) => {
      if (pos.percentage > 25) {
        warnings.push({
          id: `pos-${idx}`,
          type: 'critical',
          title: 'High Position Concentration',
          description: `${pos.symbol} represents ${pos.percentage.toFixed(1)}% of your portfolio. Consider reducing to below 25%.`,
          metric: `${pos.percentage.toFixed(1)}%`
        });
      } else if (pos.percentage > 15) {
        warnings.push({
          id: `pos-${idx}`,
          type: 'warning',
          title: 'Elevated Position Size',
          description: `${pos.symbol} represents ${pos.percentage.toFixed(1)}% of your portfolio.`,
          metric: `${pos.percentage.toFixed(1)}%`
        });
      }
    });

    sectorConcentration.forEach((sec, idx) => {
      if (sec.percentage > 40) {
        warnings.push({
          id: `sec-${idx}`,
          type: 'critical',
          title: 'Sector Over-Concentration',
          description: `${sec.sector} sector is ${sec.percentage.toFixed(1)}% of portfolio. High risk if sector underperforms.`,
          metric: `${sec.percentage.toFixed(1)}%`
        });
      } else if (sec.percentage > 30) {
        warnings.push({
          id: `sec-${idx}`,
          type: 'warning',
          title: 'High Sector Allocation',
          description: `${sec.sector} sector at ${sec.percentage.toFixed(1)}%. Consider diversifying.`,
          metric: `${sec.percentage.toFixed(1)}%`
        });
      }
    });

    if (holdings.length < 5) {
      warnings.push({
        id: 'low-holdings',
        type: 'warning',
        title: 'Low Number of Holdings',
        description: `Only ${holdings.length} holdings. Consider adding more positions for better diversification.`,
        metric: `${holdings.length} holdings`
      });
    }

    const unknownSectorPct = sectorConcentration.find(s => s.sector === 'Unknown')?.percentage || 0;
    if (unknownSectorPct > 20) {
      warnings.push({
        id: 'unknown-sectors',
        type: 'info',
        title: 'Missing Sector Data',
        description: `${unknownSectorPct.toFixed(1)}% of holdings have no sector data. Fetch market data to improve analysis.`,
        metric: `${unknownSectorPct.toFixed(1)}%`
      });
    }

    const criticalCount = warnings.filter(w => w.type === 'critical').length;
    const warningCount = warnings.filter(w => w.type === 'warning').length;
    
    let riskLevel: 'low' | 'moderate' | 'high' | 'critical' | 'unknown' = 'low';
    if (criticalCount > 0) riskLevel = 'critical';
    else if (warningCount > 1) riskLevel = 'high';
    else if (warningCount > 0 || diversificationScore < 50) riskLevel = 'moderate';

    return {
      sectorConcentration,
      positionConcentration,
      diversificationScore,
      warnings,
      riskLevel
    };
  }, [holdings]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'moderate': return 'text-amber-500';
      case 'low': return 'text-emerald-500';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'moderate': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getWarningIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    }
  };

  const sectorChartData = riskAnalysis.sectorConcentration.map((s) => ({
    name: s.sector,
    value: s.percentage,
    fill: colorForSector(s.sector)
  }));


  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Risk Analysis</h2>
            <p className="text-sm text-muted-foreground">Portfolio concentration and diversification metrics</p>
          </div>
        </div>
        
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-foreground">No Holdings to Analyze</p>
            <p className="text-sm text-muted-foreground">Add holdings to your portfolio to see risk analysis</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Indicator */}
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample risk analysis. Sign in to analyze your real portfolio risk.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Risk Analysis Center</h2>
            <p className="text-sm text-muted-foreground">Comprehensive portfolio risk assessment and stress testing</p>
          </div>
        </div>
        <Badge variant="outline" className={getRiskBadgeVariant(riskAnalysis.riskLevel)}>
          {riskAnalysis.riskLevel.charAt(0).toUpperCase() + riskAnalysis.riskLevel.slice(1)} Risk
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Diversification Score</p>
                <p className={`text-3xl font-bold ${getRiskColor(riskAnalysis.riskLevel)}`}>
                  {riskAnalysis.diversificationScore.toFixed(0)}/100
                </p>
              </div>
              <Shield className={`w-8 h-8 ${getRiskColor(riskAnalysis.riskLevel)}`} />
            </div>
            <Progress value={riskAnalysis.diversificationScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {riskAnalysis.diversificationScore >= 70 ? 'Well diversified' :
               riskAnalysis.diversificationScore >= 50 ? 'Moderate diversification' :
               'Needs improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Sector Count</p>
                <p className="text-3xl font-bold text-foreground">
                  {riskAnalysis.sectorConcentration.length}
                </p>
              </div>
              <PieChart className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              Top: {riskAnalysis.sectorConcentration[0]?.sector || 'N/A'} ({riskAnalysis.sectorConcentration[0]?.percentage.toFixed(1) || 0}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Largest Position</p>
                <p className="text-3xl font-bold text-foreground">
                  {riskAnalysis.positionConcentration[0]?.percentage.toFixed(1) || 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              {riskAnalysis.positionConcentration[0]?.symbol || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Risk Analysis Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview" className="gap-1">
            <Shield className="w-3 h-3" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="stress-testing" className="gap-1">
            <Activity className="w-3 h-3" />
            Stress Testing
          </TabsTrigger>
          <TabsTrigger value="correlation" className="gap-1">
            <GitBranch className="w-3 h-3" />
            Correlation
          </TabsTrigger>
          <TabsTrigger value="safety-scores" className="gap-1">
            <Target className="w-3 h-3" />
            Safety Scores
          </TabsTrigger>
          <TabsTrigger value="sector-rotation" className="gap-1">
            <BarChart3 className="w-3 h-3" />
            Sector Rotation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Warnings */}
          {riskAnalysis.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Risk Warnings ({riskAnalysis.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {riskAnalysis.warnings.map(warning => (
                  <div 
                    key={warning.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      warning.type === 'critical' ? 'bg-red-500/5 border-red-500/20' :
                      warning.type === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                      'bg-blue-500/5 border-blue-500/20'
                    }`}
                  >
                    {getWarningIcon(warning.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground">{warning.title}</h4>
                        {warning.metric && (
                          <Badge variant="outline">{warning.metric}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{warning.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {sectorChartData.length === 0 ? (
                  <div className="h-[300px] flex flex-col items-center justify-center text-center gap-2">
                    <p className="text-sm font-medium text-foreground">No sector data available</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Sector information couldn't be loaded for your holdings. Refresh market data to populate this chart.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={sectorChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={1}
                            dataKey="value"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                              if (value < 5) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 1.45;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="hsl(var(--foreground))"
                                  textAnchor={x > cx ? 'start' : 'end'}
                                  dominantBaseline="central"
                                  fontSize={11}
                                  fontWeight={600}
                                >
                                  {`${value.toFixed(1)}%`}
                                </text>
                              );
                            }}
                            labelLine={false}
                          >
                            {sectorChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} stroke="hsl(var(--background))" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                            contentStyle={{
                              background: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '0.5rem',
                              color: 'hsl(var(--popover-foreground))',
                            }}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend — includes small slices hidden from the chart labels */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2" data-testid="sector-legend">
                      {loadingPortfolio
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <div key={`sk-${i}`} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <Skeleton className="w-2.5 h-2.5 rounded-sm shrink-0" />
                                <Skeleton className="h-3 w-20" />
                              </div>
                              <Skeleton className="h-3 w-8 shrink-0" />
                            </div>
                          ))
                        : sectorChartData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: entry.fill }} />
                            <span className="truncate text-muted-foreground">{entry.name}</span>
                          </div>
                          <span className="font-medium text-foreground shrink-0">{entry.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                    {sectorUpdatedAt && !loadingPortfolio && (
                      <p className="text-[10px] text-muted-foreground/80 mt-2" data-testid="sector-last-updated">
                        Last updated {sectorUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    )}
                  </>
                )}
              </CardContent>

            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Holdings by Weight</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {riskAnalysis.positionConcentration.slice(0, 10).map((pos, idx) => (
                    <div key={pos.symbol}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="font-medium text-foreground">{pos.symbol}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">{pos.name}</span>
                        </div>
                        <span className={`font-semibold ${pos.percentage > 20 ? 'text-red-500' : pos.percentage > 10 ? 'text-amber-500' : 'text-foreground'}`}>
                          {pos.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress 
                        value={pos.percentage} 
                        className={`h-2 ${pos.percentage > 20 ? '[&>div]:bg-red-500' : pos.percentage > 10 ? '[&>div]:bg-amber-500' : ''}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sector Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sector Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sector</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Value</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Weight</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskAnalysis.sectorConcentration.map((sector, idx) => (
                      <tr key={sector.sector} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: colorForSector(sector.sector) }}
                            />
                            <span className="font-medium text-foreground">{sector.sector}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          ${sector.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-foreground">
                          {sector.percentage.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4">
                          {sector.percentage > 40 ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                              Over-concentrated
                            </Badge>
                          ) : sector.percentage > 30 ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                              High
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              Healthy
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stress-testing">
          <PortfolioStressTesting />
        </TabsContent>

        <TabsContent value="correlation">
          <CorrelationMatrix />
        </TabsContent>

        <TabsContent value="safety-scores">
          <DividendSafetyScore />
        </TabsContent>

        <TabsContent value="sector-rotation">
          <SectorRotationAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RiskAnalysisView;
