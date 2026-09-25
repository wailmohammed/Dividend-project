import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Slider } from './ui/slider';
import { usePortfolio } from '@/context/PortfolioContext';
import { 
  Scale, ArrowRight, TrendingUp, TrendingDown, 
  Settings2, RefreshCcw, CheckCircle, AlertTriangle,
  PieChart
} from 'lucide-react';

interface AllocationTarget {
  symbol: string;
  name: string;
  currentPercent: number;
  targetPercent: number;
  currentValue: number;
  targetValue: number;
  difference: number;
  action: 'BUY' | 'SELL' | 'HOLD';
}

export const RebalancingSuggestions = () => {
  const { activePortfolio } = usePortfolio();
  const [targetAllocations, setTargetAllocations] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);

  const totalValue = useMemo(() => {
    return activePortfolio.holdings.reduce((sum, h) => {
      return sum + (h.shares * h.currentPrice);
    }, 0) + activePortfolio.cashBalance;
  }, [activePortfolio]);

  const suggestions = useMemo((): AllocationTarget[] => {
    if (!activePortfolio.holdings || activePortfolio.holdings.length === 0) {
      return [];
    }

    return activePortfolio.holdings.map(holding => {
      const currentValue = holding.shares * holding.currentPrice;
      const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      
      // Use user-defined target or holding's target or default equal weight
      const targetPercent = targetAllocations[holding.symbol] ?? 
        holding.targetAllocation ?? 
        (100 / activePortfolio.holdings.length);
      
      const targetValue = (targetPercent / 100) * totalValue;
      const difference = targetValue - currentValue;
      
      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (Math.abs(difference) > currentValue * 0.05) { // 5% threshold
        action = difference > 0 ? 'BUY' : 'SELL';
      }

      return {
        symbol: holding.symbol,
        name: holding.name,
        currentPercent,
        targetPercent,
        currentValue,
        targetValue,
        difference,
        action
      };
    }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [activePortfolio.holdings, targetAllocations, totalValue]);

  const updateTarget = (symbol: string, value: number) => {
    setTargetAllocations(prev => ({
      ...prev,
      [symbol]: Math.min(100, Math.max(0, value))
    }));
  };

  const resetTargets = () => {
    const equalWeight = 100 / (activePortfolio.holdings.length || 1);
    const newTargets: Record<string, number> = {};
    activePortfolio.holdings.forEach(h => {
      newTargets[h.symbol] = equalWeight;
    });
    setTargetAllocations(newTargets);
  };

  const totalTargetPercent = useMemo(() => {
    return suggestions.reduce((sum, s) => sum + s.targetPercent, 0);
  }, [suggestions]);

  const isBalanced = useMemo(() => {
    return suggestions.every(s => s.action === 'HOLD');
  }, [suggestions]);

  if (activePortfolio.holdings.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings to Rebalance</h3>
          <p className="text-muted-foreground">
            Add holdings to your portfolio to get rebalancing suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Portfolio Rebalancing
            </CardTitle>
            <CardDescription>
              Adjust your holdings to match target allocations
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetTargets}>
              <RefreshCcw className="w-4 h-4 mr-1" />
              Equal Weight
            </Button>
            <Button 
              variant={isEditing ? "default" : "outline"} 
              size="sm" 
              onClick={() => setIsEditing(!isEditing)}
            >
              <Settings2 className="w-4 h-4 mr-1" />
              {isEditing ? 'Done' : 'Edit Targets'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          isBalanced 
            ? 'bg-emerald-500/10 border border-emerald-500/20' 
            : 'bg-amber-500/10 border border-amber-500/20'
        }`}>
          {isBalanced ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-400">Portfolio is Balanced</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">All holdings are within 5% of target allocations</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Rebalancing Recommended</p>
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  {suggestions.filter(s => s.action !== 'HOLD').length} holdings need adjustment
                </p>
              </div>
            </>
          )}
        </div>

        {/* Target Total Warning */}
        {Math.abs(totalTargetPercent - 100) > 0.1 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Target allocations total {totalTargetPercent.toFixed(1)}% (should be 100%)
          </div>
        )}

        {/* Allocation Table */}
        <div className="space-y-4">
          {suggestions.map((item) => (
            <div key={item.symbol} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-bold">{item.symbol}</span>
                    <span className="text-muted-foreground text-sm ml-2">{item.name}</span>
                  </div>
                  <Badge 
                    variant={item.action === 'HOLD' ? 'secondary' : item.action === 'BUY' ? 'default' : 'destructive'}
                  >
                    {item.action}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${item.currentValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                  {item.action !== 'HOLD' && (
                    <p className={`text-sm ${item.difference > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {item.difference > 0 ? '+' : ''}{item.difference.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current: {item.currentPercent.toFixed(1)}%</span>
                  <span className="text-muted-foreground">Target: {item.targetPercent.toFixed(1)}%</span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full bg-primary/50 transition-all"
                    style={{ width: `${Math.min(item.currentPercent, 100)}%` }}
                  />
                  <div 
                    className="absolute h-full w-0.5 bg-foreground"
                    style={{ left: `${Math.min(item.targetPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Edit Target */}
              {isEditing && (
                <div className="flex items-center gap-4 pt-2 border-t">
                  <span className="text-sm text-muted-foreground w-20">Target %</span>
                  <Slider
                    value={[item.targetPercent]}
                    onValueChange={([v]) => updateTarget(item.symbol, v)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={item.targetPercent.toFixed(0)}
                    onChange={(e) => updateTarget(item.symbol, parseFloat(e.target.value) || 0)}
                    className="w-16 text-center"
                    min={0}
                    max={100}
                  />
                </div>
              )}

              {/* Trade Suggestion */}
              {item.action !== 'HOLD' && (
                <div className={`flex items-center gap-2 p-2 rounded text-sm ${
                  item.action === 'BUY' 
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' 
                    : 'bg-red-500/10 text-red-700 dark:text-red-400'
                }`}>
                  {item.action === 'BUY' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>
                    {item.action === 'BUY' ? 'Buy' : 'Sell'} ~$
                    {Math.abs(item.difference).toLocaleString('en-US', { maximumFractionDigits: 0 })} 
                    {' '}worth ({Math.abs(item.difference / item.currentValue * item.currentPercent).toFixed(1)}% of portfolio)
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Total Portfolio</p>
            <p className="text-lg font-bold">${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="text-lg font-bold">{activePortfolio.holdings.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cash Available</p>
            <p className="text-lg font-bold">${activePortfolio.cashBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};