import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';

const TopGainersLosers: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const symbols = holdings.map(h => h.symbol);
  const { prices } = useStockPrices(symbols, 30000);

  const ranked = useMemo(() => {
    return holdings
      .map(h => {
        const p = prices.get(h.symbol?.toUpperCase());
        const changePercent = p?.changePercent || ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
        const change = p?.change || (h.currentPrice - h.avgPrice);
        return { ...h, changePercent, change, price: p?.price || h.currentPrice };
      })
      .sort((a, b) => b.changePercent - a.changePercent);
  }, [holdings, prices]);

  const gainers = ranked.filter(r => r.changePercent > 0).slice(0, 5);
  const losers = [...ranked].filter(r => r.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  if (holdings.length === 0) return null;

  const Row = ({ item }: { item: typeof ranked[0] }) => {
    const isPositive = item.changePercent >= 0;
    return (
      <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}>
            {item.symbol?.slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">{item.symbol}</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{item.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-medium text-foreground">${item.price.toFixed(2)}</div>
          <div className={`text-xs font-bold flex items-center justify-end gap-0.5 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(item.changePercent).toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Top Gainers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {gainers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No gainers today</p>
          ) : (
            gainers.map(g => <Row key={g.symbol} item={g} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Top Losers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {losers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No losers today</p>
          ) : (
            losers.map(l => <Row key={l.symbol} item={l} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TopGainersLosers;
