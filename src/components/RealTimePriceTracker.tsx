import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { usePortfolio } from '@/context/PortfolioContext';
import { useMarketDataCache } from '@/hooks/useMarketDataCache';
import { cleanSymbol } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, TrendingUp, TrendingDown, Activity, Zap, RefreshCw, Database } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { formatDistanceToNow } from 'date-fns';

export const RealTimePriceTracker = () => {
  const { activePortfolio } = usePortfolio();
  
  const holdings = activePortfolio?.holdings || [];
  const symbols = useMemo(() => holdings.map(h => cleanSymbol(h.symbol)), [holdings]);
  
  const { data: pricesMap, isConnected, lastUpdate, loading, triggerSync, getPrice } = useMarketDataCache(symbols);

  // Calculate real-time portfolio value and changes
  const portfolioStats = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let todayChange = 0;
    
    holdings.forEach(h => {
      const symbol = cleanSymbol(h.symbol);
      const priceData = getPrice(symbol);
      const currentPrice = priceData?.price || h.currentPrice || h.avgPrice || 0;
      const shares = h.shares || 0;
      const avgPrice = h.avgPrice || 0;
      
      const value = shares * currentPrice;
      const cost = shares * avgPrice;
      
      totalValue += value;
      totalCost += cost;
      
      if (priceData) {
        todayChange += shares * priceData.change;
      }
    });
    
    const totalGain = totalValue - totalCost;
    const gainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const todayPercent = totalValue > 0 ? (todayChange / (totalValue - todayChange)) * 100 : 0;
    
    return {
      totalValue,
      totalCost,
      totalGain,
      gainPercent,
      todayChange,
      todayPercent
    };
  }, [holdings, pricesMap, getPrice]);

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings to Track</h3>
          <p className="text-muted-foreground">Add holdings to see real-time price updates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-4">
          <Badge className={`gap-1 ${isConnected ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'Connected' : 'Connecting...'}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Database className="w-3 h-3 text-blue-500" />
            Cached Data
          </Badge>
          {isConnected && (
            <Badge variant="outline" className="gap-1">
              <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
              Real-time Updates
            </Badge>
          )}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerSync}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Portfolio Value</p>
            <p className="text-xl font-bold">${portfolioStats.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Today's Change</p>
            <p className={`text-xl font-bold ${portfolioStats.todayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioStats.todayChange >= 0 ? '+' : ''}${portfolioStats.todayChange.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              <span className="text-sm ml-1">({portfolioStats.todayPercent >= 0 ? '+' : ''}{portfolioStats.todayPercent.toFixed(2)}%)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Cache Info */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium text-foreground">Market Data Cache</p>
              <p className="text-sm text-muted-foreground">
                Data syncs every 6 hours automatically. Click "Sync Now" for immediate updates.
              </p>
            </div>
          </div>
          <Badge variant="secondary">
            {pricesMap.size} symbols cached
          </Badge>
        </CardContent>
      </Card>

      {/* Real-time Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Real-Time Holdings
          </CardTitle>
          <CardDescription>
            Live price updates for your portfolio holdings (powered by cached data with realtime sync)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map(holding => {
                const symbol = cleanSymbol(holding.symbol);
                const priceData = getPrice(symbol);
                const currentPrice = priceData?.price || holding.currentPrice || holding.avgPrice || 0;
                const shares = holding.shares || 0;
                const avgPrice = holding.avgPrice || 0;
                const value = shares * currentPrice;
                const cost = shares * avgPrice;
                const pl = value - cost;
                const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
                const change = priceData?.change || 0;
                const changePercent = priceData?.change_percent || 0;
                const source = priceData?.source || 'local';
                
                return (
                  <TableRow key={holding.id || symbol}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{symbol}</span>
                        {priceData && (
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">
                      {holding.name}
                    </TableCell>
                    <TableCell className="text-right">{shares.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${currentPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`flex items-center justify-end gap-1 ${change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span className="font-mono text-sm">
                          {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono ${pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {pl >= 0 ? '+' : ''}{plPercent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
