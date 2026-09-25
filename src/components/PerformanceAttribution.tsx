import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { cleanSymbol } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Treemap
} from 'recharts';

interface Attribution {
  name: string;
  value: number;
  weight: number;
  return: number;
  contribution: number;
  color: string;
}

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#6366f1',
  'Healthcare': '#10b981',
  'Financial Services': '#f59e0b',
  'Consumer Cyclical': '#ec4899',
  'Communication Services': '#8b5cf6',
  'Industrials': '#64748b',
  'Consumer Defensive': '#06b6d4',
  'Energy': '#ef4444',
  'Utilities': '#22c55e',
  'Real Estate': '#f97316',
  'Basic Materials': '#84cc16',
  'Other': '#94a3b8'
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  'Stock': '#6366f1',
  'ETF': '#10b981',
  'Crypto': '#f59e0b',
  'Bond': '#8b5cf6',
  'REIT': '#ec4899',
  'Other': '#94a3b8'
};

export const PerformanceAttribution = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  
  const symbols = useMemo(() => holdings.map(h => cleanSymbol(h.symbol)), [holdings]);
  const { prices } = useStockPrices(symbols);

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    prices.forEach(p => {
      map[p.symbol] = p.price;
    });
    return map;
  }, [prices]);

  // Calculate individual holding returns
  const holdingReturns = useMemo(() => {
    return holdings.map(h => {
      const symbol = cleanSymbol(h.symbol);
      const currentPrice = priceMap[symbol] || h.currentPrice || h.avgPrice;
      const value = h.shares * currentPrice;
      const costBasis = h.shares * h.avgPrice;
      const gainLoss = value - costBasis;
      const returnPct = costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0;
      
      return {
        symbol,
        name: h.name,
        sector: h.sector || 'Other',
        assetType: h.assetType || 'Stock',
        shares: h.shares,
        avgPrice: h.avgPrice,
        currentPrice,
        value,
        costBasis,
        gainLoss,
        returnPct
      };
    }).sort((a, b) => b.value - a.value);
  }, [holdings, priceMap]);

  // Portfolio totals
  const portfolioTotals = useMemo(() => {
    const totalValue = holdingReturns.reduce((sum, h) => sum + h.value, 0);
    const totalCostBasis = holdingReturns.reduce((sum, h) => sum + h.costBasis, 0);
    const totalGainLoss = totalValue - totalCostBasis;
    const portfolioReturn = totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0;
    
    return { totalValue, totalCostBasis, totalGainLoss, portfolioReturn };
  }, [holdingReturns]);

  // Attribution by sector
  const sectorAttribution = useMemo((): Attribution[] => {
    const bySector: Record<string, { value: number; costBasis: number; gainLoss: number }> = {};
    
    holdingReturns.forEach(h => {
      const sector = h.sector || 'Other';
      if (!bySector[sector]) bySector[sector] = { value: 0, costBasis: 0, gainLoss: 0 };
      bySector[sector].value += h.value;
      bySector[sector].costBasis += h.costBasis;
      bySector[sector].gainLoss += h.gainLoss;
    });

    return Object.entries(bySector)
      .map(([name, data]) => {
        const weight = portfolioTotals.totalValue > 0 ? (data.value / portfolioTotals.totalValue) * 100 : 0;
        const sectorReturn = data.costBasis > 0 ? ((data.value - data.costBasis) / data.costBasis) * 100 : 0;
        const contribution = portfolioTotals.totalCostBasis > 0 
          ? (data.gainLoss / portfolioTotals.totalCostBasis) * 100 
          : 0;
        
        return {
          name,
          value: data.value,
          weight,
          return: sectorReturn,
          contribution,
          color: SECTOR_COLORS[name] || '#94a3b8'
        };
      })
      .sort((a, b) => b.contribution - a.contribution);
  }, [holdingReturns, portfolioTotals]);

  // Attribution by asset type
  const assetTypeAttribution = useMemo((): Attribution[] => {
    const byType: Record<string, { value: number; costBasis: number; gainLoss: number }> = {};
    
    holdingReturns.forEach(h => {
      const type = h.assetType || 'Other';
      if (!byType[type]) byType[type] = { value: 0, costBasis: 0, gainLoss: 0 };
      byType[type].value += h.value;
      byType[type].costBasis += h.costBasis;
      byType[type].gainLoss += h.gainLoss;
    });

    return Object.entries(byType)
      .map(([name, data]) => {
        const weight = portfolioTotals.totalValue > 0 ? (data.value / portfolioTotals.totalValue) * 100 : 0;
        const typeReturn = data.costBasis > 0 ? ((data.value - data.costBasis) / data.costBasis) * 100 : 0;
        const contribution = portfolioTotals.totalCostBasis > 0 
          ? (data.gainLoss / portfolioTotals.totalCostBasis) * 100 
          : 0;
        
        return {
          name,
          value: data.value,
          weight,
          return: typeReturn,
          contribution,
          color: ASSET_TYPE_COLORS[name] || '#94a3b8'
        };
      })
      .sort((a, b) => b.contribution - a.contribution);
  }, [holdingReturns, portfolioTotals]);

  // Top contributors and detractors
  const topContributors = useMemo(() => {
    return holdingReturns
      .map(h => ({
        ...h,
        contribution: portfolioTotals.totalCostBasis > 0 
          ? (h.gainLoss / portfolioTotals.totalCostBasis) * 100 
          : 0
      }))
      .sort((a, b) => b.contribution - a.contribution);
  }, [holdingReturns, portfolioTotals]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">Weight: {data.weight.toFixed(1)}%</p>
          <p className={`text-sm ${data.return >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            Return: {data.return >= 0 ? '+' : ''}{data.return.toFixed(2)}%
          </p>
          <p className={`text-sm font-medium ${data.contribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            Contribution: {data.contribution >= 0 ? '+' : ''}{data.contribution.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <PieChart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings</h3>
          <p className="text-muted-foreground">Add holdings to see performance attribution analysis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs mb-1">Portfolio Value</div>
            <p className="text-2xl font-bold">${portfolioTotals.totalValue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs mb-1">Cost Basis</div>
            <p className="text-2xl font-bold">${portfolioTotals.totalCostBasis.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={portfolioTotals.totalGainLoss >= 0 
          ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
          : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20"
        }>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs mb-1">Total Gain/Loss</div>
            <p className={`text-2xl font-bold ${portfolioTotals.totalGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioTotals.totalGainLoss >= 0 ? '+' : ''}${portfolioTotals.totalGainLoss.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className={portfolioTotals.portfolioReturn >= 0 
          ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
          : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20"
        }>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs mb-1">Portfolio Return</div>
            <p className={`text-2xl font-bold ${portfolioTotals.portfolioReturn >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {portfolioTotals.portfolioReturn >= 0 ? '+' : ''}{portfolioTotals.portfolioReturn.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sector">
        <TabsList>
          <TabsTrigger value="sector">By Sector</TabsTrigger>
          <TabsTrigger value="asset">By Asset Type</TabsTrigger>
          <TabsTrigger value="holdings">By Holding</TabsTrigger>
        </TabsList>

        <TabsContent value="sector" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sector Attribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Sector Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={sectorAttribution}
                        dataKey="weight"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {sectorAttribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Sector Contribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Sector Contribution to Return
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sectorAttribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} fontSize={10} />
                      <YAxis type="category" dataKey="name" width={100} fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="contribution" name="Contribution">
                        {sectorAttribution.map((entry, i) => (
                          <Cell key={i} fill={entry.contribution >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sector Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sector Attribution Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectorAttribution.map(attr => (
                    <TableRow key={attr.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: attr.color }} />
                          <span className="font-medium">{attr.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{attr.weight.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right ${attr.return >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {attr.return >= 0 ? '+' : ''}{attr.return.toFixed(2)}%
                      </TableCell>
                      <TableCell className={`text-right font-medium ${attr.contribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {attr.contribution >= 0 ? '+' : ''}{attr.contribution.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">${attr.value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asset" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Asset Type Allocation Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-primary" />
                  Asset Type Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={assetTypeAttribution}
                        dataKey="weight"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {assetTypeAttribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Asset Type Contribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Asset Type Contribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetTypeAttribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} fontSize={10} />
                      <YAxis type="category" dataKey="name" width={80} fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="contribution" name="Contribution">
                        {assetTypeAttribution.map((entry, i) => (
                          <Cell key={i} fill={entry.contribution >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Asset Type Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset Type Attribution Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Type</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetTypeAttribution.map(attr => (
                    <TableRow key={attr.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: attr.color }} />
                          <span className="font-medium">{attr.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{attr.weight.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right ${attr.return >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {attr.return >= 0 ? '+' : ''}{attr.return.toFixed(2)}%
                      </TableCell>
                      <TableCell className={`text-right font-medium ${attr.contribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {attr.contribution >= 0 ? '+' : ''}{attr.contribution.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">${attr.value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holdings" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Contributors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                  Top Contributors
                </CardTitle>
                <CardDescription>Holdings adding the most to returns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topContributors.filter(h => h.contribution > 0).slice(0, 5).map((h, i) => (
                    <div key={h.symbol} className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-emerald-500">#{i + 1}</span>
                        <div>
                          <p className="font-medium">{h.symbol}</p>
                          <p className="text-xs text-muted-foreground">{h.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-500 font-bold">+{h.contribution.toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">+${h.gainLoss.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {topContributors.filter(h => h.contribution > 0).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No positive contributors</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Detractors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5 text-red-500" />
                  Top Detractors
                </CardTitle>
                <CardDescription>Holdings dragging down returns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topContributors.filter(h => h.contribution < 0).slice(-5).reverse().map((h, i) => (
                    <div key={h.symbol} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-red-500">#{i + 1}</span>
                        <div>
                          <p className="font-medium">{h.symbol}</p>
                          <p className="text-xs text-muted-foreground">{h.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-red-500 font-bold">{h.contribution.toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">${h.gainLoss.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  {topContributors.filter(h => h.contribution < 0).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No negative detractors</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All Holdings Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Holdings Attribution</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead className="text-right">Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topContributors.map(h => {
                    const weight = portfolioTotals.totalValue > 0 ? (h.value / portfolioTotals.totalValue) * 100 : 0;
                    return (
                      <TableRow key={h.symbol}>
                        <TableCell className="font-bold">{h.symbol}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{h.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{h.sector}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{weight.toFixed(1)}%</TableCell>
                        <TableCell className={`text-right ${h.returnPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {h.returnPct >= 0 ? '+' : ''}{h.returnPct.toFixed(2)}%
                        </TableCell>
                        <TableCell className={`text-right font-medium ${h.contribution >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {h.contribution >= 0 ? '+' : ''}{h.contribution.toFixed(2)}%
                        </TableCell>
                        <TableCell className={`text-right ${h.gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {h.gainLoss >= 0 ? '+' : ''}${h.gainLoss.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceAttribution;
