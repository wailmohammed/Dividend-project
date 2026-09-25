import { useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, AlertCircle, Globe, Building2, MapPin, Zap, Calendar, Scale, Scissors, RefreshCw, LineChart, RotateCcw, DollarSign, CalendarDays, CircleDollarSign, BarChart3, PieChart as PieChartIcon, BookOpen, FileText, Bell, Shield, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RebalancingSuggestions } from './RebalancingSuggestions';
import { PortfolioGoalTracker } from './PortfolioGoalTracker';
import { RealTimePriceTracker } from './RealTimePriceTracker';
import { DividendProjectionChart } from './DividendProjectionChart';
import { OneClickRebalancing } from './OneClickRebalancing';
import RebalancePlanner from './RebalancePlanner';
import { TaxLossHarvesting } from './TaxLossHarvesting';
import { DRIPCalculator } from './DRIPCalculator';
import { PortfolioPerformanceComparison } from './PortfolioPerformanceComparison';
import { SectorRotationAnalysis } from './SectorRotationAnalysis';
import { OptionsIncomeTracker } from './OptionsIncomeTracker';
import { FairValueAnalysis } from './FairValueAnalysis';
import { EconomicEventsCalendar } from './EconomicEventsCalendar';
import { EarningsCalendar } from './EarningsCalendar';
import { PerformanceAttribution } from './PerformanceAttribution';
import { TradeJournal } from './TradeJournal';
import { TaxReportGenerator } from './TaxReportGenerator';
import { RiskMetricsPanel } from './RiskMetricsPanel';
import { DripTracker } from './DripTracker';
import { PortfolioAlertsManager } from './PortfolioAlertsManager';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const COUNTRY_REGIONS: Record<string, { region: string; flag: string }> = {
  'USA': { region: 'North America', flag: '🇺🇸' },
  'US': { region: 'North America', flag: '🇺🇸' },
  'Canada': { region: 'North America', flag: '🇨🇦' },
  'UK': { region: 'Europe', flag: '🇬🇧' },
  'Germany': { region: 'Europe', flag: '🇩🇪' },
  'Japan': { region: 'Asia Pacific', flag: '🇯🇵' },
  'China': { region: 'Asia Pacific', flag: '🇨🇳' },
  'Global': { region: 'Global', flag: '🌍' },
};

export const AnalyticsView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { portfolios, activePortfolio, activePortfolioId, switchPortfolio } = usePortfolio();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>(() => activePortfolioId || 'all');

  useEffect(() => {
    if (activePortfolioId && selectedPortfolio === 'all') {
      setSelectedPortfolio(activePortfolioId);
    }
  }, [activePortfolioId, selectedPortfolio]);

  const handlePortfolioChange = (value: string) => {
    setSelectedPortfolio(value);
    if (value !== 'all') switchPortfolio(value);
  };

  const analytics = useMemo(() => {
    const holdings = activePortfolio.holdings || [];
    const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.shares * h.avgPrice), 0);
    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    const allocationByType = holdings.reduce((acc, h) => {
      const type = h.assetType || 'Stock';
      acc[type] = (acc[type] || 0) + h.shares * h.currentPrice;
      return acc;
    }, {} as Record<string, number>);

    const allocationData = Object.entries(allocationByType).map(([name, value]) => ({
      name, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }));

    const performers = holdings.map(h => ({
      symbol: h.symbol,
      gainLoss: (h.currentPrice - h.avgPrice) * h.shares,
      gainLossPercent: h.avgPrice > 0 ? ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100 : 0,
    })).sort((a, b) => b.gainLossPercent - a.gainLossPercent);

    const sectorAllocation = holdings.reduce((acc, h) => {
      const sector = h.sector || 'Other';
      acc[sector] = (acc[sector] || 0) + h.shares * h.currentPrice;
      return acc;
    }, {} as Record<string, number>);

    const sectorData = Object.entries(sectorAllocation).map(([name, value]) => ({
      name, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    const countryAllocation = holdings.reduce((acc, h) => {
      const country = h.country || 'USA';
      acc[country] = (acc[country] || 0) + h.shares * h.currentPrice;
      return acc;
    }, {} as Record<string, number>);

    const countryData = Object.entries(countryAllocation).map(([name, value]) => ({
      name, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
      flag: COUNTRY_REGIONS[name]?.flag || '🌐',
      region: COUNTRY_REGIONS[name]?.region || 'Other',
    })).sort((a, b) => b.value - a.value);

    const regionAllocation = countryData.reduce((acc, c) => {
      acc[c.region] = (acc[c.region] || 0) + c.value;
      return acc;
    }, {} as Record<string, number>);

    const regionData = Object.entries(regionAllocation).map(([name, value]) => ({
      name, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    return {
      totalValue, totalCost, totalGainLoss, totalGainLossPercent, allocationData,
      topGainers: performers.slice(0, 5), topLosers: performers.slice(-5).reverse(),
      sectorData, countryData, regionData,
      diversificationScore: Math.min(100, (holdings.length / 20) * 100),
      concentrationRisk: allocationData.length > 0 ? Math.max(...allocationData.map(d => d.percentage)) : 0,
      holdingsCount: holdings.length,
    };
  }, [activePortfolio, selectedPortfolio]);

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground">{payload[0].name}</p>
          <p className="text-sm text-primary font-medium">{payload[0].payload.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample analytics data. Sign in to see your real portfolio insights.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Analytics & Insights</h1>
          <p className="text-muted-foreground">Deep dive into your portfolio performance</p>
        </div>
        <Select value={selectedPortfolio} onValueChange={handlePortfolioChange}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Portfolios</SelectItem>
            {portfolios.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${analytics.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gain/Loss</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${analytics.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>{analytics.totalGainLossPercent >= 0 ? '+' : ''}{analytics.totalGainLossPercent.toFixed(2)}%</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Holdings</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.holdingsCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sectors</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{analytics.sectorData.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="realtime" className="space-y-4">
        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <TabsList className="inline-flex h-auto min-w-max gap-1 p-1">
            <TabsTrigger value="realtime" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <Zap className="w-3 h-3" />
              Real-Time
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <Shield className="w-3 h-3" />
              Risk
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <Bell className="w-3 h-3" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="benchmark" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <LineChart className="w-3 h-3" />
              Benchmark
            </TabsTrigger>
            <TabsTrigger value="rotation" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <RotateCcw className="w-3 h-3" />
              Rotation
            </TabsTrigger>
            <TabsTrigger value="dividends" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <Calendar className="w-3 h-3" />
              Dividends
            </TabsTrigger>
            <TabsTrigger value="drip" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <RefreshCw className="w-3 h-3" />
              DRIP
            </TabsTrigger>
            <TabsTrigger value="driptracker" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <DollarSign className="w-3 h-3" />
              DRIP Log
            </TabsTrigger>
            <TabsTrigger value="sectors" className="text-xs px-3 py-1.5 whitespace-nowrap">Sectors</TabsTrigger>
            <TabsTrigger value="geography" className="text-xs px-3 py-1.5 whitespace-nowrap">Geography</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs px-3 py-1.5 whitespace-nowrap">Performance</TabsTrigger>
            <TabsTrigger value="goals" className="text-xs px-3 py-1.5 whitespace-nowrap">Goals</TabsTrigger>
            <TabsTrigger value="rebalancing" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <Scale className="w-3 h-3" />
              Rebalancing
            </TabsTrigger>
            <TabsTrigger value="taxloss" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <Scissors className="w-3 h-3" />
              Tax-Loss
            </TabsTrigger>
            <TabsTrigger value="options" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <DollarSign className="w-3 h-3" />
              Options
            </TabsTrigger>
            <TabsTrigger value="fairvalue" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <CircleDollarSign className="w-3 h-3" />
              Fair Value
            </TabsTrigger>
            <TabsTrigger value="economic" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <CalendarDays className="w-3 h-3" />
              Economic
            </TabsTrigger>
            <TabsTrigger value="earnings" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <BarChart3 className="w-3 h-3" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="attribution" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <PieChartIcon className="w-3 h-3" />
              Attribution
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <BookOpen className="w-3 h-3" />
              Journal
            </TabsTrigger>
            <TabsTrigger value="taxreport" className="gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
              <FileText className="w-3 h-3" />
              Tax Report
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="realtime">
          <RealTimePriceTracker />
        </TabsContent>

        <TabsContent value="risk">
          <RiskMetricsPanel />
        </TabsContent>

        <TabsContent value="alerts">
          <PortfolioAlertsManager />
        </TabsContent>

        <TabsContent value="benchmark">
          <PortfolioPerformanceComparison />
        </TabsContent>

        <TabsContent value="rotation">
          <SectorRotationAnalysis />
        </TabsContent>

        <TabsContent value="dividends">
          <DividendProjectionChart />
        </TabsContent>

        <TabsContent value="drip">
          <DRIPCalculator />
        </TabsContent>

        <TabsContent value="driptracker">
          <DripTracker />
        </TabsContent>

        <TabsContent value="sectors">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />Sector Allocation</CardTitle></CardHeader>
              <CardContent>
                {analytics.sectorData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart><Pie data={analytics.sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                      {analytics.sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip content={<CustomPieTooltip />} /></PieChart>
                  </ResponsiveContainer>
                ) : <div className="text-center py-12 text-muted-foreground">No data</div>}
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
              <CardContent><div className="space-y-2 max-h-[260px] overflow-y-auto">
                {analytics.sectorData.map((s, i) => (
                  <div key={s.name} className="flex justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[i % COLORS.length] }} /><span>{s.name}</span></div>
                    <span className="font-medium">{s.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geography">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Regional Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart><Pie data={analytics.regionData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" paddingAngle={2}>
                    {analytics.regionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip content={<CustomPieTooltip />} /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" />Country Exposure</CardTitle></CardHeader>
              <CardContent><div className="space-y-2 max-h-[260px] overflow-y-auto">
                {analytics.countryData.map(c => (
                  <div key={c.name} className="flex justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2"><span>{c.flag}</span><span>{c.name}</span></div>
                    <span className="font-medium">{c.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" />Top Gainers</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {analytics.topGainers.map(a => (
                  <div key={a.symbol} className="flex justify-between p-2 rounded bg-green-500/5 border border-green-500/20">
                    <span className="font-medium">{a.symbol}</span>
                    <span className="text-green-500 font-medium">+{a.gainLossPercent.toFixed(2)}%</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-500" />Top Losers</CardTitle></CardHeader>
              <CardContent><div className="space-y-2">
                {analytics.topLosers.map(a => (
                  <div key={a.symbol} className="flex justify-between p-2 rounded bg-red-500/5 border border-red-500/20">
                    <span className="font-medium">{a.symbol}</span>
                    <span className="text-red-500 font-medium">{a.gainLossPercent.toFixed(2)}%</span>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="goals"><PortfolioGoalTracker currentValue={analytics.totalValue} /></TabsContent>
        <TabsContent value="rebalancing">
          <div className="space-y-6">
            <RebalancePlanner />
            <OneClickRebalancing />
            <RebalancingSuggestions />
          </div>
        </TabsContent>
        <TabsContent value="taxloss"><TaxLossHarvesting /></TabsContent>
        <TabsContent value="options"><OptionsIncomeTracker /></TabsContent>
        <TabsContent value="fairvalue"><FairValueAnalysis /></TabsContent>
        <TabsContent value="economic"><EconomicEventsCalendar /></TabsContent>
        <TabsContent value="earnings"><EarningsCalendar /></TabsContent>
        <TabsContent value="attribution"><PerformanceAttribution /></TabsContent>
        <TabsContent value="journal"><TradeJournal /></TabsContent>
        <TabsContent value="taxreport"><TaxReportGenerator /></TabsContent>
      </Tabs>
    </div>
  );
};
