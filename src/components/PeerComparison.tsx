import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { Holding } from '@/types';

const PeerComparison: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const [search, setSearch] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const filteredHoldings = useMemo(() =>
    holdings.filter(h => h.symbol.toLowerCase().includes(search.toLowerCase()) || h.name.toLowerCase().includes(search.toLowerCase())),
    [holdings, search]
  );

  const activeHolding = selectedSymbol ? holdings.find(h => h.symbol === selectedSymbol) : filteredHoldings[0];

  // Get peers in the same sector
  const peers = useMemo(() => {
    if (!activeHolding) return [];
    return holdings
      .filter(h => h.sector === activeHolding.sector && h.symbol !== activeHolding.symbol)
      .slice(0, 5);
  }, [activeHolding, holdings]);

  // Also include the active holding's competitors if available
  const allPeers = useMemo(() => {
    if (!activeHolding) return [];
    const peerSymbols = new Set(peers.map(p => p.symbol));
    const compData = (activeHolding.competitors || [])
      .filter(c => !peerSymbols.has(c.symbol))
      .map(c => ({
        symbol: c.symbol,
        name: c.name,
        dividendYield: c.dividendYield,
        peRatio: c.peRatio,
        revenueGrowth: c.revenueGrowth,
        fromCompetitors: true,
      }));
    return [...peers.map(p => ({
      symbol: p.symbol,
      name: p.name,
      dividendYield: p.dividendYield,
      peRatio: 0,
      revenueGrowth: 0,
      snowflake: p.snowflake,
      currentPrice: p.currentPrice,
      avgPrice: p.avgPrice,
      safetyScore: p.safetyScore,
      fromCompetitors: false,
    })), ...compData];
  }, [activeHolding, peers]);

  // Comparison metrics bar chart data
  const barData = useMemo(() => {
    if (!activeHolding) return [];
    const all = [activeHolding, ...peers];
    return all.map(h => ({
      name: h.symbol,
      'Div Yield': h.dividendYield,
      'Safety': h.safetyScore / 20, // normalize to 0-5 scale
      'Value': h.snowflake.value,
      'Health': h.snowflake.health,
      'Future': h.snowflake.future,
    }));
  }, [activeHolding, peers]);

  // Radar comparison
  const radarData = useMemo(() => {
    if (!activeHolding || peers.length === 0) return [];
    const avg = {
      value: peers.reduce((s, p) => s + p.snowflake.value, 0) / peers.length,
      future: peers.reduce((s, p) => s + p.snowflake.future, 0) / peers.length,
      past: peers.reduce((s, p) => s + p.snowflake.past, 0) / peers.length,
      health: peers.reduce((s, p) => s + p.snowflake.health, 0) / peers.length,
      dividend: peers.reduce((s, p) => s + p.snowflake.dividend, 0) / peers.length,
    };
    return [
      { subject: 'Value', stock: activeHolding.snowflake.value, peers: avg.value },
      { subject: 'Future', stock: activeHolding.snowflake.future, peers: avg.future },
      { subject: 'Past', stock: activeHolding.snowflake.past, peers: avg.past },
      { subject: 'Health', stock: activeHolding.snowflake.health, peers: avg.health },
      { subject: 'Dividend', stock: activeHolding.snowflake.dividend, peers: avg.dividend },
    ];
  }, [activeHolding, peers]);

  const getReturnBadge = (h: Holding) => {
    const ret = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
    if (ret > 0) return <Badge className="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 text-xs">+{ret.toFixed(1)}%</Badge>;
    if (ret < 0) return <Badge className="bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 text-xs">{ret.toFixed(1)}%</Badge>;
    return <Badge variant="secondary" className="text-xs">0%</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Peer Comparison</h2>
        <p className="text-muted-foreground">Compare your holdings against industry peers across key metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Stock selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredHoldings.map(h => (
                <button
                  key={h.symbol}
                  onClick={() => setSelectedSymbol(h.symbol)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                    activeHolding?.symbol === h.symbol ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium">{h.symbol}</div>
                    <div className="text-xs text-muted-foreground">{h.sector}</div>
                  </div>
                  {getReturnBadge(h)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Comparison */}
        <div className="lg:col-span-3 space-y-4">
          {activeHolding ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{activeHolding.symbol} vs {peers.length > 0 ? `${peers.length} Sector Peers` : 'No Peers Found'}</CardTitle>
                  <CardDescription>{activeHolding.name} · {activeHolding.sector}</CardDescription>
                </CardHeader>
              </Card>

              {peers.length > 0 && (
                <>
                  {/* Radar comparison */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Snowflake Comparison</CardTitle>
                      <CardDescription>{activeHolding.symbol} vs peer average</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Radar name={activeHolding.symbol} dataKey="stock" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                            <Radar name="Peer Avg" dataKey="peers" stroke="hsl(38, 92%, 50%)" fill="hsl(38, 92%, 50%)" fillOpacity={0.15} strokeWidth={2} strokeDasharray="4 4" />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 mt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-0.5 bg-primary rounded" />
                          <span>{activeHolding.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'hsl(38, 92%, 50%)' }} />
                          <span>Peer Average</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bar comparison */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" />Metric Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="Value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Health" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Future" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Peer table */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Detailed Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium text-muted-foreground">Stock</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Price</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Return</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Yield</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Safety</th>
                              <th className="text-right py-2 px-2 font-medium text-muted-foreground">Snowflake</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[activeHolding, ...peers].map((h, i) => {
                              const ret = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;
                              return (
                                <tr key={h.symbol} className={`border-b border-muted hover:bg-muted/30 ${i === 0 ? 'bg-primary/5' : ''}`}>
                                  <td className="py-2 px-2">
                                    <div className="font-medium">{h.symbol} {i === 0 && <Badge variant="outline" className="text-xs ml-1">Selected</Badge>}</div>
                                    <div className="text-xs text-muted-foreground">{h.name}</div>
                                  </td>
                                  <td className="text-right py-2 px-2">${h.currentPrice.toFixed(2)}</td>
                                  <td className={`text-right py-2 px-2 font-medium ${ret >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                                  </td>
                                  <td className="text-right py-2 px-2">{h.dividendYield.toFixed(2)}%</td>
                                  <td className="text-right py-2 px-2">{h.safetyScore}/100</td>
                                  <td className="text-right py-2 px-2 font-bold">{h.snowflake.total}/25</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {peers.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No peers found in the same sector ({activeHolding.sector}). Add more holdings in this sector to enable comparison.
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Add holdings to compare them against peers
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeerComparison;
