import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { supabase } from '@/integrations/supabase/client';
import { 
  Filter, Search, TrendingUp, DollarSign, Building2, Percent,
  Star, Plus, RotateCcw, ArrowUpDown, ChevronUp, ChevronDown,
  FlaskConical, RefreshCw, Loader2
} from 'lucide-react';

interface ScreenerStock {
  symbol: string;
  name: string;
  price: number;
  dividendYield: number;
  peRatio: number;
  marketCap: number;
  sector: string;
  country: string;
  beta: number;
  payoutRatio: number;
  priceChange: number;
  volume: number;
}

// Demo fallback data (only used when demo mode is active)
const DEMO_STOCKS: ScreenerStock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, dividendYield: 0.5, peRatio: 28.5, marketCap: 2800000, sector: 'Technology', country: 'US', beta: 1.2, payoutRatio: 15, priceChange: 1.2, volume: 65000000 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.20, dividendYield: 0.8, peRatio: 32.1, marketCap: 2600000, sector: 'Technology', country: 'US', beta: 0.9, payoutRatio: 25, priceChange: 0.8, volume: 25000000 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 158.30, dividendYield: 3.0, peRatio: 15.2, marketCap: 400000, sector: 'Healthcare', country: 'US', beta: 0.5, payoutRatio: 45, priceChange: -0.3, volume: 8000000 },
  { symbol: 'PG', name: 'Procter & Gamble', price: 152.80, dividendYield: 2.5, peRatio: 24.8, marketCap: 360000, sector: 'Consumer Staples', country: 'US', beta: 0.4, payoutRatio: 60, priceChange: 0.5, volume: 6000000 },
  { symbol: 'KO', name: 'Coca-Cola Co.', price: 58.90, dividendYield: 3.1, peRatio: 22.5, marketCap: 255000, sector: 'Consumer Staples', country: 'US', beta: 0.6, payoutRatio: 70, priceChange: -0.2, volume: 12000000 },
  { symbol: 'O', name: 'Realty Income Corp.', price: 54.20, dividendYield: 5.8, peRatio: 38.2, marketCap: 42000, sector: 'Real Estate', country: 'US', beta: 0.9, payoutRatio: 85, priceChange: 0.3, volume: 4500000 },
  { symbol: 'VZ', name: 'Verizon Comm.', price: 38.50, dividendYield: 6.9, peRatio: 8.5, marketCap: 162000, sector: 'Communication Services', country: 'US', beta: 0.4, payoutRatio: 55, priceChange: -0.8, volume: 15000000 },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', price: 105.80, dividendYield: 3.5, peRatio: 10.2, marketCap: 420000, sector: 'Energy', country: 'US', beta: 1.1, payoutRatio: 35, priceChange: 1.5, volume: 18000000 },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 172.40, dividendYield: 2.4, peRatio: 11.2, marketCap: 500000, sector: 'Financials', country: 'US', beta: 1.1, payoutRatio: 28, priceChange: 0.9, volume: 10000000 },
  { symbol: 'UNH', name: 'UnitedHealth Group', price: 512.30, dividendYield: 1.4, peRatio: 21.5, marketCap: 470000, sector: 'Healthcare', country: 'US', beta: 0.7, payoutRatio: 30, priceChange: -1.2, volume: 3500000 },
  { symbol: 'HD', name: 'Home Depot Inc.', price: 342.80, dividendYield: 2.5, peRatio: 22.8, marketCap: 340000, sector: 'Consumer Discretionary', country: 'US', beta: 1.0, payoutRatio: 55, priceChange: 0.4, volume: 4000000 },
  { symbol: 'ABBV', name: 'AbbVie Inc.', price: 154.20, dividendYield: 4.0, peRatio: 45.2, marketCap: 272000, sector: 'Healthcare', country: 'US', beta: 0.6, payoutRatio: 65, priceChange: 0.6, volume: 7000000 },
  { symbol: 'PEP', name: 'PepsiCo Inc.', price: 168.50, dividendYield: 3.1, peRatio: 26.2, marketCap: 232000, sector: 'Consumer Staples', country: 'US', beta: 0.5, payoutRatio: 68, priceChange: 0.2, volume: 5500000 },
  { symbol: 'MRK', name: 'Merck & Co.', price: 108.40, dividendYield: 2.8, peRatio: 16.8, marketCap: 274000, sector: 'Healthcare', country: 'US', beta: 0.4, payoutRatio: 45, priceChange: -0.5, volume: 9000000 },
  { symbol: 'AVGO', name: 'Broadcom Inc.', price: 128.50, dividendYield: 1.6, peRatio: 25.8, marketCap: 540000, sector: 'Technology', country: 'US', beta: 1.2, payoutRatio: 40, priceChange: 2.1, volume: 4200000 },
  { symbol: 'T', name: 'AT&T Inc.', price: 17.20, dividendYield: 6.5, peRatio: 7.2, marketCap: 123000, sector: 'Communication Services', country: 'US', beta: 0.7, payoutRatio: 50, priceChange: -0.4, volume: 35000000 },
  { symbol: 'CVX', name: 'Chevron Corp.', price: 148.90, dividendYield: 4.2, peRatio: 11.5, marketCap: 275000, sector: 'Energy', country: 'US', beta: 1.0, payoutRatio: 48, priceChange: 0.7, volume: 8500000 },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 162.80, dividendYield: 1.3, peRatio: 28.5, marketCap: 440000, sector: 'Consumer Staples', country: 'US', beta: 0.5, payoutRatio: 38, priceChange: 0.3, volume: 7200000 },
  { symbol: 'COST', name: 'Costco Wholesale', price: 572.40, dividendYield: 0.7, peRatio: 42.5, marketCap: 254000, sector: 'Consumer Staples', country: 'US', beta: 0.7, payoutRatio: 30, priceChange: 1.1, volume: 2100000 },
  { symbol: 'NKE', name: 'Nike Inc.', price: 98.50, dividendYield: 1.5, peRatio: 28.2, marketCap: 150000, sector: 'Consumer Discretionary', country: 'US', beta: 1.1, payoutRatio: 42, priceChange: -0.6, volume: 6800000 },
];

const SECTORS = [
  'All Sectors', 'Technology', 'Healthcare', 'Financials', 'Consumer Staples',
  'Consumer Discretionary', 'Energy', 'Real Estate', 'Communication Services',
  'Industrials', 'Materials', 'Utilities'
];

const MARKET_CAP_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: 'Mega (>$200B)', value: 'mega' },
  { label: 'Large ($10B-$200B)', value: 'large' },
  { label: 'Mid ($2B-$10B)', value: 'mid' },
  { label: 'Small ($300M-$2B)', value: 'small' },
];

type SortKey = 'symbol' | 'dividendYield' | 'peRatio' | 'marketCap' | 'price' | 'priceChange';
type SortDirection = 'asc' | 'desc';

const StockScreener: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { viewStock } = usePortfolio();
  
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [marketCapFilter, setMarketCapFilter] = useState('any');
  const [dividendYieldRange, setDividendYieldRange] = useState([0, 10]);
  const [peRatioRange, setPeRatioRange] = useState([0, 50]);
  const [sortKey, setSortKey] = useState<SortKey>('dividendYield');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch stocks from market_data_cache for live users
  const fetchStocks = async () => {
    if (isDemoMode) {
      setStocks(DEMO_STOCKS);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('market_data_cache')
        .select('symbol, price, change_percent, dividend_yield, pe_ratio, market_cap, sector, volume')
        .order('market_cap', { ascending: false, nullsFirst: false })
        .limit(200);

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: ScreenerStock[] = data.map(row => ({
          symbol: row.symbol,
          name: row.symbol, // We'll enrich name below
          price: Number(row.price) || 0,
          dividendYield: Number(row.dividend_yield) || 0,
          peRatio: Number(row.pe_ratio) || 0,
          marketCap: Number(row.market_cap) || 0,
          sector: row.sector || 'Unknown',
          country: 'US',
          beta: 1.0,
          payoutRatio: 0,
          priceChange: Number(row.change_percent) || 0,
          volume: Number(row.volume) || 0,
        }));
        
        // Enrich names from holdings if available
        const { data: holdingsData } = await supabase
          .from('holdings')
          .select('symbol, name');
        
        const nameMap = new Map<string, string>();
        holdingsData?.forEach(h => nameMap.set(h.symbol, h.name));
        
        // Also check halal_stocks for names
        const { data: halalData } = await supabase
          .from('halal_stocks')
          .select('symbol, name');
        halalData?.forEach(h => nameMap.set(h.symbol, h.name));
        
        mapped.forEach(s => {
          if (nameMap.has(s.symbol)) {
            s.name = nameMap.get(s.symbol)!;
          }
        });
        
        setStocks(mapped);
      } else {
        // No cached data yet - show empty state for live users
        setStocks([]);
      }
    } catch (err) {
      console.error('Failed to fetch screener data:', err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
  }, [isDemoMode, user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStocks();
    setRefreshing(false);
  };

  // Preset filters
  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'high-dividend':
        setDividendYieldRange([4, 10]); setPeRatioRange([0, 50]); setSelectedSector('All Sectors'); setMarketCapFilter('any'); setSortKey('dividendYield'); setSortDirection('desc');
        break;
      case 'value':
        setDividendYieldRange([0, 10]); setPeRatioRange([0, 15]); setSelectedSector('All Sectors'); setMarketCapFilter('any'); setSortKey('peRatio'); setSortDirection('asc');
        break;
      case 'growth':
        setDividendYieldRange([0, 2]); setPeRatioRange([20, 50]); setSelectedSector('Technology'); setMarketCapFilter('any'); setSortKey('priceChange'); setSortDirection('desc');
        break;
      case 'dividend-aristocrats':
        setDividendYieldRange([2, 10]); setPeRatioRange([0, 30]); setSelectedSector('All Sectors'); setMarketCapFilter('large'); setSortKey('dividendYield'); setSortDirection('desc');
        break;
    }
  };

  const resetFilters = () => {
    setSearchQuery(''); setSelectedSector('All Sectors'); setMarketCapFilter('any');
    setDividendYieldRange([0, 10]); setPeRatioRange([0, 50]); setSortKey('dividendYield'); setSortDirection('desc');
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const filteredStocks = useMemo(() => {
    let result = stocks.filter(stock => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!stock.symbol.toLowerCase().includes(query) && !stock.name.toLowerCase().includes(query)) return false;
      }
      if (selectedSector !== 'All Sectors' && stock.sector !== selectedSector) return false;
      if (marketCapFilter !== 'any') {
        const cap = stock.marketCap;
        switch (marketCapFilter) {
          case 'mega': if (cap < 200000) return false; break;
          case 'large': if (cap < 10000 || cap >= 200000) return false; break;
          case 'mid': if (cap < 2000 || cap >= 10000) return false; break;
          case 'small': if (cap < 300 || cap >= 2000) return false; break;
        }
      }
      if (stock.dividendYield < dividendYieldRange[0] || stock.dividendYield > dividendYieldRange[1]) return false;
      if (stock.peRatio < peRatioRange[0] || stock.peRatio > peRatioRange[1]) return false;
      return true;
    });

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [stocks, searchQuery, selectedSector, marketCapFilter, dividendYieldRange, peRatioRange, sortKey, sortDirection]);

  const formatMarketCap = (cap: number) => {
    if (cap >= 1000000) return `$${(cap / 1000000).toFixed(1)}T`;
    if (cap >= 1000) return `$${(cap / 1000).toFixed(0)}B`;
    return `$${cap}M`;
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort(sortKeyName)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyName ? (
          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample stock data. Sign in and sync market data for live screener results.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stock Screener</h2>
          <p className="text-muted-foreground">Find stocks matching your investment criteria</p>
        </div>
        <div className="flex items-center gap-2">
          {!isDemoMode && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Refresh
            </Button>
          )}
          <Badge variant="outline">{filteredStocks.length} stocks found</Badge>
        </div>
      </div>

      {/* Quick Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4" />Quick Presets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => applyPreset('high-dividend')}><Percent className="w-4 h-4 mr-1" />High Dividend</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset('value')}><DollarSign className="w-4 h-4 mr-1" />Value Stocks</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset('growth')}><TrendingUp className="w-4 h-4 mr-1" />Growth Stocks</Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset('dividend-aristocrats')}><Star className="w-4 h-4 mr-1" />Dividend Aristocrats</Button>
            <Button variant="ghost" size="sm" onClick={resetFilters}><RotateCcw className="w-4 h-4 mr-1" />Reset All</Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" />Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Symbol or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sector</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger><Building2 className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent>{SECTORS.map(sector => (<SelectItem key={sector} value={sector}>{sector}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Market Cap</Label>
              <Select value={marketCapFilter} onValueChange={setMarketCapFilter}>
                <SelectTrigger><DollarSign className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
                <SelectContent>{MARKET_CAP_OPTIONS.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dividend Yield: {dividendYieldRange[0]}% - {dividendYieldRange[1]}%</Label>
              <Slider value={dividendYieldRange} onValueChange={setDividendYieldRange} min={0} max={10} step={0.5} className="py-2" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>P/E Ratio: {peRatioRange[0]} - {peRatioRange[1]}</Label>
              <Slider value={peRatioRange} onValueChange={setPeRatioRange} min={0} max={50} step={1} className="py-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Symbol" sortKeyName="symbol" />
              <TableHead>Name</TableHead>
              <SortHeader label="Price" sortKeyName="price" />
              <SortHeader label="Change" sortKeyName="priceChange" />
              <SortHeader label="Div Yield" sortKeyName="dividendYield" />
              <SortHeader label="P/E Ratio" sortKeyName="peRatio" />
              <SortHeader label="Market Cap" sortKeyName="marketCap" />
              <TableHead>Sector</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No stocks match your criteria. Try adjusting your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredStocks.map(stock => (
                <TableRow key={stock.symbol} className="cursor-pointer hover:bg-muted/50" onClick={() => viewStock(stock.symbol)}>
                  <TableCell className="font-bold">{stock.symbol}</TableCell>
                  <TableCell className="text-muted-foreground">{stock.name}</TableCell>
                  <TableCell>${stock.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={stock.priceChange >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {stock.priceChange >= 0 ? '+' : ''}{stock.priceChange.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stock.dividendYield >= 4 ? 'default' : 'secondary'}>
                      {stock.dividendYield.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>{stock.peRatio.toFixed(1)}</TableCell>
                  <TableCell>{formatMarketCap(stock.marketCap)}</TableCell>
                  <TableCell><Badge variant="outline">{stock.sector}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); viewStock(stock.symbol); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StockScreener;
