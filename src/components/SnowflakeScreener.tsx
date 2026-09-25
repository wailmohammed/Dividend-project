import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { Snowflake, Filter, RotateCcw, ArrowUpRight, ArrowDownRight, FlaskConical, Star, TrendingUp, Shield, DollarSign, BarChart3, Plus, X } from 'lucide-react';

interface ScreenerStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  sector: string;
  marketCap: string;
  snowflake: { value: number; future: number; past: number; health: number; dividend: number };
}

const defaultStocks: ScreenerStock[] = [
  { symbol: 'NVDA', name: 'NVIDIA', price: 875.28, change: 4.2, sector: 'Technology', marketCap: '$2.1T', snowflake: { value: 2, future: 5, past: 5, health: 4, dividend: 1 } },
  { symbol: 'AAPL', name: 'Apple', price: 192.50, change: 0.8, sector: 'Technology', marketCap: '$3.0T', snowflake: { value: 3, future: 3, past: 5, health: 5, dividend: 2 } },
  { symbol: 'MSFT', name: 'Microsoft', price: 425.52, change: 1.8, sector: 'Technology', marketCap: '$3.1T', snowflake: { value: 3, future: 4, past: 5, health: 5, dividend: 2 } },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 157.30, change: 0.3, sector: 'Healthcare', marketCap: '$379B', snowflake: { value: 4, future: 3, past: 4, health: 4, dividend: 5 } },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 198.50, change: 0.8, sector: 'Financials', marketCap: '$572B', snowflake: { value: 4, future: 3, past: 5, health: 4, dividend: 3 } },
  { symbol: 'GOOGL', name: 'Alphabet', price: 175.98, change: 2.1, sector: 'Technology', marketCap: '$2.2T', snowflake: { value: 4, future: 4, past: 4, health: 5, dividend: 1 } },
  { symbol: 'PG', name: 'Procter & Gamble', price: 165.80, change: 0.5, sector: 'Consumer Staples', marketCap: '$391B', snowflake: { value: 3, future: 3, past: 4, health: 5, dividend: 4 } },
  { symbol: 'KO', name: 'Coca-Cola', price: 62.40, change: 0.1, sector: 'Consumer Staples', marketCap: '$269B', snowflake: { value: 3, future: 3, past: 4, health: 4, dividend: 5 } },
  { symbol: 'TSLA', name: 'Tesla', price: 245.80, change: 3.5, sector: 'Automotive', marketCap: '$780B', snowflake: { value: 1, future: 4, past: 3, health: 4, dividend: 0 } },
  { symbol: 'META', name: 'Meta Platforms', price: 505.30, change: 2.5, sector: 'Technology', marketCap: '$1.3T', snowflake: { value: 3, future: 4, past: 5, health: 5, dividend: 1 } },
  { symbol: 'ABBV', name: 'AbbVie', price: 172.50, change: 1.2, sector: 'Healthcare', marketCap: '$304B', snowflake: { value: 4, future: 3, past: 4, health: 3, dividend: 5 } },
  { symbol: 'BABA', name: 'Alibaba', price: 78.30, change: 1.8, sector: 'E-Commerce', marketCap: '$198B', snowflake: { value: 5, future: 4, past: 3, health: 5, dividend: 2 } },
  { symbol: 'AMD', name: 'AMD', price: 178.30, change: 3.1, sector: 'Technology', marketCap: '$288B', snowflake: { value: 2, future: 4, past: 4, health: 4, dividend: 0 } },
  { symbol: 'DIS', name: 'Walt Disney', price: 112.50, change: -0.5, sector: 'Media', marketCap: '$206B', snowflake: { value: 3, future: 3, past: 2, health: 3, dividend: 1 } },
  { symbol: 'MMM', name: '3M Company', price: 105.20, change: -0.8, sector: 'Industrials', marketCap: '$58B', snowflake: { value: 5, future: 3, past: 2, health: 3, dividend: 5 } },
  { symbol: 'CEG', name: 'Constellation Energy', price: 230.50, change: 1.5, sector: 'Utilities', marketCap: '$73B', snowflake: { value: 3, future: 4, past: 4, health: 4, dividend: 2 } },
];

const dimensions = [
  { key: 'value' as const, label: 'Value', icon: Star, color: 'text-amber-500', desc: 'How undervalued vs fair value' },
  { key: 'future' as const, label: 'Future', icon: TrendingUp, color: 'text-blue-500', desc: 'Forecast earnings growth' },
  { key: 'past' as const, label: 'Past', icon: BarChart3, color: 'text-emerald-500', desc: 'Historical performance track record' },
  { key: 'health' as const, label: 'Health', icon: Shield, color: 'text-violet-500', desc: 'Balance sheet & financial stability' },
  { key: 'dividend' as const, label: 'Dividend', icon: DollarSign, color: 'text-orange-500', desc: 'Dividend yield & sustainability' },
];

const SnowflakeVisual: React.FC<{ score: ScreenerStock['snowflake']; size?: number }> = ({ score, size = 80 }) => {
  const center = size / 2;
  const radius = (size / 2) - 8;
  const dims = ['value', 'future', 'past', 'health', 'dividend'] as const;

  const points = dims.map((dim, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const r = (score[dim] / 5) * radius;
    return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
  }).join(' ');

  const gridPoints = dims.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${center + radius * Math.cos(angle)},${center + radius * Math.sin(angle)}`;
  }).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={gridPoints} fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
      {[0.2, 0.4, 0.6, 0.8].map(scale => (
        <polygon
          key={scale}
          points={dims.map((_, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const r = scale * radius;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          }).join(' ')}
          fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"
        />
      ))}
      <polygon points={points} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth="2" />
      {dims.map((dim, i) => {
        const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = (score[dim] / 5) * radius;
        return (
          <circle key={dim} cx={center + r * Math.cos(angle)} cy={center + r * Math.sin(angle)} r="3" fill="hsl(var(--primary))" />
        );
      })}
    </svg>
  );
};

function generateRandomSnowflake(): ScreenerStock['snowflake'] {
  return {
    value: Math.floor(Math.random() * 5) + 1,
    future: Math.floor(Math.random() * 5) + 1,
    past: Math.floor(Math.random() * 5) + 1,
    health: Math.floor(Math.random() * 5) + 1,
    dividend: Math.floor(Math.random() * 4),
  };
}

const SnowflakeScreener: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [stocks, setStocks] = useState<ScreenerStock[]>(isDemoMode ? defaultStocks : []);
  const [filters, setFilters] = useState({ value: [0, 5], future: [0, 5], past: [0, 5], health: [0, 5], dividend: [0, 5] });
  const [minTotal, setMinTotal] = useState(0);
  const [selectedStock, setSelectedStock] = useState<ScreenerStock | null>(null);

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const s = stock.snowflake;
      const total = s.value + s.future + s.past + s.health + s.dividend;
      return (
        s.value >= filters.value[0] && s.value <= filters.value[1] &&
        s.future >= filters.future[0] && s.future <= filters.future[1] &&
        s.past >= filters.past[0] && s.past <= filters.past[1] &&
        s.health >= filters.health[0] && s.health <= filters.health[1] &&
        s.dividend >= filters.dividend[0] && s.dividend <= filters.dividend[1] &&
        total >= minTotal
      );
    });
  }, [stocks, filters, minTotal]);

  const resetFilters = () => {
    setFilters({ value: [0, 5], future: [0, 5], past: [0, 5], health: [0, 5], dividend: [0, 5] });
    setMinTotal(0);
  };

  const handleAddStock = (symbol: string, name: string) => {
    if (stocks.find(s => s.symbol === symbol)) return;
    const newStock: ScreenerStock = {
      symbol, name, price: Math.round(Math.random() * 500 + 20), change: +(Math.random() * 8 - 2).toFixed(1),
      sector: 'Custom', marketCap: 'N/A', snowflake: generateRandomSnowflake(),
    };
    setStocks(prev => [newStock, ...prev]);
  };

  const handleRemoveStock = (symbol: string) => {
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
    if (selectedStock?.symbol === symbol) setSelectedStock(null);
  };

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Showing sample data. Sign in for full screening.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><Snowflake className="w-6 h-6 text-primary" /></div>
            Snowflake Screener
          </h1>
          <p className="text-muted-foreground">Filter stocks visually by fundamental dimensions</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{filteredStocks.length} results</Badge>
          <Button variant="outline" size="sm" onClick={resetFilters}><RotateCcw className="w-3 h-3 mr-1" /> Reset</Button>
        </div>
      </div>

      {/* Search & Add */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Add Stock to Screener</span>
          </div>
          <div className="max-w-md">
            <StockSearchAutocomplete onSelect={handleAddStock} placeholder="Search & add stock (e.g. AAPL, Tesla)..." />
          </div>
        </CardContent>
      </Card>

      {/* Filter Controls */}
      <Card className="border-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Snowflake Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {dimensions.map(dim => {
              const Icon = dim.icon;
              return (
                <div key={dim.key} className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${dim.color}`} />
                    {dim.label}: {filters[dim.key][0]}–{filters[dim.key][1]}
                  </label>
                  <Slider min={0} max={5} step={1} value={filters[dim.key]} onValueChange={(val) => setFilters(prev => ({ ...prev, [dim.key]: val }))} className="w-full" />
                </div>
              );
            })}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 text-primary" /> Min Total: {minTotal}/25
              </label>
              <Slider min={0} max={25} step={1} value={[minTotal]} onValueChange={([val]) => setMinTotal(val)} className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStocks.map(stock => {
          const total = stock.snowflake.value + stock.snowflake.future + stock.snowflake.past + stock.snowflake.health + stock.snowflake.dividend;
          return (
            <Card
              key={stock.symbol}
              className="hover:border-primary/30 transition-all cursor-pointer group hover:shadow-md"
              onClick={() => setSelectedStock(stock)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-lg text-foreground">{stock.symbol}</span>
                      <Badge variant="outline" className="text-[10px]">{stock.sector}</Badge>
                      {!defaultStocks.find(d => d.symbol === stock.symbol) && (
                        <button onClick={e => { e.stopPropagation(); handleRemoveStock(stock.symbol); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{stock.name}</span>
                  </div>
                  <SnowflakeVisual score={stock.snowflake} size={64} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-foreground">${stock.price.toFixed(2)}</div>
                    <div className={`text-xs font-medium flex items-center gap-0.5 ${stock.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {stock.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(stock.change)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Score</div>
                    <div className="text-xl font-bold text-primary">{total}<span className="text-xs text-muted-foreground">/25</span></div>
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {dimensions.map(dim => (
                    <div key={dim.key} className="flex-1 text-center">
                      <div className="text-[9px] text-muted-foreground uppercase">{dim.label[0]}</div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(stock.snowflake[dim.key] / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredStocks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Snowflake className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No stocks match your filters</p>
          <p className="text-sm">Try widening your criteria</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedStock} onOpenChange={() => setSelectedStock(null)}>
        <DialogContent className="max-w-lg">
          {selectedStock && (() => {
            const total = selectedStock.snowflake.value + selectedStock.snowflake.future + selectedStock.snowflake.past + selectedStock.snowflake.health + selectedStock.snowflake.dividend;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{selectedStock.symbol}</span>
                    <Badge variant="outline">{selectedStock.sector}</Badge>
                    <span className="text-muted-foreground text-base font-normal">{selectedStock.name}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-6 py-4">
                  <SnowflakeVisual score={selectedStock.snowflake} size={140} />
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-foreground">${selectedStock.price.toFixed(2)}</div>
                    <div className={`text-sm font-medium flex items-center gap-1 ${selectedStock.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedStock.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {Math.abs(selectedStock.change)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Market Cap: {selectedStock.marketCap}</div>
                    <div className="text-2xl font-bold text-primary mt-2">{total}<span className="text-sm text-muted-foreground">/25</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  {dimensions.map(dim => {
                    const Icon = dim.icon;
                    const val = selectedStock.snowflake[dim.key];
                    return (
                      <div key={dim.key} className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${dim.color}`} />
                        <span className="text-sm font-medium text-foreground w-20">{dim.label}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(val / 5) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold text-foreground w-8 text-right">{val}/5</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {dimensions.map(d => `${d.label}: ${d.desc}`).join(' · ')}
                </p>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SnowflakeScreener;
