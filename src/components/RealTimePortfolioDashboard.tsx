import { useState, useEffect, useMemo } from 'react';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { cleanSymbol } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { 
  RefreshCcw, TrendingUp, TrendingDown, DollarSign, 
  Clock, Wifi, WifiOff, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';

interface HoldingData {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avg_price: number;
  current_price: number | null;
}

export const RealTimePortfolioDashboard = () => {
  const { holdings: dbHoldings, loading: holdingsLoading } = usePortfolioData();
  const { activePortfolio } = usePortfolio();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Merge DB holdings with context holdings for demo/fallback
  const holdings: HoldingData[] = useMemo(() => {
    if (dbHoldings && dbHoldings.length > 0) {
      return dbHoldings.map(h => ({
        id: h.id,
        symbol: h.symbol,
        name: h.name,
        shares: h.shares,
        avg_price: h.avg_price,
        current_price: h.current_price
      }));
    }
    // Fallback to context portfolio holdings
    if (activePortfolio?.holdings && activePortfolio.holdings.length > 0) {
      return activePortfolio.holdings.map(h => ({
        id: h.id,
        symbol: h.symbol,
        name: h.name,
        shares: h.shares,
        avg_price: h.avgPrice,
        current_price: h.currentPrice
      }));
    }
    return [];
  }, [dbHoldings, activePortfolio?.holdings]);
  
  // Extract symbols from holdings (clean for API calls)
  const symbols = useMemo(() => {
    return holdings.map(h => cleanSymbol(h.symbol));
  }, [holdings]);
  
  const { prices, loading: pricesLoading, error, refreshNow } = useStockPrices(symbols, 30000);
  
  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalDayChange = 0;
    
    holdings.forEach(holding => {
      const priceData = prices.get(cleanSymbol(holding.symbol));
      const currentPrice = priceData?.price || holding.current_price || holding.avg_price || 0;
      const avgPrice = holding.avg_price || 0;
      const shares = holding.shares || 0;
      const value = shares * currentPrice;
      const cost = shares * avgPrice;
      const dayChange = priceData ? ((priceData.change || 0) * shares) : 0;
      
      totalValue += value;
      totalCost += cost;
      totalDayChange += dayChange;
    });
    
    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const dayChangePercent = totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0;
    
    return {
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
      totalDayChange,
      dayChangePercent,
    };
  }, [holdings, prices]);
  
  const handleRefresh = () => {
    refreshNow();
    setLastRefresh(new Date());
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (holdingsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }
  
  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings Yet</h3>
          <p className="text-muted-foreground">
            Add holdings to your portfolio to see real-time prices.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Live Portfolio</h2>
          <Badge variant={error ? "destructive" : "secondary"} className="flex items-center gap-1">
            {error ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {error ? 'Offline' : 'Live'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={pricesLoading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${pricesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolioMetrics.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`flex items-center text-sm ${portfolioMetrics.totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioMetrics.totalGain >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              ${Math.abs(portfolioMetrics.totalGain).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="ml-1">({portfolioMetrics.totalGainPercent.toFixed(2)}%)</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Change
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolioMetrics.totalDayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioMetrics.totalDayChange >= 0 ? '+' : ''}${portfolioMetrics.totalDayChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className={`flex items-center text-sm ${portfolioMetrics.totalDayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioMetrics.totalDayChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {portfolioMetrics.dayChangePercent.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost Basis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${portfolioMetrics.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-muted-foreground">
              {holdings.length} holdings
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Holdings Table with Live Prices */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Symbol</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Shares</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Change</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Value</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Gain/Loss</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const displaySymbol = cleanSymbol(holding.symbol);
                  const priceData = prices.get(displaySymbol);
                  const currentPrice = priceData?.price || holding.current_price || holding.avg_price || 0;
                  const avgPrice = holding.avg_price || 0;
                  const shares = holding.shares || 0;
                  const value = shares * currentPrice;
                  const cost = shares * avgPrice;
                  const gain = value - cost;
                  const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
                  const change = priceData?.change || 0;
                  const changePercent = priceData?.changePercent || 0;
                  
                  return (
                    <tr key={holding.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2">
                        <span className="font-semibold">{displaySymbol}</span>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{holding.name}</td>
                      <td className="py-3 px-2 text-right">{shares.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right font-medium">
                        ${currentPrice.toFixed(2)}
                      </td>
                      <td className={`py-3 px-2 text-right ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 px-2 text-right ${gain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {gain >= 0 ? '+' : ''}${gain.toFixed(2)} ({gainPercent.toFixed(2)}%)
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant="outline" className="text-xs">
                          {priceData?.source || 'db'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
