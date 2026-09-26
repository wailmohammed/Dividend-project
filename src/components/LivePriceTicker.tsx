import React, { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useMarketDataCache } from '@/hooks/useMarketDataCache';
import { cleanSymbol } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff, BarChart3, Briefcase } from 'lucide-react';

const MARKET_INDICES: { symbol: string; label: string; unit?: 'USD' | 'points' }[] = [
  { symbol: 'SPY', label: 'S&P 500 ETF' },
  { symbol: 'QQQ', label: 'NASDAQ 100 ETF' },
  { symbol: 'DIA', label: 'Dow Jones ETF' },
  { symbol: 'IWM', label: 'Russell 2000 ETF' },
  { symbol: 'VTI', label: 'Total Market ETF' },
  { symbol: 'GLD', label: 'Gold ETF' },
  { symbol: 'TLT', label: '20Y Treasury ETF' },
  { symbol: 'VIX', label: 'VIX Index', unit: 'points' },
];

interface TickerItem {
  symbol: string;
  label?: string;
  price: number;
  change: number;
  changePct: number;
  unit?: 'USD' | 'points';
  hasChange?: boolean;
}

const TickerRow: React.FC<{
  items: TickerItem[];
  speed?: number;
  direction?: 'left' | 'right';
}> = ({ items, speed = 30, direction = 'left' }) => {
  if (items.length === 0) return null;

  const duplicated = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden flex-1">
      <div
        className="flex whitespace-nowrap"
        style={{
          animation: `ticker-scroll-${direction} ${speed}s linear infinite`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.animationPlayState = 'paused'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.animationPlayState = 'running'; }}
      >
        {duplicated.map((item, i) => (
          <div
            key={`${item.symbol}-${i}`}
            className="inline-flex items-center gap-2 px-4 py-1.5 border-r border-border/50"
          >
            <span className="text-xs font-bold text-foreground">
              {item.label || item.symbol}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {item.unit === 'points' ? `${item.price.toFixed(2)} pts` : `$${item.price.toFixed(2)}`}
            </span>
            {item.hasChange && <span className={`inline-flex items-center text-[10px] font-medium ${
              item.changePct > 0 ? 'text-emerald-500' : item.changePct < 0 ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {item.changePct > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> :
               item.changePct < 0 ? <TrendingDown className="w-3 h-3 mr-0.5" /> :
               <Minus className="w-3 h-3 mr-0.5" />}
              {item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%
            </span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const LivePriceTicker: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];

  // Market index symbols
  const marketSymbols = useMemo(() => MARKET_INDICES.map(m => m.symbol), []);
  const portfolioSymbols = useMemo(() => holdings.map(h => cleanSymbol(h.symbol)), [holdings]);
  const allSymbols = useMemo(() => [...new Set([...marketSymbols, ...portfolioSymbols])], [marketSymbols, portfolioSymbols]);

  const { data: pricesMap, isConnected, getPrice } = useMarketDataCache(allSymbols);

  const marketItems: TickerItem[] = useMemo(() => {
    return MARKET_INDICES.map<TickerItem | null>(idx => {
      const priceData = getPrice(idx.symbol);
      if (!priceData || !Number.isFinite(priceData.price) || priceData.price <= 0) return null;
      return {
        symbol: idx.symbol,
        label: idx.label,
        price: priceData.price,
        change: priceData.change || 0,
        changePct: priceData.change_percent || 0,
        unit: idx.unit || 'USD',
        hasChange: Number.isFinite(priceData.change_percent),
      };
    }).filter((item): item is TickerItem => item !== null);
  }, [pricesMap, getPrice]);

  const portfolioItems: TickerItem[] = useMemo(() => {
    return holdings.map(h => {
      const symbol = cleanSymbol(h.symbol);
      const priceData = getPrice(symbol);
      return {
        symbol,
        price: priceData?.price || h.currentPrice || h.avgPrice,
        change: priceData?.change || 0,
        changePct: priceData?.change_percent || 0,
        hasChange: Boolean(priceData && Number.isFinite(priceData.change_percent)),
      };
    }).sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [holdings, pricesMap, getPrice]);

  return (
    <div className="relative w-full bg-card border-b border-border overflow-hidden">
      {/* Row 1: Market Indices */}
      <div className="flex items-center border-b border-border/50">
        <div className="flex items-center gap-1 px-3 py-1.5 border-r border-border bg-muted/30 shrink-0 z-10">
          <BarChart3 className="w-3 h-3 text-primary" />
          <span className="text-[10px] text-muted-foreground font-medium">MARKET</span>
        </div>
        <TickerRow items={marketItems} speed={35} direction="left" />
      </div>

      {/* Row 2: Portfolio Holdings */}
      <div className="flex items-center">
        <div className="flex items-center gap-1 px-3 py-1.5 border-r border-border bg-muted/30 shrink-0 z-10">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-emerald-500" />
          ) : (
            <WifiOff className="w-3 h-3 text-muted-foreground" />
          )}
          <span className="text-[10px] text-muted-foreground font-medium">
            {portfolioItems.length > 0 ? 'PORTFOLIO' : 'LIVE'}
          </span>
        </div>
        {portfolioItems.length > 0 ? (
          <TickerRow items={portfolioItems} speed={25} direction="right" />
        ) : (
          <div className="flex-1 flex items-center justify-center py-1.5">
            <span className="text-[10px] text-muted-foreground">Add holdings to see portfolio ticker</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePriceTicker;
