import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cleanSymbol } from '@/lib/utils';
import { 
  Scale, ShoppingCart, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle2, Loader2, ArrowRight,
  DollarSign, Percent, Play
} from 'lucide-react';

interface TradeOrder {
  symbol: string;
  name: string;
  action: 'BUY' | 'SELL';
  shares: number;
  estimatedValue: number;
  currentPrice: number;
  currentPercent: number;
  targetPercent: number;
  selected: boolean;
}

export const OneClickRebalancing: React.FC = () => {
  const { activePortfolio, refetchPortfolio, activePortfolioId } = usePortfolio();
  const { user } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [orders, setOrders] = useState<TradeOrder[]>([]);

  // Calculate total portfolio value
  const totalValue = useMemo(() => {
    return (activePortfolio?.holdings || []).reduce((sum, h) => {
      return sum + (h.shares * (h.currentPrice || h.avgPrice || 0));
    }, 0) + (activePortfolio?.cashBalance || 0);
  }, [activePortfolio]);

  // Generate rebalancing orders
  const rebalanceOrders = useMemo((): TradeOrder[] => {
    const holdings = activePortfolio?.holdings || [];
    if (holdings.length === 0) return [];

    const equalWeight = 100 / holdings.length;
    
    return holdings.map(h => {
      const currentPrice = h.currentPrice || h.avgPrice || 0;
      const currentValue = h.shares * currentPrice;
      const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const targetPercent = h.targetAllocation ?? equalWeight;
      
      const targetValue = (targetPercent / 100) * totalValue;
      const difference = targetValue - currentValue;
      
      // Calculate shares to buy/sell
      const sharesToTrade = currentPrice > 0 ? Math.abs(difference) / currentPrice : 0;
      
      // Only include if difference is significant (> 2%)
      const action: 'BUY' | 'SELL' = difference > 0 ? 'BUY' : 'SELL';
      const percentDiff = Math.abs(currentPercent - targetPercent);
      
      return {
        symbol: cleanSymbol(h.symbol),
        name: h.name,
        action,
        shares: Math.floor(sharesToTrade), // Round down to whole shares
        estimatedValue: Math.abs(difference),
        currentPrice,
        currentPercent,
        targetPercent,
        selected: percentDiff > 2, // Auto-select if > 2% off target
      };
    }).filter(o => o.shares > 0 && Math.abs(o.currentPercent - o.targetPercent) > 2);
  }, [activePortfolio?.holdings, totalValue]);

  // Initialize orders state
  React.useEffect(() => {
    setOrders(rebalanceOrders);
  }, [rebalanceOrders]);

  const toggleOrder = (symbol: string) => {
    setOrders(prev => prev.map(o => 
      o.symbol === symbol ? { ...o, selected: !o.selected } : o
    ));
  };

  const selectedOrders = orders.filter(o => o.selected);
  const buyOrders = selectedOrders.filter(o => o.action === 'BUY');
  const sellOrders = selectedOrders.filter(o => o.action === 'SELL');
  
  const totalBuyValue = buyOrders.reduce((sum, o) => sum + o.estimatedValue, 0);
  const totalSellValue = sellOrders.reduce((sum, o) => sum + o.estimatedValue, 0);
  const cashAvailable = (activePortfolio?.cashBalance || 0) + totalSellValue;
  const cashNeeded = totalBuyValue;
  const hasEnoughCash = cashAvailable >= cashNeeded;

  // Execute trades (create transaction records)
  const executeRebalancing = async () => {
    if (!user?.id || !activePortfolioId) {
      toast.error('Please log in to execute trades');
      return;
    }

    setExecuting(true);
    
    try {
      const transactions = selectedOrders.map(order => ({
        portfolio_id: activePortfolioId,
        symbol: order.symbol,
        type: order.action.toLowerCase(),
        shares: order.shares,
        price: order.currentPrice,
        total_value: order.estimatedValue,
        transaction_date: new Date().toISOString(),
        notes: `Rebalancing: ${order.action} to reach ${order.targetPercent.toFixed(1)}% target allocation`,
      }));

      // Insert all transactions
      const { error } = await supabase
        .from('transactions')
        .insert(transactions);

      if (error) throw error;

      // Update holdings based on trades
      for (const order of selectedOrders) {
        const holding = activePortfolio?.holdings.find(h => cleanSymbol(h.symbol) === order.symbol);
        if (!holding) continue;

        const newShares = order.action === 'BUY' 
          ? holding.shares + order.shares 
          : holding.shares - order.shares;

        if (newShares <= 0) {
          // Delete holding if selling all shares
          await supabase.from('holdings').delete().eq('id', holding.id);
        } else {
          // Update shares
          await supabase
            .from('holdings')
            .update({ shares: newShares, updated_at: new Date().toISOString() })
            .eq('id', holding.id);
        }
      }

      // Update cash balance
      const newCashBalance = (activePortfolio?.cashBalance || 0) + totalSellValue - totalBuyValue;
      await supabase
        .from('portfolios')
        .update({ cash_balance: newCashBalance })
        .eq('id', activePortfolioId);

      toast.success(`Successfully executed ${selectedOrders.length} rebalancing trades`);
      setShowConfirmDialog(false);
      setOrders([]);
      await refetchPortfolio();
    } catch (err: any) {
      console.error('Rebalancing error:', err);
      toast.error('Failed to execute rebalancing trades');
    } finally {
      setExecuting(false);
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
          <h3 className="text-lg font-semibold mb-2">Portfolio is Balanced</h3>
          <p className="text-muted-foreground">
            All holdings are within 2% of their target allocations. No rebalancing needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                One-Click Rebalancing
              </CardTitle>
              <CardDescription>
                Generate and execute trades to match target allocations
              </CardDescription>
            </div>
            <Button 
              onClick={() => setShowConfirmDialog(true)}
              disabled={selectedOrders.length === 0}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Execute {selectedOrders.length} Trade{selectedOrders.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cash Flow Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Cash Available</div>
              <div className="font-bold text-lg">
                ${cashAvailable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Cash Needed</div>
              <div className={`font-bold text-lg ${!hasEnoughCash ? 'text-destructive' : ''}`}>
                ${cashNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Net Cash Flow</div>
              <div className={`font-bold text-lg ${totalSellValue - totalBuyValue >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {totalSellValue - totalBuyValue >= 0 ? '+' : ''}
                ${(totalSellValue - totalBuyValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Warning if not enough cash */}
          {!hasEnoughCash && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400">Insufficient Cash</p>
                <p className="text-amber-600 dark:text-amber-500">
                  You need ${(cashNeeded - cashAvailable).toLocaleString(undefined, { maximumFractionDigits: 0 })} more 
                  to execute all selected buy orders. Consider selling first or adding funds.
                </p>
              </div>
            </div>
          )}

          {/* Trade Orders */}
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.symbol}
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  order.selected ? 'bg-muted/50 border-primary/30' : 'opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={order.selected}
                    onCheckedChange={() => toggleOrder(order.symbol)}
                  />
                  <div className={`p-2 rounded-full ${
                    order.action === 'BUY' 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-red-500/10 text-red-500'
                  }`}>
                    {order.action === 'BUY' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{order.symbol}</span>
                      <Badge variant={order.action === 'BUY' ? 'default' : 'destructive'}>
                        {order.action}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{order.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Allocation</div>
                    <div className="flex items-center gap-1 text-sm">
                      <span>{order.currentPercent.toFixed(1)}%</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-semibold text-primary">{order.targetPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-xs text-muted-foreground">Trade</div>
                    <div className="font-semibold">
                      {order.shares} shares
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ~${order.estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Rebalancing Trades</DialogTitle>
            <DialogDescription>
              You're about to execute {selectedOrders.length} trades to rebalance your portfolio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-2">
                  <TrendingUp className="w-4 h-4" />
                  Buy Orders ({buyOrders.length})
                </div>
                <div className="space-y-1">
                  {buyOrders.map(o => (
                    <div key={o.symbol} className="flex justify-between text-sm">
                      <span>{o.symbol}</span>
                      <span>{o.shares} shares</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-500/20 font-bold">
                  Total: ${totalBuyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 font-semibold mb-2">
                  <TrendingDown className="w-4 h-4" />
                  Sell Orders ({sellOrders.length})
                </div>
                <div className="space-y-1">
                  {sellOrders.map(o => (
                    <div key={o.symbol} className="flex justify-between text-sm">
                      <span>{o.symbol}</span>
                      <span>{o.shares} shares</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-red-500/20 font-bold">
                  Total: ${totalSellValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-amber-700 dark:text-amber-400">
                These trades will be recorded as transactions in your portfolio. 
                This is a simulation - no actual broker trades will be executed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={executeRebalancing} disabled={executing || !hasEnoughCash}>
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm & Execute
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OneClickRebalancing;
