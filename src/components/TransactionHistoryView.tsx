import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, DollarSign, Search, Filter, Calendar, RefreshCw, Download, FileText, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { RealizedPLDashboard } from './RealizedPLDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { DEMO_TRANSACTIONS } from '@/constants/demoTransactions';
interface TransactionWithPL {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL';
  shares: number | null;
  price: number;
  total_value: number;
  fees: number;
  transaction_date: string;
  notes: string | null;
  // Calculated P/L for sells
  profitLoss?: number;
  profitLossPercent?: number;
  avgCostBasis?: number;
}

export const TransactionHistoryView = () => {
  const { activePortfolio, portfolios, switchPortfolio, activePortfolioId, refetchPortfolio } = usePortfolio();
  const { user } = useAuth();
  const { toast } = useToast();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'symbol' | 'value' | 'pl'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'pl-dashboard'>('transactions');

  // Use demo transactions when in demo mode
  const transactions = isDemoMode ? DEMO_TRANSACTIONS : (activePortfolio?.transactions || []);
  const holdings = activePortfolio?.holdings || [];

  // Generate transactions from holdings if none exist
  const generateTransactionsFromHoldings = async () => {
    if (isDemoMode) {
      toast({ title: 'Demo mode', description: 'Sign in to generate transactions from your holdings.' });
      return;
    }
    if (!user || !activePortfolioId || holdings.length === 0) return;

    setGenerating(true);
    try {
      const newTransactions = holdings.map(holding => ({
        portfolio_id: activePortfolioId,
        symbol: holding.symbol,
        type: 'BUY',
        shares: holding.shares,
        price: holding.avgPrice,
        total_value: holding.shares * holding.avgPrice,
        fees: 0,
        transaction_date: new Date().toISOString(),
        notes: 'Auto-generated from holdings'
      }));

      const { error } = await supabase
        .from('transactions')
        .insert(newTransactions);

      if (error) throw error;

      toast({ title: `Generated ${newTransactions.length} transactions from holdings` });
      await refetchPortfolio();
    } catch (error) {
      console.error('Error generating transactions:', error);
      toast({ title: 'Failed to generate transactions', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Calculate P/L for each transaction
  const transactionsWithPL = useMemo(() => {
    // Build cost basis map per symbol
    const costBasisMap: Record<string, { totalShares: number; totalCost: number }> = {};
    
    // Sort transactions by date ascending to build cost basis
    const sortedTxns = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const result: TransactionWithPL[] = [];

    sortedTxns.forEach(txn => {
      const symbol = cleanSymbol(txn.symbol);
      const shares = txn.shares || 0;
      const price = txn.price || 0;
      const type = txn.type as 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL';

      if (!costBasisMap[symbol]) {
        costBasisMap[symbol] = { totalShares: 0, totalCost: 0 };
      }

      let profitLoss: number | undefined;
      let profitLossPercent: number | undefined;
      let avgCostBasis: number | undefined;

      if (type === 'BUY') {
        costBasisMap[symbol].totalShares += shares;
        costBasisMap[symbol].totalCost += shares * price;
        avgCostBasis = costBasisMap[symbol].totalCost / costBasisMap[symbol].totalShares;
      } else if (type === 'SELL') {
        const basis = costBasisMap[symbol];
        if (basis.totalShares > 0) {
          avgCostBasis = basis.totalCost / basis.totalShares;
          const costOfSoldShares = avgCostBasis * shares;
          const saleProceeds = shares * price;
          profitLoss = saleProceeds - costOfSoldShares;
          profitLossPercent = costOfSoldShares > 0 ? ((saleProceeds - costOfSoldShares) / costOfSoldShares) * 100 : 0;
          
          // Update basis (reduce proportionally)
          const remainingRatio = Math.max(0, (basis.totalShares - shares) / basis.totalShares);
          basis.totalShares = Math.max(0, basis.totalShares - shares);
          basis.totalCost = basis.totalCost * remainingRatio;
        }
      }

      const totalValue = (txn as any).totalValue || (txn as any).total_value || (shares * price);

      result.push({
        id: txn.id,
        symbol: txn.symbol,
        type,
        shares: txn.shares,
        price: txn.price,
        total_value: totalValue,
        fees: (txn as any).fees || 0,
        transaction_date: txn.date,
        notes: (txn as any).notes || null,
        profitLoss,
        profitLossPercent,
        avgCostBasis
      });
    });

    // Reverse to show newest first by default
    return result.reverse();
  }, [transactions]);

  // Filter and sort
  const filteredTransactions = useMemo(() => {
    let filtered = transactionsWithPL;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(t => 
        cleanSymbol(t.symbol).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'date':
          aVal = new Date(a.transaction_date).getTime();
          bVal = new Date(b.transaction_date).getTime();
          break;
        case 'symbol':
          aVal = cleanSymbol(a.symbol);
          bVal = cleanSymbol(b.symbol);
          break;
        case 'value':
          aVal = a.total_value;
          bVal = b.total_value;
          break;
        case 'pl':
          aVal = a.profitLoss || 0;
          bVal = b.profitLoss || 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [transactionsWithPL, searchQuery, typeFilter, sortBy, sortOrder]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const buys = transactionsWithPL.filter(t => t.type === 'BUY');
    const sells = transactionsWithPL.filter(t => t.type === 'SELL');
    const dividends = transactionsWithPL.filter(t => t.type === 'DIVIDEND');

    const totalBought = buys.reduce((sum, t) => sum + (t.total_value || 0), 0);
    const totalSold = sells.reduce((sum, t) => sum + (t.total_value || 0), 0);
    const totalDividends = dividends.reduce((sum, t) => sum + (t.total_value || 0), 0);
    const realizedPL = sells.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const totalFees = transactionsWithPL.reduce((sum, t) => sum + (t.fees || 0), 0);

    // Calculate unrealized P/L from holdings
    const unrealizedPL = holdings.reduce((sum, h) => {
      const currentValue = (h.shares || 0) * (h.currentPrice || 0);
      const costBasis = (h.shares || 0) * (h.avgPrice || 0);
      return sum + (currentValue - costBasis);
    }, 0);

    return {
      totalBought,
      totalSold,
      totalDividends,
      realizedPL,
      unrealizedPL,
      totalFees,
      buyCount: buys.length,
      sellCount: sells.length
    };
  }, [transactionsWithPL, holdings]);

  // Export SELL transactions for tax reporting
  const exportSellTransactions = () => {
    const sells = transactionsWithPL.filter(t => t.type === 'SELL');
    if (sells.length === 0) {
      toast({ title: 'No sell transactions to export', variant: 'destructive' });
      return;
    }

    const headers = ['Date', 'Symbol', 'Shares', 'Sale Price', 'Total Proceeds', 'Cost Basis', 'Realized P/L', 'P/L %', 'Notes'];
    const rows = sells.map(t => [
      format(new Date(t.transaction_date), 'yyyy-MM-dd'),
      cleanSymbol(t.symbol),
      t.shares?.toFixed(4) || '0',
      t.price.toFixed(2),
      t.total_value.toFixed(2),
      ((t.avgCostBasis || 0) * (t.shares || 0)).toFixed(2),
      (t.profitLoss || 0).toFixed(2),
      (t.profitLossPercent || 0).toFixed(2) + '%',
      (t.notes || '').replace(/,/g, ';')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sell-transactions-${activePortfolio?.name || 'portfolio'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: `Exported ${sells.length} sell transactions` });
  };

  // Export all transactions
  const exportAllTransactions = () => {
    if (transactionsWithPL.length === 0) {
      toast({ title: 'No transactions to export', variant: 'destructive' });
      return;
    }

    const headers = ['Date', 'Type', 'Symbol', 'Shares', 'Price', 'Total Value', 'Fees', 'Cost Basis', 'Realized P/L', 'P/L %', 'Notes'];
    const rows = transactionsWithPL.map(t => [
      format(new Date(t.transaction_date), 'yyyy-MM-dd'),
      t.type,
      cleanSymbol(t.symbol),
      t.shares?.toFixed(4) || '0',
      t.price.toFixed(2),
      t.total_value.toFixed(2),
      t.fees.toFixed(2),
      t.type === 'SELL' ? ((t.avgCostBasis || 0) * (t.shares || 0)).toFixed(2) : '',
      t.type === 'SELL' ? (t.profitLoss || 0).toFixed(2) : '',
      t.type === 'SELL' ? (t.profitLossPercent || 0).toFixed(2) + '%' : '',
      (t.notes || '').replace(/,/g, ';')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-transactions-${activePortfolio?.name || 'portfolio'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: `Exported ${transactionsWithPL.length} transactions` });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BUY':
        return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
      case 'SELL':
        return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      case 'DIVIDEND':
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      BUY: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      SELL: 'bg-red-500/10 text-red-500 border-red-500/20',
      DIVIDEND: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      DEPOSIT: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      WITHDRAWAL: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    };
    return <Badge className={variants[type] || ''}>{type}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample transaction history. Sign in to track your real trades.
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Transaction History</h1>
          <p className="text-muted-foreground">Track buy/sell trades with profit/loss calculation</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={activePortfolioId} onValueChange={switchPortfolio}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportSellTransactions} className="gap-2">
            <FileText className="w-4 h-4" />
            Export SELL P/L
          </Button>
          <Button variant="outline" size="sm" onClick={exportAllTransactions} className="gap-2">
            <Download className="w-4 h-4" />
            Export All
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="pl-dashboard">Realized P/L Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="pl-dashboard" className="mt-6">
          <RealizedPLDashboard />
        </TabsContent>

        <TabsContent value="transactions" className="mt-6 space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              Total Bought
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${stats.totalBought.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">{stats.buyCount} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              Total Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">${stats.totalSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">{stats.sellCount} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {stats.realizedPL >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              Realized P/L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${stats.realizedPL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.realizedPL >= 0 ? '+' : ''}${stats.realizedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">From closed positions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {stats.unrealizedPL >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              Unrealized P/L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${stats.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.unrealizedPL >= 0 ? '+' : ''}${stats.unrealizedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">Open positions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              Dividends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-500">${stats.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">Total received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-muted-foreground">${stats.totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Trading fees paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by symbol..."
            className="pl-10"
          />
        </div>
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="BUY">Buy</SelectItem>
            <SelectItem value="SELL">Sell</SelectItem>
            <SelectItem value="DIVIDEND">Dividend</SelectItem>
            <SelectItem value="DEPOSIT">Deposit</SelectItem>
            <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="symbol">Sort by Symbol</SelectItem>
            <SelectItem value="value">Sort by Value</SelectItem>
            <SelectItem value="pl">Sort by P/L</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Add transactions to see them here'}
              </p>
              {holdings.length > 0 && transactions.length === 0 && (
                <Button 
                  onClick={generateTransactionsFromHoldings}
                  disabled={generating}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Generating...' : 'Generate Transactions from Holdings'}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cost Basis</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="max-w-[150px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => {
                  const isAutoSold = txn.notes?.includes('Auto-detected sold position');
                  return (
                    <TableRow key={txn.id} className={isAutoSold ? 'bg-amber-500/5' : ''}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(txn.transaction_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getTypeBadge(txn.type)}
                          {isAutoSold && (
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                              Auto
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">{cleanSymbol(txn.symbol)}</TableCell>
                      <TableCell className="text-right">
                        {txn.shares != null ? txn.shares.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">${txn.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${txn.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {txn.avgCostBasis != null ? `$${txn.avgCostBasis.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.profitLoss != null ? (
                          <div className={`flex flex-col items-end ${txn.profitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            <span className="font-medium">
                              {txn.profitLoss >= 0 ? '+' : ''}${txn.profitLoss.toFixed(2)}
                            </span>
                            <span className="text-xs">
                              ({txn.profitLossPercent! >= 0 ? '+' : ''}{txn.profitLossPercent!.toFixed(1)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] text-xs text-muted-foreground truncate" title={txn.notes || ''}>
                        {txn.notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
