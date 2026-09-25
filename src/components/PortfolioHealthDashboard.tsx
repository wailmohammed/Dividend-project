import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Treemap } from 'recharts';
import { Layers, Snowflake, FileText, TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle, Target, PieChart as PieIcon, Building2, Globe, Newspaper, Calendar } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { SnowflakeScore } from '@/types';
import { format, subDays } from 'date-fns';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(328, 85%, 57%)',
  'hsl(45, 93%, 47%)',
  'hsl(173, 80%, 40%)',
  'hsl(280, 67%, 44%)',
];

interface TreemapContentProps {
  x?: number; y?: number; width?: number; height?: number; name?: string; value?: number; index?: number;
}

const MiniTreemapContent: React.FC<TreemapContentProps> = ({ x = 0, y = 0, width = 0, height = 0, name = '', value = 0, index = 0 }) => {
  if (width < 30 || height < 25) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} rx={3} />
      {width > 50 && height > 35 && (
        <>
          <text x={x + 6} y={y + 15} fill="white" fontSize={11} fontWeight="bold">{name}</text>
          <text x={x + 6} y={y + 28} fill="rgba(255,255,255,0.8)" fontSize={9}>{value.toFixed(1)}%</text>
        </>
      )}
    </g>
  );
};

const PortfolioHealthDashboard: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.avgPrice, 0);
  const totalGainPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  // --- Snowflake ---
  const aggregatedScore: SnowflakeScore = useMemo(() => {
    if (holdings.length === 0) return { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    const weighted = holdings.reduce(
      (acc, h) => {
        const weight = totalValue > 0 ? (h.shares * h.currentPrice) / totalValue : 1 / holdings.length;
        acc.value += h.snowflake.value * weight;
        acc.future += h.snowflake.future * weight;
        acc.past += h.snowflake.past * weight;
        acc.health += h.snowflake.health * weight;
        acc.dividend += h.snowflake.dividend * weight;
        return acc;
      },
      { value: 0, future: 0, past: 0, health: 0, dividend: 0 }
    );
    const total = weighted.value + weighted.future + weighted.past + weighted.health + weighted.dividend;
    return { ...weighted, total };
  }, [holdings, totalValue]);

  const chartData = [
    { subject: 'Value', score: aggregatedScore.value, fullMark: 5 },
    { subject: 'Future', score: aggregatedScore.future, fullMark: 5 },
    { subject: 'Past', score: aggregatedScore.past, fullMark: 5 },
    { subject: 'Health', score: aggregatedScore.health, fullMark: 5 },
    { subject: 'Dividend', score: aggregatedScore.dividend, fullMark: 5 },
  ];

  const getScoreLabel = (score: number) => {
    if (score >= 4) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (score >= 3) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 2) return { label: 'Average', color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Weak', color: 'text-red-600 dark:text-red-400' };
  };

  const totalLabel = getScoreLabel(aggregatedScore.total / 5);

  // --- Diversification ---
  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Unknown';
      map[sector] = (map[sector] || 0) + h.shares * h.currentPrice;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const countryData = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach(h => {
      map[h.country || 'US'] = (map[h.country || 'US'] || 0) + h.shares * h.currentPrice;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const treemapData = sectorData.map(s => ({ name: s.name, size: s.pct }));

  // --- Weekly Insights ---
  const today = new Date();
  const weekStart = subDays(today, 7);

  const insights = useMemo(() => {
    const items: { icon: React.ReactNode; title: string; body: string; type: 'positive' | 'negative' | 'neutral' }[] = [];

    const sorted = [...holdings].sort((a, b) => {
      const aRet = (a.currentPrice - a.avgPrice) / a.avgPrice;
      const bRet = (b.currentPrice - b.avgPrice) / b.avgPrice;
      return bRet - aRet;
    });

    if (sorted.length >= 1) {
      const best = sorted[0];
      const bestRet = ((best.currentPrice - best.avgPrice) / best.avgPrice * 100);
      items.push({
        icon: <TrendingUp className="w-4 h-4" />,
        title: 'Top Performer',
        body: `${best.symbol} leads with a ${bestRet.toFixed(1)}% return.`,
        type: 'positive',
      });
    }

    if (sorted.length >= 2) {
      const worst = sorted[sorted.length - 1];
      const worstRet = ((worst.currentPrice - worst.avgPrice) / worst.avgPrice * 100);
      if (worstRet < 0) {
        items.push({
          icon: <TrendingDown className="w-4 h-4" />,
          title: 'Biggest Laggard',
          body: `${worst.symbol} is down ${Math.abs(worstRet).toFixed(1)}% from cost basis.`,
          type: 'negative',
        });
      }
    }

    const divHoldings = holdings.filter(h => h.dividendYield > 0);
    if (divHoldings.length > 0) {
      const estAnnualIncome = divHoldings.reduce((s, h) => s + h.shares * h.currentPrice * (h.dividendYield / 100), 0);
      items.push({
        icon: <DollarSign className="w-4 h-4" />,
        title: 'Dividend Income',
        body: `Est. annual income: $${estAnnualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} from ${divHoldings.length} payers.`,
        type: 'positive',
      });
    }

    const unhealthyCount = holdings.filter(h => h.snowflake.health < 3).length;
    if (unhealthyCount > 0) {
      items.push({
        icon: <AlertTriangle className="w-4 h-4" />,
        title: 'Health Concerns',
        body: `${unhealthyCount} holding${unhealthyCount > 1 ? 's have' : ' has'} below-average financial health.`,
        type: 'negative',
      });
    } else if (holdings.length > 0) {
      items.push({
        icon: <CheckCircle className="w-4 h-4" />,
        title: 'Healthy Portfolio',
        body: 'All holdings have solid financial health scores.',
        type: 'positive',
      });
    }

    return items;
  }, [holdings, totalValue]);

  const typeColors = {
    positive: 'border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/5',
    negative: 'border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5',
    neutral: 'border-muted bg-muted/30',
  };

  const typeIconColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  };

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Health Dashboard</h2>
          <p className="text-muted-foreground">Add holdings to see your portfolio health overview</p>
        </div>
      </div>
    );
  }

  const renderPie = (data: { name: string; value: number; pct: number }[], title: string, icon: React.ReactNode) => (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">{icon}{title}</div>
      <div className="flex items-center gap-3">
        <div className="w-[100px] h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25} paddingAngle={2} strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(val: number) => `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1 max-h-[100px] overflow-y-auto">
          {data.slice(0, 5).map((item, i) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-muted-foreground truncate max-w-[80px]">{item.name}</span>
              </div>
              <span className="font-medium">{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Portfolio Health Dashboard</h2>
        <p className="text-muted-foreground">Unified view of quality, diversification, and weekly insights</p>
      </div>

      {/* Top Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{holdings.length}</div>
            <div className="text-xs text-muted-foreground">Holdings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">${(totalValue / 1000).toFixed(1)}K</div>
            <div className="text-xs text-muted-foreground">Total Value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className={`text-2xl font-bold ${totalGainPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Total Return</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className={`text-2xl font-bold ${totalLabel.color}`}>{aggregatedScore.total.toFixed(1)}/25</div>
            <div className="text-xs text-muted-foreground">Quality Score</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{new Set(holdings.map(h => h.sector)).size}</div>
            <div className="text-xs text-muted-foreground">Sectors</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-1.5"><Snowflake className="w-3.5 h-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="diversification" className="gap-1.5"><Layers className="w-3.5 h-3.5" />Diversification</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5"><FileText className="w-3.5 h-3.5" />Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Snowflake Radar */}
            <Card>
              <CardHeader className="pb-0 text-center">
                <CardTitle className="text-lg">Portfolio Quality Snowflake</CardTitle>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className={`text-3xl font-bold ${totalLabel.color}`}>{aggregatedScore.total.toFixed(1)}</span>
                  <span className="text-muted-foreground text-lg">/25</span>
                </div>
                <Badge variant="outline" className={`${totalLabel.color} mt-1`}>{totalLabel.label}</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                      <Radar name="Portfolio" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Score Breakdown + Quick Insights */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Dimension Scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {chartData.map(item => {
                    const label = getScoreLabel(item.score);
                    return (
                      <div key={item.subject}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{item.subject}</span>
                          <span className={`text-sm font-bold ${label.color}`}>{item.score.toFixed(1)}/5</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(item.score / 5) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {insights.slice(0, 3).map((insight, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${typeColors[insight.type]}`}>
                      <div className={`mt-0.5 shrink-0 ${typeIconColors[insight.type]}`}>{insight.icon}</div>
                      <div>
                        <div className="font-medium">{insight.title}</div>
                        <div className="text-muted-foreground">{insight.body}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Diversification Tab */}
        <TabsContent value="diversification">
          <div className="space-y-4">
            {/* Treemap */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Layers className="w-4 h-4" />Sector Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={treemapData} dataKey="size" nameKey="name" content={<MiniTreemapContent />} />
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  {renderPie(sectorData, 'By Sector', <Building2 className="w-4 h-4" />)}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  {renderPie(countryData, 'By Country', <Globe className="w-4 h-4" />)}
                </CardContent>
              </Card>
            </div>

            {/* Top Holdings */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Holdings by Weight</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {holdings
                  .map(h => ({ symbol: h.symbol, pct: totalValue > 0 ? (h.shares * h.currentPrice / totalValue) * 100 : 0 }))
                  .sort((a, b) => b.pct - a.pct)
                  .slice(0, 8)
                  .map((h, i) => (
                    <div key={h.symbol} className="flex items-center gap-3">
                      <span className="text-sm font-mono w-12 text-muted-foreground">{h.symbol}</span>
                      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(h.pct, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-sm font-medium w-14 text-right">{h.pct.toFixed(1)}%</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Week of {format(weekStart, 'MMM d')} — {format(today, 'MMM d, yyyy')}</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />Auto-generated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${typeColors[insight.type]}`}>
                  <div className={`mt-0.5 shrink-0 ${typeIconColors[insight.type]}`}>{insight.icon}</div>
                  <div>
                    <div className="font-medium text-sm">{insight.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{insight.body}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioHealthDashboard;
