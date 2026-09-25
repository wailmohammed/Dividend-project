import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Layers, AlertTriangle, CheckCircle, PieChart as PieChartIcon, BarChart2, RefreshCw, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

// Simulated ETF underlying holdings data
const ETF_HOLDINGS: Record<string, { symbol: string; name: string; weight: number; sector: string }[]> = {
  VOO: [
    { symbol: 'AAPL', name: 'Apple Inc.', weight: 7.2, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', weight: 6.8, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 3.4, sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 3.2, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. A', weight: 2.1, sector: 'Communication Services' },
    { symbol: 'META', name: 'Meta Platforms Inc.', weight: 1.9, sector: 'Communication Services' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', weight: 1.7, sector: 'Financials' },
    { symbol: 'UNH', name: 'UnitedHealth Group', weight: 1.3, sector: 'Healthcare' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 1.2, sector: 'Healthcare' },
    { symbol: 'JPM', name: 'JPMorgan Chase', weight: 1.2, sector: 'Financials' },
    { symbol: 'V', name: 'Visa Inc.', weight: 1.1, sector: 'Financials' },
    { symbol: 'PG', name: 'Procter & Gamble', weight: 1.0, sector: 'Consumer Staples' },
    { symbol: 'XOM', name: 'Exxon Mobil', weight: 1.0, sector: 'Energy' },
    { symbol: 'HD', name: 'The Home Depot', weight: 0.9, sector: 'Consumer Discretionary' },
    { symbol: 'MA', name: 'Mastercard Inc.', weight: 0.9, sector: 'Financials' },
  ],
  QQQ: [
    { symbol: 'AAPL', name: 'Apple Inc.', weight: 11.0, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', weight: 10.2, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 5.5, sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 5.1, sector: 'Technology' },
    { symbol: 'META', name: 'Meta Platforms Inc.', weight: 4.2, sector: 'Communication Services' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. A', weight: 3.5, sector: 'Communication Services' },
    { symbol: 'GOOG', name: 'Alphabet Inc. C', weight: 3.4, sector: 'Communication Services' },
    { symbol: 'TSLA', name: 'Tesla Inc.', weight: 2.8, sector: 'Consumer Discretionary' },
    { symbol: 'AVGO', name: 'Broadcom Inc.', weight: 2.5, sector: 'Technology' },
    { symbol: 'COST', name: 'Costco Wholesale', weight: 2.1, sector: 'Consumer Staples' },
    { symbol: 'PEP', name: 'PepsiCo Inc.', weight: 1.8, sector: 'Consumer Staples' },
    { symbol: 'ADBE', name: 'Adobe Inc.', weight: 1.6, sector: 'Technology' },
    { symbol: 'CSCO', name: 'Cisco Systems', weight: 1.5, sector: 'Technology' },
    { symbol: 'NFLX', name: 'Netflix Inc.', weight: 1.4, sector: 'Communication Services' },
    { symbol: 'AMD', name: 'Advanced Micro Devices', weight: 1.3, sector: 'Technology' },
  ],
  SPY: [
    { symbol: 'AAPL', name: 'Apple Inc.', weight: 7.1, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', weight: 6.7, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 3.3, sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 3.1, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc. A', weight: 2.0, sector: 'Communication Services' },
    { symbol: 'META', name: 'Meta Platforms Inc.', weight: 1.8, sector: 'Communication Services' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', weight: 1.7, sector: 'Financials' },
    { symbol: 'UNH', name: 'UnitedHealth Group', weight: 1.3, sector: 'Healthcare' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 1.2, sector: 'Healthcare' },
    { symbol: 'JPM', name: 'JPMorgan Chase', weight: 1.1, sector: 'Financials' },
  ],
  VTI: [
    { symbol: 'AAPL', name: 'Apple Inc.', weight: 6.5, sector: 'Technology' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', weight: 6.1, sector: 'Technology' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', weight: 3.0, sector: 'Consumer Discretionary' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', weight: 2.9, sector: 'Technology' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', weight: 1.9, sector: 'Communication Services' },
    { symbol: 'META', name: 'Meta Platforms', weight: 1.7, sector: 'Communication Services' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', weight: 1.5, sector: 'Financials' },
    { symbol: 'JPM', name: 'JPMorgan Chase', weight: 1.1, sector: 'Financials' },
    { symbol: 'UNH', name: 'UnitedHealth', weight: 1.1, sector: 'Healthcare' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 1.0, sector: 'Healthcare' },
  ],
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(328, 85%, 57%)',
  'hsl(45, 93%, 47%)',
  'hsl(173, 80%, 40%)',
  'hsl(280, 67%, 44%)',
];

const ETFLookThrough: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const [search, setSearch] = useState('');
  const [selectedETF, setSelectedETF] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; change: number; changePct: number; source: string }>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);

  // Fetch live prices for ETF underlying holdings
  const fetchLivePrices = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setIsLoadingPrices(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-data', {
        body: { symbols, type: 'stock' },
      });
      if (!error && data?.prices) {
        const priceMap: Record<string, { price: number; change: number; changePct: number; source: string }> = {};
        for (const [sym, info] of Object.entries(data.prices)) {
          const d = info as any;
          priceMap[sym] = { price: d.price, change: d.change || 0, changePct: d.changePercent || 0, source: d.source || 'unknown' };
        }
        setLivePrices(prev => ({ ...prev, ...priceMap }));
      }
    } catch (err) {
      console.error('Failed to fetch ETF underlying prices:', err);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  // Fetch prices when selected ETF changes
  const activeETFRef = React.useRef<string | null>(null);
  useEffect(() => {
    // Determine which ETF to load - use selected or first known ETF
    const knownETFs = Object.keys(ETF_HOLDINGS);
    const etf = selectedETF || knownETFs[0] || null;
    if (etf && etf !== activeETFRef.current && ETF_HOLDINGS[etf]) {
      activeETFRef.current = etf;
      const symbols = ETF_HOLDINGS[etf].map(h => h.symbol);
      fetchLivePrices(symbols);
    }
  }, [selectedETF]);

  // Identify ETFs in portfolio
  const etfHoldings = useMemo(() => {
    return holdings.filter(h => h.assetType === 'ETF' || ETF_HOLDINGS[h.symbol]);
  }, [holdings]);

  // Get available ETFs (portfolio + known ETFs)
  const availableETFs = useMemo(() => {
    const etfSymbols = new Set([
      ...etfHoldings.map(h => h.symbol),
      ...Object.keys(ETF_HOLDINGS),
    ]);
    return Array.from(etfSymbols)
      .filter(s => ETF_HOLDINGS[s])
      .filter(s => s.toLowerCase().includes(search.toLowerCase()));
  }, [etfHoldings, search]);

  const activeETF = selectedETF || availableETFs[0] || null;
  const etfUnderlying = activeETF ? ETF_HOLDINGS[activeETF] || [] : [];

  // Find overlaps between ETF underlying and individual holdings
  const overlaps = useMemo(() => {
    if (!activeETF) return [];
    const individualHoldings = holdings.filter(h => h.assetType !== 'ETF' && !ETF_HOLDINGS[h.symbol]);
    const individualSymbols = new Set(individualHoldings.map(h => h.symbol));

    return etfUnderlying
      .filter(u => individualSymbols.has(u.symbol))
      .map(u => {
        const holding = individualHoldings.find(h => h.symbol === u.symbol)!;
        const directWeight = totalValue > 0 ? (holding.shares * holding.currentPrice / totalValue) * 100 : 0;
        const etfHolding = holdings.find(h => h.symbol === activeETF);
        const etfWeight = etfHolding && totalValue > 0 ? (etfHolding.shares * etfHolding.currentPrice / totalValue) * 100 : 0;
        const indirectWeight = (u.weight / 100) * etfWeight;
        return {
          symbol: u.symbol,
          name: u.name,
          directWeight,
          indirectWeight,
          totalExposure: directWeight + indirectWeight,
          etfWeight: u.weight,
        };
      })
      .sort((a, b) => b.totalExposure - a.totalExposure);
  }, [activeETF, holdings, etfUnderlying, totalValue]);

  // Sector breakdown of ETF
  const sectorBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    etfUnderlying.forEach(h => {
      map[h.sector] = (map[h.sector] || 0) + h.weight;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [etfUnderlying]);

  // In-portfolio check
  const isInPortfolio = (symbol: string) => holdings.some(h => h.symbol === symbol);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">ETF Look-Through Analysis</h2>
        <p className="text-muted-foreground">See underlying stock exposure and overlap with your individual holdings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ETF Selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select ETF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search ETFs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {availableETFs.map(etf => (
                <button
                  key={etf}
                  onClick={() => setSelectedETF(etf)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeETF === etf
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{etf}</span>
                    {isInPortfolio(etf) && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Held</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{ETF_HOLDINGS[etf]?.length || 0} stocks</span>
                </button>
              ))}
              {availableETFs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No ETFs found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeETF ? (
            <>
              {/* Overlap Warning */}
              {overlaps.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      Overlap Detected — {overlaps.length} stock{overlaps.length > 1 ? 's' : ''}
                    </CardTitle>
                    <CardDescription>You hold these stocks directly AND through {activeETF}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {overlaps.map(o => (
                        <div key={o.symbol} className="flex items-center justify-between p-2 rounded-lg bg-background border">
                          <div>
                            <span className="font-bold text-sm">{o.symbol}</span>
                            <span className="text-xs text-muted-foreground ml-2">{o.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="text-right">
                              <div className="text-muted-foreground">Direct</div>
                              <div className="font-medium">{o.directWeight.toFixed(1)}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-muted-foreground">Via {activeETF}</div>
                              <div className="font-medium">{o.indirectWeight.toFixed(2)}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-muted-foreground">Total</div>
                              <div className="font-bold text-amber-600 dark:text-amber-400">{o.totalExposure.toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {overlaps.length === 0 && (
                <Card className="border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5">
                  <CardContent className="flex items-center gap-2 py-4">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-400">No overlap between {activeETF} underlying holdings and your individual stocks</span>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sector Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4" />
                      {activeETF} Sector Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-[140px] h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={sectorBreakdown} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={2} strokeWidth={0}>
                              {sectorBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(val: number) => `${val.toFixed(1)}%`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-1.5 max-h-[140px] overflow-y-auto">
                        {sectorBreakdown.map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                            </div>
                            <span className="font-medium">{item.value.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Holdings Bar Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="w-4 h-4" />
                      Top Holdings Weight
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={etfUnderlying.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                          <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={50} />
                          <Tooltip formatter={(val: number) => `${val}%`} />
                          <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Full Holdings Table */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        {activeETF} — All Underlying Holdings
                      </CardTitle>
                      <CardDescription>Top {etfUnderlying.length} holdings with live prices</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchLivePrices(etfUnderlying.map(h => h.symbol))}
                      disabled={isLoadingPrices}
                      className="gap-1.5"
                    >
                      {isLoadingPrices ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Refresh Prices
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">#</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Symbol</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Name</th>
                          <th className="text-left py-2 px-2 font-medium text-muted-foreground">Sector</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Weight</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Price</th>
                          <th className="text-right py-2 px-2 font-medium text-muted-foreground">Change</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">In Portfolio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {etfUnderlying.map((h, i) => {
                          const held = isInPortfolio(h.symbol);
                          const liveData = livePrices[h.symbol];
                          return (
                            <tr key={h.symbol} className={`border-b border-muted hover:bg-muted/30 transition-colors ${held ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''}`}>
                              <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                              <td className="py-2 px-2 font-bold">{h.symbol}</td>
                              <td className="py-2 px-2 text-muted-foreground">{h.name}</td>
                              <td className="py-2 px-2">
                                <Badge variant="outline" className="text-xs">{h.sector}</Badge>
                              </td>
                              <td className="py-2 px-2 text-right font-medium">{h.weight.toFixed(1)}%</td>
                              <td className="py-2 px-2 text-right font-medium tabular-nums">
                                {liveData ? (
                                  <span>${liveData.price.toFixed(2)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {liveData ? (
                                  <span className={liveData.changePct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                    {liveData.changePct >= 0 ? '+' : ''}{liveData.changePct.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {held ? (
                                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-xs">Overlap</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {Object.keys(livePrices).length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Live prices from market data API
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">No ETF Selected</h3>
                <p className="text-muted-foreground">Select an ETF from the list to see its underlying holdings and overlap analysis</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ETFLookThrough;
