import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDripTransactions, DripTransaction } from '@/hooks/useDripTransactions';
import { RefreshCw, Plus, Trash2, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from 'recharts';

export const DripTracker: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { transactions, loading, addTransaction, deleteTransaction, stats } = useDripTransactions(activePortfolio?.id);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    symbol: '',
    dividendAmount: '',
    sharesPurchased: '',
    purchasePrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
  });

  const holdings = useMemo(() => {
    return activePortfolio?.holdings?.filter(h => (h.dividendYield || 0) > 0) || [];
  }, [activePortfolio]);

  // Calculate monthly DRIP data for chart
  const monthlyData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(now, 11),
      end: now,
    });
    
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTransactions = transactions.filter(t => {
        const date = parseISO(t.purchase_date);
        return date >= monthStart && date <= monthEnd;
      });
      
      const dividendsReinvested = monthTransactions.reduce((sum, t) => sum + Number(t.dividend_amount), 0);
      const sharesPurchased = monthTransactions.reduce((sum, t) => sum + Number(t.shares_purchased), 0);
      
      return {
        month: format(month, 'MMM yyyy'),
        dividendsReinvested,
        sharesPurchased,
        transactionCount: monthTransactions.length,
      };
    });
  }, [transactions]);

  // Calculate compound growth over time
  const growthData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    );
    
    let cumulativeDividends = 0;
    let cumulativeShares = 0;
    
    return sorted.map(t => {
      cumulativeDividends += Number(t.dividend_amount);
      cumulativeShares += Number(t.shares_purchased);
      
      return {
        date: format(parseISO(t.purchase_date), 'MMM dd, yy'),
        cumulativeDividends,
        cumulativeShares,
        symbol: t.symbol,
      };
    });
  }, [transactions]);

  // Group by symbol
  const bySymbol = useMemo(() => {
    const grouped: Record<string, { dividends: number; shares: number; count: number }> = {};
    
    transactions.forEach(t => {
      if (!grouped[t.symbol]) {
        grouped[t.symbol] = { dividends: 0, shares: 0, count: 0 };
      }
      grouped[t.symbol].dividends += Number(t.dividend_amount);
      grouped[t.symbol].shares += Number(t.shares_purchased);
      grouped[t.symbol].count++;
    });
    
    return Object.entries(grouped)
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.dividends - a.dividends);
  }, [transactions]);

  const handleAddTransaction = async () => {
    if (!activePortfolio?.id || !newTransaction.symbol) return;
    
    const holding = holdings.find(h => h.symbol === newTransaction.symbol);
    
    await addTransaction(
      activePortfolio.id,
      newTransaction.symbol,
      Number(newTransaction.dividendAmount),
      Number(newTransaction.sharesPurchased),
      Number(newTransaction.purchasePrice),
      new Date(newTransaction.purchaseDate),
      holding?.id
    );
    
    setNewTransaction({
      symbol: '',
      dividendAmount: '',
      sharesPurchased: '',
      purchasePrice: '',
      purchaseDate: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            DRIP Tracker
          </h2>
          <p className="text-sm text-muted-foreground">
            Track your dividend reinvestments and compound growth
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Log DRIP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Dividend Reinvestment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Select value={newTransaction.symbol} onValueChange={(v) => setNewTransaction(p => ({ ...p, symbol: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dividend stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {holdings.map(h => (
                      <SelectItem key={h.id} value={h.symbol}>
                        {h.symbol} - {h.name} ({h.dividendYield?.toFixed(2)}% yield)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dividend Amount ($)</Label>
                  <Input
                    type="number"
                    value={newTransaction.dividendAmount}
                    onChange={(e) => setNewTransaction(p => ({ ...p, dividendAmount: e.target.value }))}
                    placeholder="25.50"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shares Purchased</Label>
                  <Input
                    type="number"
                    value={newTransaction.sharesPurchased}
                    onChange={(e) => setNewTransaction(p => ({ ...p, sharesPurchased: e.target.value }))}
                    placeholder="0.15"
                    step="0.0001"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Purchase Price ($)</Label>
                  <Input
                    type="number"
                    value={newTransaction.purchasePrice}
                    onChange={(e) => setNewTransaction(p => ({ ...p, purchasePrice: e.target.value }))}
                    placeholder="170.00"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newTransaction.purchaseDate}
                    onChange={(e) => setNewTransaction(p => ({ ...p, purchaseDate: e.target.value }))}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleAddTransaction} 
                className="w-full" 
                disabled={!newTransaction.symbol || !newTransaction.dividendAmount}
              >
                Log Transaction
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Reinvested</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${stats.totalDividendsReinvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Shares Purchased</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalSharesPurchased.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Avg Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.averagePurchasePrice.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cumulative Growth Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Compound Growth
              </CardTitle>
              <CardDescription>Cumulative dividends reinvested over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="colorDividends" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulativeDividends" 
                      stroke="#6366f1"
                      fill="url(#colorDividends)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Monthly Reinvestments
              </CardTitle>
              <CardDescription>DRIP activity by month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'dividendsReinvested' ? `$${value.toFixed(2)}` : value.toFixed(4),
                        name === 'dividendsReinvested' ? 'Dividends' : 'Shares'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="dividendsReinvested" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* By Symbol Breakdown */}
      {bySymbol.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              DRIP by Symbol
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bySymbol.map(item => (
                <div 
                  key={item.symbol}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.symbol}</Badge>
                    <span className="text-muted-foreground">{item.count} transactions</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">
                      ${item.dividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.shares.toFixed(4)} shares
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your dividend reinvestment history</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No DRIP transactions recorded</p>
              <p className="text-sm mt-1">Log your first dividend reinvestment to start tracking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Symbol</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Dividend</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Shares</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Price</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((t) => (
                    <tr key={t.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-2 px-3 text-foreground">
                        {format(parseISO(t.purchase_date), 'MMM dd, yyyy')}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{t.symbol}</Badge>
                      </td>
                      <td className="py-2 px-3 text-right text-primary">
                        +${Number(t.dividend_amount).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-foreground">
                        {Number(t.shares_purchased).toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">
                        ${Number(t.purchase_price).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTransaction(t.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DripTracker;
