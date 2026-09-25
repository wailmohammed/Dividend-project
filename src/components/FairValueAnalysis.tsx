import { useMemo, useState, useEffect, useCallback } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Target, BarChart3, ArrowUp, ArrowDown, Minus, Info, RefreshCw, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FundamentalsData {
  symbol: string;
  fcf: number | null;
  eps: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  peRatio: number | null;
  forwardPe: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  dividendYield: number | null;
  roe: number | null;
  debtToEquity: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  dcfValue: number | null;
  currentPrice: number | null;
}

interface ValuationRow {
  symbol: string;
  name: string;
  currentPrice: number;
  fairValue: number | null;
  dcfValue: number | null;
  valuationStatus: 'undervalued' | 'fair' | 'overvalued' | 'unavailable';
  upside: number | null;
  peRatio: number;
  forwardPe: number;
  pbRatio: number;
  psRatio: number;
  currentYield: number;
  roe: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  value: number;
}

// Sector average P/E for comparable analysis
const SECTOR_PE: Record<string, number> = {
  'Technology': 30, 'Healthcare': 20, 'Financial Services': 13,
  'Consumer Defensive': 24, 'Consumer Cyclical': 22, 'Industrials': 20,
  'Energy': 12, 'Utilities': 18, 'Real Estate': 35,
  'Communication Services': 20, 'Basic Materials': 15,
};

const getValuationStatus = (price: number, fairValue: number | null): ValuationRow['valuationStatus'] => {
  if (!fairValue || fairValue <= 0 || price <= 0) return 'unavailable';
  const diff = ((price - fairValue) / fairValue) * 100;
  if (diff < -10) return 'undervalued';
  if (diff > 10) return 'overvalued';
  return 'fair';
};

const getValuationBadge = (status: ValuationRow['valuationStatus']) => {
  switch (status) {
    case 'undervalued':
      return <Badge className="bg-green-500"><ArrowDown className="w-3 h-3 mr-1" />Undervalued</Badge>;
    case 'fair':
      return <Badge variant="secondary"><Minus className="w-3 h-3 mr-1" />Fair Value</Badge>;
    case 'overvalued':
      return <Badge className="bg-red-500"><ArrowUp className="w-3 h-3 mr-1" />Overvalued</Badge>;
    case 'unavailable':
      return <Badge variant="outline">No estimate</Badge>;
  }
};

// Local cache
const CACHE_KEY = 'wealthos_fv_fundamentals_v1';
const CACHE_TTL = 12 * 60 * 60 * 1000;

const getCachedFundamentals = (): Record<string, FundamentalsData> | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
  } catch {}
  return null;
};

const setCachedFundamentals = (data: Record<string, FundamentalsData>) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
};

export const FairValueAnalysis = () => {
  const { activePortfolio } = usePortfolio();
  const [selectedStock, setSelectedStock] = useState('');
  const [sortBy, setSortBy] = useState<'upside' | 'pe' | 'yield'>('upside');
  const [fundamentals, setFundamentals] = useState<Record<string, FundamentalsData>>({});
  const [marketCache, setMarketCache] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'static' | 'live'>('static');

  const holdings = activePortfolio?.holdings || [];
  const symbols = useMemo(() => holdings.map(h => h.symbol?.replace('.US', '').toUpperCase()), [holdings]);

  const fetchLiveData = useCallback(async () => {
    if (symbols.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stock-fundamentals', {
        body: { symbols },
      });
      if (error) throw error;
      if (data?.fundamentals) {
        setFundamentals(data.fundamentals);
        setCachedFundamentals(data.fundamentals);
        setDataSource('live');
        toast.success('Live fundamentals loaded');
      }
    } catch (err) {
      console.warn('Failed to fetch live fundamentals:', err);
      toast.error('Could not fetch live fundamentals. Valuation estimates may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  // Fetch fallback P/E, P/B from market_data_cache
  const fetchMarketCache = useCallback(async () => {
    if (symbols.length === 0) return;
    try {
      const { data } = await supabase
        .from('market_data_cache')
        .select('symbol, pe_ratio, eps, dividend_yield, sector')
        .in('symbol', symbols);
      if (data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => { map[row.symbol] = row; });
        setMarketCache(map);
      }
    } catch {}
  }, [symbols]);

  // Load cached data on mount, then fetch live
  useEffect(() => {
    const cached = getCachedFundamentals();
    if (cached) {
      setFundamentals(cached);
      setDataSource('live');
    }
    if (symbols.length > 0) {
      fetchLiveData();
      fetchMarketCache();
    }
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build valuation data
  const valuationData = useMemo((): ValuationRow[] => {
    return holdings.map(h => {
      const sym = h.symbol?.replace('.US', '').toUpperCase();
      const f = fundamentals[sym];
      const mc = marketCache[sym];
      const price = f?.currentPrice ?? h.currentPrice;
      const dcfValue = f?.dcfValue ?? null;

      // Compute fair value: prefer DCF, fallback to sector-comparable P/E
      let fairValue: number | null = null;
      if (dcfValue && dcfValue > 0) {
        fairValue = dcfValue;
      } else if (f?.eps && f.eps > 0) {
        const sectorPe = SECTOR_PE[f.sector || h.sector || ''] || 20;
        fairValue = f.eps * sectorPe;
      }

      const upside = fairValue !== null && price > 0 ? ((fairValue - price) / price) * 100 : null;

      // Use fundamentals first, then market_data_cache as fallback
      const peRatio = f?.peRatio ?? mc?.pe_ratio ?? 0;
      const pbRatio = f?.pbRatio ?? 0;
      const currentYield = f?.dividendYield ?? mc?.dividend_yield ?? h.dividendYield ?? 0;

      return {
        symbol: sym,
        name: h.name,
        currentPrice: price,
        fairValue,
        dcfValue,
        valuationStatus: getValuationStatus(price, fairValue),
        upside,
        peRatio,
        forwardPe: f?.forwardPe ?? 0,
        pbRatio,
        psRatio: f?.psRatio ?? 0,
        currentYield,
        roe: f?.roe ?? null,
        revenueGrowth: f?.revenueGrowth ?? null,
        epsGrowth: f?.epsGrowth ?? null,
        value: h.shares * price,
      };
    }).sort((a, b) => {
      switch (sortBy) {
        case 'upside': return (b.upside ?? -Infinity) - (a.upside ?? -Infinity);
        case 'pe': return a.peRatio - b.peRatio;
        case 'yield': return b.currentYield - a.currentYield;
        default: return 0;
      }
    });
  }, [holdings, fundamentals, marketCache, sortBy]);

  // Set initial selected stock
  useEffect(() => {
    if (valuationData.length > 0 && !selectedStock) {
      setSelectedStock(valuationData[0].symbol);
    }
  }, [valuationData, selectedStock]);

  const selectedStockData = valuationData.find(d => d.symbol === selectedStock);

  const valuationComparison = selectedStockData?.fairValue === null || !selectedStockData
    ? []
    : [
      { measure: 'Current price', value: selectedStockData.currentPrice },
      { measure: 'Fair value estimate', value: selectedStockData.fairValue },
    ];

  // Portfolio summary
  const portfolioSummary = useMemo(() => {
    const estimatedRows = valuationData.filter((d): d is ValuationRow & { upside: number } => d.upside !== null);
    if (estimatedRows.length === 0) return null;
    const totalValue = estimatedRows.reduce((sum, d) => sum + d.value, 0);
    const undervalued = estimatedRows.filter(d => d.valuationStatus === 'undervalued');
    const overvalued = estimatedRows.filter(d => d.valuationStatus === 'overvalued');
    const weightedUpside = totalValue > 0 ? estimatedRows.reduce((sum, d) => sum + (d.upside * (d.value / totalValue)), 0) : 0;
    return {
      undervaluedCount: undervalued.length,
      overvaluedCount: overvalued.length,
      fairValueCount: estimatedRows.filter(d => d.valuationStatus === 'fair').length,
      weightedUpside,
      estimatedCount: estimatedRows.length,
    };
  }, [valuationData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Fair Value Analysis
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {dataSource === 'live' ? (
              <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">PROVIDER DATA</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">ON-FILE DATA</Badge>
            )}
            Provider DCF where available; otherwise a sector P/E estimate
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLiveData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Refresh
          </Button>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upside">By Upside</SelectItem>
              <SelectItem value="pe">By P/E Ratio</SelectItem>
              <SelectItem value="yield">By Yield</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Portfolio Summary */}
      {portfolioSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Undervalued</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{portfolioSummary.undervaluedCount}</div>
              <p className="text-xs text-muted-foreground">of {valuationData.length} holdings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fair Value</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolioSummary.fairValueCount}</div>
              <p className="text-xs text-muted-foreground">Estimated holdings</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overvalued</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{portfolioSummary.overvaluedCount}</div>
              <p className="text-xs text-muted-foreground">of {valuationData.length} holdings</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Portfolio Upside</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${portfolioSummary.weightedUpside >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {portfolioSummary.weightedUpside >= 0 ? '+' : ''}{portfolioSummary.weightedUpside.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Across {portfolioSummary.estimatedCount} estimated holdings</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stock Selector for Charts */}
      {valuationData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-lg">Price vs Fair Value</CardTitle>
              <Select value={selectedStock} onValueChange={setSelectedStock}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {valuationData.map(d => (
                    <SelectItem key={d.symbol} value={d.symbol}>
                      {d.symbol} - {d.name.substring(0, 15)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {selectedStockData && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 flex-wrap gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-2xl font-bold">${selectedStockData.currentPrice.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    {getValuationBadge(selectedStockData.valuationStatus)}
                    <p className={`text-lg font-bold mt-1 ${selectedStockData.upside === null ? 'text-muted-foreground' : selectedStockData.upside >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedStockData.upside === null ? 'Estimate unavailable' : `${selectedStockData.upside >= 0 ? '+' : ''}${selectedStockData.upside.toFixed(1)}% potential`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {selectedStockData.fairValue === null ? 'Fair value' : selectedStockData.dcfValue ? 'Provider DCF estimate' : 'Sector P/E estimate'}
                    </p>
                    <p className="text-2xl font-bold text-primary">{selectedStockData.fairValue === null ? '—' : `$${selectedStockData.fairValue.toFixed(2)}`}</p>
                  </div>
                </div>

                {/* Key fundamentals row */}
                {dataSource === 'live' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {selectedStockData.roe !== null && (
                      <div className="text-center p-2 rounded bg-muted/20">
                        <p className="text-xs text-muted-foreground">ROE</p>
                        <p className="font-bold">{selectedStockData.roe.toFixed(1)}%</p>
                      </div>
                    )}
                    {selectedStockData.revenueGrowth !== null && (
                      <div className="text-center p-2 rounded bg-muted/20">
                        <p className="text-xs text-muted-foreground">Rev Growth</p>
                        <p className="font-bold">{selectedStockData.revenueGrowth.toFixed(1)}%</p>
                      </div>
                    )}
                    {selectedStockData.epsGrowth !== null && (
                      <div className="text-center p-2 rounded bg-muted/20">
                        <p className="text-xs text-muted-foreground">EPS Growth</p>
                        <p className="font-bold">{selectedStockData.epsGrowth.toFixed(1)}%</p>
                      </div>
                    )}
                    {selectedStockData.pbRatio > 0 && (
                      <div className="text-center p-2 rounded bg-muted/20">
                        <p className="text-xs text-muted-foreground">P/B</p>
                        <p className="font-bold">{selectedStockData.pbRatio.toFixed(1)}x</p>
                      </div>
                    )}
                  </div>
                )}

                {valuationComparison.length > 0 ? (
                  <div role="img" aria-label={`Current price and fair value estimate for ${selectedStockData.symbol}`} className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={valuationComparison} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="measure" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                        <Bar dataKey="value" name="Price / estimate" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Fair-value data is unavailable for this holding. No estimate is shown.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Holdings Valuation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Valuation Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {valuationData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Symbol</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Price</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Fair Value</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Upside</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">P/E</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">P/B</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Yield</th>
                  </tr>
                </thead>
                <tbody>
                  {valuationData.map(stock => (
                    <tr
                      key={stock.symbol}
                      className={`border-b border-border hover:bg-muted/50 cursor-pointer ${selectedStock === stock.symbol ? 'bg-muted/30' : ''}`}
                      onClick={() => setSelectedStock(stock.symbol)}
                    >
                      <td className="py-3 px-2"><span className="font-medium">{stock.symbol}</span></td>
                      <td className="py-3 px-2 text-center">{getValuationBadge(stock.valuationStatus)}</td>
                      <td className="py-3 px-2 text-right font-medium">${stock.currentPrice.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right text-primary">{stock.fairValue === null ? '—' : `$${stock.fairValue.toFixed(2)}`}</td>
                      <td className="py-3 px-2 text-right">
                        <span className={stock.upside === null ? 'text-muted-foreground' : stock.upside >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {stock.upside === null ? '—' : `${stock.upside >= 0 ? '+' : ''}${stock.upside.toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">{stock.peRatio > 0 ? `${stock.peRatio.toFixed(1)}x` : '-'}</td>
                      <td className="py-3 px-2 text-right">{stock.pbRatio > 0 ? `${stock.pbRatio.toFixed(1)}x` : '-'}</td>
                      <td className="py-3 px-2 text-right">{stock.currentYield > 0 ? `${stock.currentYield.toFixed(2)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No holdings to analyze</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Provider DCF values are shown when available. Otherwise, an EPS × sector P/E heuristic is labeled as a sector P/E estimate; it is not a provider price target. Missing estimates stay blank. Market data and fundamentals depend on the connected provider and may be delayed. Informational only, not investment advice.
        </AlertDescription>
      </Alert>
    </div>
  );
};
