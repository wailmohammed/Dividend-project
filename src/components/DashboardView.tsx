import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, Activity, Loader2, Sparkles, BarChart3, AlertCircle, Newspaper, ExternalLink, Power, ArrowDownRight, Plus, Trash2, Zap, Megaphone, Bell, RefreshCw, Database, FlaskConical } from 'lucide-react';
import XIRRPerformanceCard from './XIRRPerformanceCard';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { generatePortfolioInsight } from '../services/geminiService';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getDemoModeEnabled } from '../hooks/useDemoMode';
import PortfolioPerformanceChart from './PortfolioPerformanceChart';
import { HoldingsTable } from './HoldingsTable';
import { useBrokerSync } from '../hooks/useBrokerSync';
import NewsFeed from './NewsFeed';
import { useEnrichHoldings } from '../hooks/useEnrichHoldings';
import { DividendProjectionChart } from './DividendProjectionChart';
import PortfolioIntrinsicValue from './PortfolioIntrinsicValue';
import TopGainersLosers from './TopGainersLosers';
import { RecentTriggeredAlerts } from './RecentTriggeredAlerts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertHistoryLog } from './AlertHistoryLog';
import { toast } from 'sonner';
import { SupportProject } from './MonetizationDisplay';
const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio, isMarketOpen, toggleMarketOpen, alerts, addAlert, removeAlert } = usePortfolio();
  const { theme } = useTheme();
  const { syncing, syncAllBrokers } = useBrokerSync();
  const { enrichHoldings, enrichPrices, loading: enrichLoading } = useEnrichHoldings();
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const handleManualSync = async () => {
    if (activePortfolio?.id) {
      await syncAllBrokers(activePortfolio.id);
    }
  };

  const handleRefreshAllMarketData = async () => {
    if (!activePortfolio?.id) return;
    
    const symbols = activePortfolio.holdings.map(h => h.symbol);
    if (symbols.length === 0) {
      toast.info('No holdings to enrich');
      return;
    }
    
    toast.info('Refreshing market data...');
    
    // Enrich both prices and dividends in parallel
    await Promise.all([
      enrichPrices(symbols),
      enrichHoldings(activePortfolio.id, symbols)
    ]);
  };


  // Alert Widget State
  const [alertTab, setAlertTab] = useState<'price' | 'smart'>('price');
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [newAlertSymbol, setNewAlertSymbol] = useState('');
  const [newAlertPrice, setNewAlertPrice] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');

  // Smart Triggers State (Mocked)
  const [smartTriggers, setSmartTriggers] = useState({
      dividendCuts: true,
      earningsReports: false,
      marketVolatility: true
  });

  // Metrics Calculation for AI
  const calculateBeta = (sector: string, type: string): number => {
      if (type === 'Crypto') return 2.5;
      if (sector === 'Technology') return 1.3;
      if (sector === 'Utilities') return 0.5;
      if (sector === 'Real Estate') return 0.7;
      return 1.0;
  }

  const portfolioBeta = activePortfolio.totalValue > 0
    ? activePortfolio.holdings.reduce((acc: number, h) => {
        const val = Number(h.shares) * Number(h.currentPrice);
        const weight = val / Number(activePortfolio.totalValue);
        const beta = calculateBeta(h.sector || 'Unknown', String(h.assetType));
        return acc + (beta * weight);
    }, 0)
    : 1.0;

  const portfolioYield = activePortfolio.totalValue > 0
    ? (activePortfolio.holdings.reduce((acc: number, h) => {
        const val = Number(h.shares) * Number(h.currentPrice);
        const income = val * (Number(h.dividendYield || 0) / 100);
        return acc + income;
    }, 0) / Number(activePortfolio.totalValue)) * 100
    : 0;

  // Detailed AI Data Prep - Use explicit typing for reduce
  const sectorWeights = activePortfolio.holdings.reduce((acc: Record<string, number>, h) => {
      const val = Number(h.shares) * Number(h.currentPrice);
      const sector = h.sector || 'Unknown';
      const current = acc[sector] || 0;
      acc[sector] = current + val;
      return acc;
  }, {} as Record<string, number>);

  const sectorWeightsFormatted: Record<string, string> = {};
  Object.entries(sectorWeights).forEach(([k, v]) => {
      const total = Number(activePortfolio.totalValue);
      if (total > 0) {
          sectorWeightsFormatted[k] = `${((Number(v) / total) * 100).toFixed(1)}%`;
      }
  });

  const totalCostBasis = activePortfolio.holdings.reduce((acc: number, h) => acc + (Number(h.shares) * Number(h.avgPrice)), 0);
  const costBasisSummary = activePortfolio.totalValue > 0
      ? `Total Cost: $${totalCostBasis.toLocaleString()}, Unrealized P/L: $${(Number(activePortfolio.totalValue) - totalCostBasis).toLocaleString()}`
      : "No holdings";

  const recentTx = (activePortfolio.transactions || []).slice(0, 3).map(t => `${t.type} ${t.shares} ${t.symbol} @ $${t.price}`);

  // Auto-generate insight on mount/update
  useEffect(() => {
    const initInsight = async () => {
        setLoadingInsight(true);
        const text = await generatePortfolioInsight(activePortfolio, {
            beta: portfolioBeta,
            yield: portfolioYield,
            sectorWeights: sectorWeightsFormatted,
            costBasisSummary: costBasisSummary,
            recentTransactions: recentTx
        });
        setInsight(text);
        setLoadingInsight(false);
    };
    if (activePortfolio.holdings.length > 0) {
        initInsight();
    } else {
        setInsight("Add assets to your portfolio to see AI insights.");
    }
  }, [activePortfolio.id, activePortfolio.holdings.length]);

  // Calculate total dividend income dynamically
  const annualDividendIncome = activePortfolio.holdings.reduce((acc, h) => {
      return acc + (Number(h.shares) * Number(h.currentPrice) * (Number(h.dividendYield || 0) / 100));
  }, 0);

  // Snowball Analytics Style: Compound Projection Data
  const projectionData = Array.from({ length: 15 }, (_, i) => {
      const year = new Date().getFullYear() + i;
      const initialVal = Number(activePortfolio.totalValue);
      const contributions = initialVal + (12000 * i); // Mock $1k/mo
      const growthRate = 0.08;
      const value = contributions * Math.pow(1 + growthRate, i);
      const dividendReinvest = value * 0.03;
      return {
          year,
          contributions,
          value: Math.round(value + (dividendReinvest * i)),
          benchmark: Math.round(contributions * Math.pow(1.09, i)) // S&P 500 comparison
      };
  });

  const holdingsValue = activePortfolio.holdings.reduce(
    (total, holding) => total + Number(holding.shares) * Number(holding.currentPrice), 0,
  );
  const unrealizedGain = holdingsValue - totalCostBasis;
  const unrealizedGainPercent = totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : null;
  const sectorCount = Object.keys(sectorWeights).filter(sector => sector !== 'Unknown').length;

  const handleCreateAlert = (e: React.FormEvent) => {
      e.preventDefault();
      if (newAlertSymbol && newAlertPrice) {
          addAlert(newAlertSymbol.toUpperCase(), parseFloat(newAlertPrice), newAlertCondition);
          setIsAddingAlert(false);
          setNewAlertSymbol('');
          setNewAlertPrice('');
      }
  };

  const toggleSmartTrigger = (key: keyof typeof smartTriggers) => {
      setSmartTriggers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-10">

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="border-warning/50 bg-warning/10 mb-6">
          <FlaskConical className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>Demo Mode:</strong> Viewing sample dashboard data. Sign in to see your real portfolio.
          </AlertDescription>
        </Alert>
      )}

      <SupportProject />

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your holistic financial operating system.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             <button
                onClick={handleManualSync}
                disabled={syncing}
                aria-label={syncing ? 'Syncing brokers' : 'Sync brokers'}
                className="min-h-11 flex items-center justify-center gap-2 text-xs border px-3 py-2 rounded-lg shadow-sm transition-all bg-primary hover:bg-primary/90 text-primary-foreground border-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Brokers'}
            </button>
             <button
                onClick={handleRefreshAllMarketData}
                disabled={enrichLoading}
                aria-label={enrichLoading ? 'Refreshing market data' : 'Refresh market data'}
                className="min-h-11 flex items-center justify-center gap-2 text-xs border px-3 py-2 rounded-lg shadow-sm transition-all bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                <Database className={`w-3 h-3 ${enrichLoading ? 'animate-pulse' : ''}`} />
                {enrichLoading ? 'Enriching...' : 'Refresh Market Data'}
            </button>
             <button
                onClick={toggleMarketOpen}
                aria-pressed={isMarketOpen}
                className={`min-h-11 flex items-center justify-center gap-2 text-xs border px-3 py-2 rounded-lg shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isMarketOpen
                    ? 'bg-card border-border text-muted-foreground hover:border-primary'
                    : 'bg-muted border-border text-muted-foreground opacity-70'
                }`}
            >
                <span className={`flex h-2 w-2 rounded-full ${isMarketOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isMarketOpen ? 'Market Open' : 'Market Closed'}
                <Power className="w-3 h-3 ml-1" />
            </button>
        </div>
      </div>

      {/* Top Row: Mood & Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Portfolio snapshot */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-center mb-2 relative z-10">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5" /> Portfolio snapshot
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {activePortfolio.holdings.length} positions
                  </span>
              </div>
              <div className="flex-1 flex flex-col justify-center relative z-10">
                  <div className="text-3xl font-bold text-foreground">{sectorCount}</div>
                  <div className="text-sm text-muted-foreground">sectors represented</div>
                  <p className="text-xs text-muted-foreground mt-3">Based on the sector data available for your current holdings.</p>
              </div>
          </div>

          {/* AI Analyst / Daily Briefing */}
          <div className="lg:col-span-2 bg-primary rounded-xl p-5 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-0 opacity-10">
                  <Sparkles className="w-40 h-40 text-primary-foreground rotate-12 translate-x-8 -translate-y-8" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                      <div className="flex items-center gap-2 mb-2">
                          <div className="bg-primary-foreground/15 backdrop-blur-sm p-1.5 rounded-lg">
                              <Activity className="w-3.5 h-3.5 text-primary-foreground" />
                          </div>
                          <span className="text-[10px] font-semibold bg-primary-foreground/10 px-2 py-0.5 rounded-full border border-primary-foreground/20 text-primary-foreground uppercase tracking-wider">Daily Briefing</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-primary-foreground">Portfolio Health Check</h3>
                      <p className="text-[11px] text-primary-foreground/70 mb-2">AI generated from available portfolio data. Review the underlying figures before acting.</p>
                  </div>

                  {loadingInsight ? (
                    <div className="bg-primary-foreground/10 backdrop-blur-md rounded-lg p-4 border border-primary-foreground/15 space-y-2">
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground/70" />
                            <span className="text-xs text-primary-foreground/70">Analyzing portfolio...</span>
                        </div>
                        <Skeleton className="h-3.5 w-full bg-primary-foreground/20" />
                        <Skeleton className="h-3.5 w-5/6 bg-primary-foreground/20" />
                        <Skeleton className="h-3.5 w-4/6 bg-primary-foreground/20" />
                    </div>
                  ) : (
                    <div className="bg-primary-foreground/10 backdrop-blur-md rounded-lg p-4 border border-primary-foreground/15 text-primary-foreground text-sm leading-relaxed">
                         {insight || 'Portfolio insight is not available right now.'}
                    </div>
                  )}
              </div>
          </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
             <Wallet className="w-20 h-20 text-primary" />
          </div>
          <div className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">Net Worth</div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
              ${(Number(activePortfolio.totalValue) + Number(activePortfolio.cashBalance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {unrealizedGainPercent !== null && (
            <div className={`text-[11px] font-semibold flex items-center gap-1 mt-2 w-fit px-2 py-0.5 rounded-full ${unrealizedGain >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-destructive bg-destructive/10'}`}>
              {unrealizedGain >= 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {unrealizedGain >= 0 ? '+' : '-'}${Math.abs(unrealizedGain).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unrealized ({unrealizedGainPercent.toFixed(1)}%)
            </div>
          )}
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          <div className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">Cash Balance</div>
          <div className="text-2xl font-bold text-foreground tracking-tight">${Number(activePortfolio.cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div className="text-muted-foreground text-[11px] mt-2 flex items-center gap-1">
             <AlertCircle className="w-3 h-3" /> Available to deploy
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden">
           <div className="text-muted-foreground text-xs mb-1 font-medium uppercase tracking-wide">Annual Income</div>
           <div className="text-2xl font-bold text-foreground tracking-tight">
               ${Number(annualDividendIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
           </div>
          <div className="text-muted-foreground text-[11px] mt-2">Estimate from current holdings and dividend yields</div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 sm:grid-cols-4">
          <TabsTrigger value="overview" className="min-h-11 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="income" className="min-h-11 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Wallet className="h-4 w-4" /> Income
          </TabsTrigger>
          <TabsTrigger value="planning" className="min-h-11 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="h-4 w-4" /> Plan & alerts
          </TabsTrigger>
          <TabsTrigger value="news" className="min-h-11 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Newspaper className="h-4 w-4" /> News
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <XIRRPerformanceCard />
          <PortfolioPerformanceChart totalValue={Number(activePortfolio.totalValue)} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <PortfolioIntrinsicValue compact />
            </div>
            <div className="md:col-span-2">
              <TopGainersLosers />
            </div>
          </div>

          <HoldingsTable />
        </TabsContent>

        <TabsContent value="income" className="space-y-6">
          <DividendProjectionChart />
        </TabsContent>

        <TabsContent value="planning" className="space-y-6">
          <RecentTriggeredAlerts />
          <AlertHistoryLog />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Wealth Projection */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" /> Wealth projection scenario
                </h3>
                <div className="flex gap-2 text-xs">
                     <span className="flex items-center gap-1 text-muted-foreground"><div className="w-3 h-3 bg-primary rounded"></div> Portfolio</span>
                     <span className="flex items-center gap-1 text-muted-foreground"><div className="w-3 h-3 bg-muted-foreground rounded"></div> Contributions</span>
                </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3 mb-4">Illustrative scenario assumes $1,000 monthly contributions, 8% annual growth and 3% dividend reinvestment. Actual results will differ.</p>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionData}>
                        <defs>
                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickFormatter={(val) => `$${val/1000}k`}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--popover))',
                                borderColor: 'hsl(var(--border))',
                                color: 'hsl(var(--popover-foreground))',
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                        />
                        <Area type="monotone" dataKey="value" name="Projected Value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="contributions" name="Total Invested" stroke="hsl(var(--muted-foreground))" fill="transparent" strokeDasharray="5 5" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Active Alerts Widget */}
        <div className="col-span-1">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                    <div className="flex items-center gap-2" role="tablist" aria-label="Alert type">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={alertTab === 'price'}
                            onClick={() => setAlertTab('price')}
                            className={`min-h-11 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg ${alertTab === 'price' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Price Alerts
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={alertTab === 'smart'}
                            onClick={() => setAlertTab('smart')}
                            className={`min-h-11 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg ${alertTab === 'smart' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Smart Triggers
                        </button>
                    </div>
                    {alertTab === 'price' && (
                        <button
                            type="button"
                            aria-label="Add price alert"
                            onClick={() => setIsAddingAlert(true)}
                            className="min-h-11 min-w-11 flex items-center justify-center hover:bg-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Plus className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </button>
                    )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin scrollbar-thumb-muted">
                    {alertTab === 'price' ? (
                        alerts.length === 0 ? (
                            <div className="text-center text-muted-foreground text-xs py-8 flex flex-col items-center">
                                <Bell className="w-8 h-8 mb-2 opacity-20" />
                                No active price alerts
                            </div>
                        ) : (
                            alerts.map(alert => (
                                <div key={alert.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border group hover:border-primary/30 transition-colors">
                                    <div>
                                        <div className="font-bold text-foreground text-sm">{alert.symbol}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Trigger if {alert.condition.toLowerCase()} <span className="font-bold text-foreground">${alert.targetPrice}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={`Remove ${alert.symbol} price alert`}
                                        onClick={() => removeAlert(alert.id)}
                                        className="min-h-11 min-w-11 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors p-1 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )
                    ) : (
                        /* Smart Triggers Tab */
                        <div className="space-y-4 pt-1">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground text-sm">Dividend Cuts</div>
                                        <div className="text-[10px] text-muted-foreground">Alert if payout ratio {'>'}100%</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Dividend cut alerts"
                                    aria-checked={smartTriggers.dividendCuts}
                                    onClick={() => toggleSmartTrigger('dividendCuts')}
                                    className={`min-w-11 min-h-11 p-3 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${smartTriggers.dividendCuts ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${smartTriggers.dividendCuts ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Megaphone className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground text-sm">Earnings Reports</div>
                                        <div className="text-[10px] text-muted-foreground">Notify 1 day before earnings</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Earnings report alerts"
                                    aria-checked={smartTriggers.earningsReports}
                                    onClick={() => toggleSmartTrigger('earningsReports')}
                                    className={`min-w-11 min-h-11 p-3 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${smartTriggers.earningsReports ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${smartTriggers.earningsReports ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/10 rounded-lg">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground text-sm">Market Volatility</div>
                                        <div className="text-[10px] text-muted-foreground">Alert if daily drop {'>'} 3%</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-label="Market volatility alerts"
                                    aria-checked={smartTriggers.marketVolatility}
                                    onClick={() => toggleSmartTrigger('marketVolatility')}
                                    className={`min-w-11 min-h-11 p-3 rounded-full transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${smartTriggers.marketVolatility ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${smartTriggers.marketVolatility ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {isAddingAlert && alertTab === 'price' && (
                    <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                        <form onSubmit={handleCreateAlert} className="space-y-3">
                            <div className="flex flex-col gap-2">
                                <input
                                    type="text"
                                    placeholder="Symbol (e.g. AAPL)"
                                    className="w-full bg-muted border border-transparent focus:border-primary rounded px-3 py-2 text-sm text-foreground outline-none"
                                    value={newAlertSymbol}
                                    onChange={e => setNewAlertSymbol(e.target.value.toUpperCase())}
                                    required
                                />
                                <select
                                    className="w-full bg-muted border border-transparent rounded px-3 py-2 text-sm text-foreground outline-none"
                                    value={newAlertCondition}
                                    onChange={e => setNewAlertCondition(e.target.value as any)}
                                >
                                    <option value="ABOVE">Above Price</option>
                                    <option value="BELOW">Below Price</option>
                                </select>
                                <input
                                    type="number"
                                    placeholder="Target Price ($)"
                                    className="w-full bg-muted border border-transparent focus:border-primary rounded px-3 py-2 text-sm text-foreground outline-none"
                                    value={newAlertPrice}
                                    onChange={e => setNewAlertPrice(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold py-2 rounded transition-colors">Save</button>
                                <button type="button" onClick={() => setIsAddingAlert(false)} className="flex-1 bg-muted text-muted-foreground hover:text-foreground text-sm font-bold py-2 rounded transition-colors">Cancel</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
          </div>
        </TabsContent>

        <TabsContent value="news" className="space-y-6">
          <NewsFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardView;
