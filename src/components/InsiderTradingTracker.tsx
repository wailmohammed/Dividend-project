import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useAuth } from '../context/AuthContext';
import { getDemoModeEnabled } from '../hooks/useDemoMode';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { UserCheck, UserMinus, TrendingUp, TrendingDown, DollarSign, Shield, AlertTriangle, FlaskConical, ArrowUpRight, ArrowDownRight, Building2, Briefcase, Calendar, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface InsiderTransaction {
  id: string;
  symbol: string;
  name: string;
  insiderName: string;
  title: string;
  transactionType: 'buy' | 'sell';
  shares: number;
  price: number;
  totalValue: number;
  date: string;
  remainingShares: number;
  significance: 'high' | 'medium' | 'low';
}

// Generate realistic demo insider data based on portfolio holdings
const generateDemoInsiderData = (holdings: any[]): InsiderTransaction[] => {
  const insiderNames: Record<string, { name: string; title: string }[]> = {
    'AAPL': [
      { name: 'Tim Cook', title: 'CEO' },
      { name: 'Luca Maestri', title: 'CFO' },
      { name: 'Jeff Williams', title: 'COO' },
    ],
    'MSFT': [
      { name: 'Satya Nadella', title: 'CEO' },
      { name: 'Amy Hood', title: 'CFO' },
      { name: 'Brad Smith', title: 'President' },
    ],
    'GOOGL': [
      { name: 'Sundar Pichai', title: 'CEO' },
      { name: 'Ruth Porat', title: 'CFO' },
    ],
    'AMZN': [
      { name: 'Andy Jassy', title: 'CEO' },
      { name: 'Brian Olsavsky', title: 'CFO' },
    ],
    'NVDA': [
      { name: 'Jensen Huang', title: 'CEO' },
      { name: 'Colette Kress', title: 'CFO' },
    ],
    'default': [
      { name: 'John Smith', title: 'CEO' },
      { name: 'Jane Doe', title: 'CFO' },
      { name: 'Robert Johnson', title: 'Director' },
    ],
  };

  const transactions: InsiderTransaction[] = [];
  const now = new Date();

  holdings.forEach((h) => {
    const insiders = insiderNames[h.symbol] || insiderNames['default'];
    const numTx = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numTx; i++) {
      const insider = insiders[Math.floor(Math.random() * insiders.length)];
      const isBuy = Math.random() > 0.45;
      const shares = Math.floor(Math.random() * 50000) + 1000;
      const price = h.currentPrice * (0.95 + Math.random() * 0.1);
      const daysAgo = Math.floor(Math.random() * 90);
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);

      transactions.push({
        id: `${h.symbol}-${i}-${insider.name}`,
        symbol: h.symbol,
        name: h.name,
        insiderName: insider.name,
        title: insider.title,
        transactionType: isBuy ? 'buy' : 'sell',
        shares,
        price: Math.round(price * 100) / 100,
        totalValue: Math.round(shares * price),
        date: date.toISOString().split('T')[0],
        remainingShares: Math.floor(Math.random() * 500000) + 10000,
        significance: shares * price > 1000000 ? 'high' : shares * price > 100000 ? 'medium' : 'low',
      });
    }
  });

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const InsiderTradingTracker: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio } = usePortfolio();
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [filterSignificance, setFilterSignificance] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const insiderData = useMemo(() => {
    return generateDemoInsiderData(activePortfolio.holdings || []);
  }, [activePortfolio.holdings]);

  const filteredData = useMemo(() => {
    return insiderData.filter(t => {
      if (filterType !== 'all' && t.transactionType !== filterType) return false;
      if (filterSignificance !== 'all' && t.significance !== filterSignificance) return false;
      return true;
    });
  }, [insiderData, filterType, filterSignificance]);

  const summary = useMemo(() => {
    const totalBuys = insiderData.filter(t => t.transactionType === 'buy');
    const totalSells = insiderData.filter(t => t.transactionType === 'sell');
    const buyValue = totalBuys.reduce((sum, t) => sum + t.totalValue, 0);
    const sellValue = totalSells.reduce((sum, t) => sum + t.totalValue, 0);
    const netValue = buyValue - sellValue;
    const highSignificance = insiderData.filter(t => t.significance === 'high');

    // Cluster buying: symbols where buys outnumber sells
    const symbolActivity: Record<string, { buys: number; sells: number }> = {};
    insiderData.forEach(t => {
      if (!symbolActivity[t.symbol]) symbolActivity[t.symbol] = { buys: 0, sells: 0 };
      if (t.transactionType === 'buy') symbolActivity[t.symbol].buys++;
      else symbolActivity[t.symbol].sells++;
    });
    const clusterBuying = Object.entries(symbolActivity)
      .filter(([, v]) => v.buys > v.sells)
      .map(([symbol]) => symbol);

    return { totalBuys: totalBuys.length, totalSells: totalSells.length, buyValue, sellValue, netValue, highSignificance: highSignificance.length, clusterBuying };
  }, [insiderData]);

  const getSignificanceBadge = (sig: string) => {
    switch (sig) {
      case 'high': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">High Impact</Badge>;
      case 'medium': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">Medium</Badge>;
      default: return <Badge className="bg-muted text-muted-foreground text-[10px]">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Showing simulated insider transactions. Sign in for real data.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <UserCheck className="w-6 h-6 text-primary" />
          </div>
          Insider Trading Tracker
        </h1>
        <p className="text-muted-foreground">Monitor insider buying & selling across your portfolio holdings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground font-medium">Insider Buys</span>
            </div>
            <div className="text-2xl font-bold text-emerald-500">{summary.totalBuys}</div>
            <div className="text-xs text-muted-foreground mt-1">${(summary.buyValue / 1000000).toFixed(1)}M total</div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground font-medium">Insider Sells</span>
            </div>
            <div className="text-2xl font-bold text-red-500">{summary.totalSells}</div>
            <div className="text-xs text-muted-foreground mt-1">${(summary.sellValue / 1000000).toFixed(1)}M total</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Net Flow</span>
            </div>
            <div className={`text-2xl font-bold ${summary.netValue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {summary.netValue >= 0 ? '+' : '-'}${Math.abs(summary.netValue / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-muted-foreground mt-1">{summary.netValue >= 0 ? 'Bullish signal' : 'Bearish signal'}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground font-medium">High Impact</span>
            </div>
            <div className="text-2xl font-bold text-amber-500">{summary.highSignificance}</div>
            <div className="text-xs text-muted-foreground mt-1">Significant transactions</div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Buying Signal */}
      {summary.clusterBuying.length > 0 && (
        <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Cluster Buying Detected</div>
              <div className="text-xs text-muted-foreground">
                Multiple insiders buying in: {summary.clusterBuying.map(s => (
                  <Badge key={s} variant="outline" className="mx-0.5 text-emerald-500 border-emerald-500/30">{s}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="transactions" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="transactions">All Transactions</TabsTrigger>
            <TabsTrigger value="by-stock">By Stock</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buy">Buys Only</SelectItem>
                <SelectItem value="sell">Sells Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSignificance} onValueChange={(v) => setFilterSignificance(v as any)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impact</SelectItem>
                <SelectItem value="high">High Impact</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filteredData.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">No insider transactions found matching filters.</div>
                ) : (
                  filteredData.map(t => (
                    <div key={t.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg mt-0.5 ${t.transactionType === 'buy' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            {t.transactionType === 'buy' ? <UserCheck className="w-4 h-4 text-emerald-500" /> : <UserMinus className="w-4 h-4 text-red-500" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{t.insiderName}</span>
                              <Badge variant="outline" className="text-[10px]">{t.title}</Badge>
                              {getSignificanceBadge(t.significance)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              <span className={`font-medium ${t.transactionType === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                                {t.transactionType === 'buy' ? 'Bought' : 'Sold'}
                              </span>
                              {' '}{t.shares.toLocaleString()} shares of <span className="font-bold text-foreground">{t.symbol}</span> @ ${t.price.toFixed(2)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t.date}</span>
                              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{t.remainingShares.toLocaleString()} shares remaining</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${t.transactionType === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                            ${t.totalValue.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-stock">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(
              insiderData.reduce((acc, t) => {
                if (!acc[t.symbol]) acc[t.symbol] = { buys: [], sells: [] };
                if (t.transactionType === 'buy') acc[t.symbol].buys.push(t);
                else acc[t.symbol].sells.push(t);
                return acc;
              }, {} as Record<string, { buys: InsiderTransaction[]; sells: InsiderTransaction[] }>)
            ).map(([symbol, data]) => {
              const buyVal = data.buys.reduce((s, t) => s + t.totalValue, 0);
              const sellVal = data.sells.reduce((s, t) => s + t.totalValue, 0);
              const net = buyVal - sellVal;
              return (
                <Card key={symbol} className={`${net > 0 ? 'border-emerald-500/20' : net < 0 ? 'border-red-500/20' : ''}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-base">{symbol}</span>
                      </div>
                      <Badge className={`${net > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} text-xs`}>
                        {net > 0 ? 'Net Buying' : 'Net Selling'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Buys ({data.buys.length})</span>
                      <span className="text-emerald-500 font-medium">${(buyVal / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sells ({data.sells.length})</span>
                      <span className="text-red-500 font-medium">${(sellVal / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                      <span>Net Flow</span>
                      <span className={net >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {net >= 0 ? '+' : '-'}${Math.abs(net / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="signals">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-emerald-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-500">
                  <TrendingUp className="w-5 h-5" />
                  Bullish Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.clusterBuying.length > 0 && (
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <div className="text-sm font-medium text-foreground">Cluster Buying</div>
                    <div className="text-xs text-muted-foreground">Multiple insiders buying in {summary.clusterBuying.join(', ')}</div>
                  </div>
                )}
                {insiderData.filter(t => t.transactionType === 'buy' && t.significance === 'high').slice(0, 3).map(t => (
                  <div key={t.id} className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <div className="text-sm font-medium text-foreground">{t.insiderName} ({t.title}) bought {t.symbol}</div>
                    <div className="text-xs text-muted-foreground">${t.totalValue.toLocaleString()} - {t.date}</div>
                  </div>
                ))}
                {summary.clusterBuying.length === 0 && insiderData.filter(t => t.transactionType === 'buy' && t.significance === 'high').length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No strong bullish signals detected</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <TrendingDown className="w-5 h-5" />
                  Bearish Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insiderData.filter(t => t.transactionType === 'sell' && t.significance === 'high').slice(0, 5).map(t => (
                  <div key={t.id} className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <div className="text-sm font-medium text-foreground">{t.insiderName} ({t.title}) sold {t.symbol}</div>
                    <div className="text-xs text-muted-foreground">${t.totalValue.toLocaleString()} - {t.date}</div>
                  </div>
                ))}
                {insiderData.filter(t => t.transactionType === 'sell' && t.significance === 'high').length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No strong bearish signals detected</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InsiderTradingTracker;
