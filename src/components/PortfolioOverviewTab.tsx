import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, LineChart, Line, ComposedChart } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Briefcase, PiggyBank, Target, Activity, Clock, BarChart3, Users, Globe, Wallet, Wifi, WifiOff, RefreshCcw, Zap } from 'lucide-react';
import { cleanSymbol } from '@/lib/utils';
import { PortfolioGoalTracker } from './PortfolioGoalTracker';
import { Button } from './ui/button';

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
    const totalValue = holdings.reduce((sum, h) => sum + (h.shares || 0) * (h.currentPrice || h.avgPrice || 0), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.shares || 0) * (h.avgPrice || 0), 0);
    const totalGain = totalValue - totalCost;
    const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    
    // Count unique holdings
    const uniqueHoldings = holdings.length;
    
    // Calculate average dividend yield
    const avgDividendYield = holdings.length > 0 
      ? holdings.reduce((sum, h) => sum + (h.dividendYield || 0), 0) / holdings.length 
      : 0;
    
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
      avgDividendYield,
      transactionsThisMonth,
      totalTransactions: transactions.length
    };
  }, [holdings, transactions]);

  // Sector allocation data
  const sectorData = useMemo(() => {
    const sectorMap = new Map<string, number>();
    holdings.forEach(h => {
      const value = (h.shares || 0) * (h.currentPrice || h.avgPrice || 0);
      const sector = h.sector || 'Other';
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    });
    return Array.from(sectorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [holdings]);

  // Asset type allocation
  const assetTypeData = useMemo(() => {
    const typeMap = new Map<string, number>();
    holdings.forEach(h => {
      const value = (h.shares || 0) * (h.currentPrice || h.avgPrice || 0);
      const type = h.assetType || 'Stock';
      typeMap.set(type, (typeMap.get(type) || 0) + value);
    });
    return Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [holdings]);

  // Country/Region allocation
  const countryData = useMemo(() => {
    const countryMap = new Map<string, number>();
    holdings.forEach(h => {
      const value = (h.shares || 0) * (h.currentPrice || h.avgPrice || 0);
      const country = h.country || 'USA';
      countryMap.set(country, (countryMap.get(country) || 0) + value);
    });
    return Array.from(countryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // Generate mock performance data for chart (last 12 months)
  const performanceData = useMemo(() => {
    const data = [];
    let portfolioValue = metrics.totalValue * 0.75;
    let benchmarkValue = metrics.totalValue * 0.78;
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      portfolioValue *= (1 + (Math.random() * 0.08 - 0.03));
      benchmarkValue *= (1 + (Math.random() * 0.06 - 0.02));
      
      if (i === 0) {
        portfolioValue = metrics.totalValue;
      }
      
      data.push({
        month: monthName,
        portfolio: Math.round(portfolioValue),
        benchmark: Math.round(benchmarkValue)
      });
    }
    return data;
  }, [metrics.totalValue]);

  // Monthly dividend projection
  const dividendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const avgMonthlyDividend = (metrics.totalValue * (metrics.avgDividendYield / 100)) / 12;
    
    return months.map((month, i) => ({
      month,
      estimated: Math.round(avgMonthlyDividend * (0.8 + Math.random() * 0.4)),
      actual: i < new Date().getMonth() ? Math.round(avgMonthlyDividend * (0.9 + Math.random() * 0.2)) : 0
    }));
  }, [metrics.totalValue, metrics.avgDividendYield]);

  // Top holdings
  const topHoldings = useMemo(() => {
    return [...holdings]
      .map(h => ({
        symbol: cleanSymbol(h.symbol),
        name: h.name,
        value: (h.shares || 0) * (h.currentPrice || h.avgPrice || 0),
        gain: ((h.currentPrice || h.avgPrice || 0) - (h.avgPrice || 0)) * (h.shares || 0),
        gainPercent: h.avgPrice ? (((h.currentPrice || h.avgPrice) - h.avgPrice) / h.avgPrice) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [holdings]);

  // Market correlation mock data
  const correlationData = useMemo(() => {
    return [
      { name: 'S&P 500', correlation: 0.85 },
      { name: 'NASDAQ', correlation: 0.72 },
      { name: 'Bonds', correlation: -0.15 },
      { name: 'Gold', correlation: 0.05 },
      { name: 'Real Estate', correlation: 0.45 }
    ];
  }, []);

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
            <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
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
                <p className="text-sm text-muted-foreground">Dividend Yield</p>
                <p className="text-2xl font-bold">{metrics.avgDividendYield.toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Portfolio Performance vs Benchmark
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="benchmarkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#6366f1" fill="url(#portfolioGradient)" strokeWidth={2} />
                  <Area type="monotone" dataKey="benchmark" name="S&P 500" stroke="#10b981" fill="url(#benchmarkGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dividendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="actual" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="estimated" name="Estimated" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={correlationData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[-1, 1]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={70} />
                  <RechartsTooltip 
                    formatter={(value: number) => [value.toFixed(2), 'Correlation']}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Bar 
                    dataKey="correlation" 
                    fill="#6366f1"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
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
                    <p className={`text-xs ${holding.gainPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {holding.gainPercent >= 0 ? '+' : ''}{holding.gainPercent.toFixed(1)}%
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
