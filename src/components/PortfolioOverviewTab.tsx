import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, PiggyBank, Target, Activity, Clock, BarChart3, Globe, Wallet, Wifi, WifiOff, RefreshCcw, Zap } from 'lucide-react';
import { cleanSymbol } from '@/lib/utils';
import { PortfolioGoalTracker } from './PortfolioGoalTracker';
import { Button } from './ui/button';
import PortfolioPerformanceChart from './PortfolioPerformanceChart';
import { useDividends } from '@/hooks/useDividends';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const DONUT_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];

// Market status helper
const getMarketStatus = () => {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = nyTime.getDay();
  const hours = nyTime.getHours();
  const minutes = nyTime.getMinutes();
  
  // Weekend check
  if (day === 0 || day === 6) {
    return { isOpen: false, status: 'Weekend', color: 'bg-muted text-muted-foreground' };
  }
  
  const timeInMinutes = hours * 60 + minutes;
  const preMarketStart = 4 * 60; // 4:00 AM ET
  const marketOpen = 9 * 60 + 30; // 9:30 AM ET
  const marketClose = 16 * 60; // 4:00 PM ET
  const afterHoursEnd = 20 * 60; // 8:00 PM ET
  
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return { isOpen: true, status: 'Market Open', color: 'bg-emerald-500/10 text-emerald-500' };
  } else if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    return { isOpen: false, status: 'Pre-Market', color: 'bg-amber-500/10 text-amber-500' };
  } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
    return { isOpen: false, status: 'After Hours', color: 'bg-blue-500/10 text-blue-500' };
  }
  return { isOpen: false, status: 'Market Closed', color: 'bg-muted text-muted-foreground' };
};

export const PortfolioOverviewTab: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  const holdings = activePortfolio?.holdings || [];
  const transactions = activePortfolio?.transactions || [];
  const { dividends, loading: dividendsLoading } = useDividends(activePortfolio?.id);
  
  // Get symbols for real-time prices
  const symbols = useMemo(() => holdings.map(h => cleanSymbol(h.symbol)), [holdings]);
  const { prices, loading: pricesLoading, refreshNow } = useStockPrices(symbols, 30000);

  // Update market status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
      setLastUpdate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Calculate key metrics
  const metrics = useMemo(() => {
    const currentPrice = (h: typeof holdings[number]) => prices.get(cleanSymbol(h.symbol))?.price ?? (Number(h.currentPrice) || 0);
    const valuedHoldings = holdings.filter((h) => currentPrice(h) > 0);
    const unpricedCount = holdings.length - valuedHoldings.length;
    const holdingsValue = valuedHoldings.reduce((sum, h) => sum + (Number(h.shares) || 0) * currentPrice(h), 0);
    const totalValue = holdingsValue + (Number(activePortfolio?.cashBalance) || 0);
    const totalCost = valuedHoldings.reduce((sum, h) => sum + (h.shares || 0) * (h.avgPrice || 0), 0);
    const totalGain = holdingsValue - totalCost;
    const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    
    // Count unique holdings
    const uniqueHoldings = holdings.length;
    
    const estimatedAnnualDividendIncome = holdings.reduce((sum, h) => {
      const marketValue = (Number(h.shares) || 0) * currentPrice(h);
      return sum + marketValue * (Number(h.dividendYield) || 0) / 100;
    }, 0);
    const estimatedPortfolioYield = totalValue > 0 ? estimatedAnnualDividendIncome / totalValue * 100 : null;
    
    // Calculate transactions this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const transactionsThisMonth = transactions.filter(t => new Date(t.date) >= thisMonth).length;
    
    return {
      totalValue,
      totalCost,
      totalGain,
      gainPercent,
      uniqueHoldings,
      estimatedAnnualDividendIncome,
      estimatedPortfolioYield,
      transactionsThisMonth,
      totalTransactions: transactions.length,
      unpricedCount,
    };
  }, [activePortfolio?.cashBalance, holdings, transactions, prices]);

  // Sector allocation data
  const sectorData = useMemo(() => {
    const sectorMap = new Map<string, number>();
    holdings.forEach(h => {
      const price = prices.get(cleanSymbol(h.symbol))?.price ?? (Number(h.currentPrice) || 0);
      const value = (Number(h.shares) || 0) * price;
      const sector = h.sector || 'Unclassified';
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    });
    return Array.from(sectorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [holdings, prices]);

  // Asset type allocation
  const assetTypeData = useMemo(() => {
    const typeMap = new Map<string, number>();
    holdings.forEach(h => {
      const price = prices.get(cleanSymbol(h.symbol))?.price ?? (Number(h.currentPrice) || 0);
      const value = (Number(h.shares) || 0) * price;
      const type = h.assetType || 'Unclassified';
      typeMap.set(type, (typeMap.get(type) || 0) + value);
    });
    return Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [holdings, prices]);

  // Country/Region allocation
  const countryData = useMemo(() => {
    const countryMap = new Map<string, number>();
    holdings.forEach(h => {
      const price = prices.get(cleanSymbol(h.symbol))?.price ?? (Number(h.currentPrice) || 0);
      const value = (Number(h.shares) || 0) * price;
      const country = h.country || 'Unclassified';
      countryMap.set(country, (countryMap.get(country) || 0) + value);
    });
    return Array.from(countryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings, prices]);

  // Summarize actual completed dividend payments for the current calendar year.
  const dividendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = new Date().getFullYear();
    const received = Array.from({ length: 12 }, (_, month) => ({ month: months[month], amount: 0 }));
    dividends.filter((dividend) => !dividend.is_estimated).forEach((dividend) => {
      const paymentDate = new Date(`${dividend.pay_date || dividend.ex_date}T00:00:00`);
      if (!Number.isNaN(paymentDate.getTime()) && paymentDate.getFullYear() === year && paymentDate <= new Date()) {
        received[paymentDate.getMonth()].amount += Number(dividend.amount) || 0;
      }
    });
    return received;
  }, [dividends]);

  // Top holdings
  const topHoldings = useMemo(() => {
    return [...holdings]
      .map(h => {
        const price = prices.get(cleanSymbol(h.symbol))?.price ?? (Number(h.currentPrice) || 0);
        const cost = Number(h.avgPrice) || 0;
        const shares = Number(h.shares) || 0;
        return {
          symbol: cleanSymbol(h.symbol),
          name: h.name,
          value: shares * price,
          gainPercent: price > 0 && cost > 0 ? ((price - cost) / cost) * 100 : null,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [holdings, prices]);

  if (!activePortfolio || holdings.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Holdings Yet</h3>
        <p className="text-muted-foreground">Add holdings to see your portfolio overview.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: ${entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Market Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-4">
          <Badge className={`${marketStatus.color} gap-1`}>
            {marketStatus.isOpen ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {marketStatus.status}
          </Badge>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>View refreshed: {lastUpdate.toLocaleTimeString()}</span>
          </div>
          {pricesLoading && (
            <Badge variant="outline" className="gap-1">
              <Zap className="w-3 h-3 animate-pulse text-amber-500" />
              Updating...
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refreshNow} disabled={pricesLoading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${pricesLoading ? 'animate-spin' : ''}`} />
          Refresh Prices
        </Button>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">${metrics.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                {metrics.unpricedCount > 0 && <p className="mt-1 text-xs text-muted-foreground">{metrics.unpricedCount} holding{metrics.unpricedCount === 1 ? '' : 's'} missing current price</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${metrics.totalGain >= 0 ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' : 'from-red-500/10 to-red-500/5 border-red-500/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${metrics.totalGain >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {metrics.totalGain >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${metrics.totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {metrics.totalGain >= 0 ? '+' : ''}{metrics.gainPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Briefcase className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Holdings</p>
                <p className="text-2xl font-bold">{metrics.uniqueHoldings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <PiggyBank className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated portfolio yield</p>
                <p className="text-2xl font-bold">{metrics.estimatedPortfolioYield === null ? '—' : `${metrics.estimatedPortfolioYield.toFixed(2)}%`}</p>
                {metrics.estimatedPortfolioYield !== null && <p className="mt-1 text-xs text-muted-foreground">Based on yields on file</p>}
                {metrics.estimatedPortfolioYield !== null && <p className="text-xs text-muted-foreground">About ${metrics.estimatedAnnualDividendIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Performance Chart */}
        <div className="lg:col-span-2">
          <PortfolioPerformanceChart totalValue={metrics.totalValue} />
        </div>

        {/* Sector Allocation Donut */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Sector Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sectorData.slice(0, 6).map((sector, i) => (
                <div key={sector.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-muted-foreground truncate">{sector.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dividend Income Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Dividend Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dividendsLoading ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground" role="status">Loading payment records…</div>
            ) : !dividendData.some((month) => month.amount > 0) ? (
              <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border px-5 text-center">
                <p className="font-medium text-foreground">No completed payments recorded this year</p>
                <p className="mt-1 text-sm text-muted-foreground">Forecasts are excluded from this history chart.</p>
              </div>
            ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" name="Recorded payments" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
            {!dividendsLoading && dividendData.some((month) => month.amount > 0) && <p className="mt-2 text-xs text-muted-foreground">Completed dividend payments recorded in {new Date().getFullYear()}. Estimates are not included.</p>}
          </CardContent>
        </Card>

        {/* Asset Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-500" />
              Asset Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {assetTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Market Correlation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-500" />
              Market Correlation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-5 text-center">
              <Activity aria-hidden="true" className="mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="font-medium text-foreground">Correlation needs daily price history</p>
              <p className="mt-1 text-sm text-muted-foreground">A single market quote cannot show how holdings move together. Correlation will appear when aligned historical prices are available.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Tracker */}
      <PortfolioGoalTracker currentValue={metrics.totalValue} />

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Holdings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Top Holdings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topHoldings.map((holding, i) => (
                <div key={holding.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{holding.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{holding.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${holding.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    <p className={`text-xs ${holding.gainPercent === null ? 'text-muted-foreground' : holding.gainPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {holding.gainPercent === null ? 'Return unavailable' : `${holding.gainPercent >= 0 ? '+' : ''}${holding.gainPercent.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Geographic Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PortfolioOverviewTab;
