import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import {
  Scissors, TrendingDown, TrendingUp, AlertTriangle, DollarSign,
  Calendar, Info, CheckCircle2, ArrowRight, Target, Scale, Lightbulb,
  PieChart, Calculator
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { SellWithPL } from './SellTransactionsTable';

interface HarvestCandidate {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedLoss: number;
  unrealizedLossPercent: number;
  holdingPeriod: number;
  isLongTerm: boolean;
  potentialTaxSavings: number;
  washSaleRisk: boolean;
  recentPurchaseDate?: string;
}

interface TaxOptimizationStrategy {
  id: string;
  name: string;
  description: string;
  gainsToOffset: number;
  lossesToUse: number;
  netTaxBenefit: number;
  candidatesToSell: string[];
  priority: 'high' | 'medium' | 'low';
}

interface Props {
  realizedGains?: {
    shortTerm: number;
    longTerm: number;
    total: number;
  };
  sells?: SellWithPL[];
  transactions?: any[];
}

export const TaxLossHarvestingAdvisor = ({ realizedGains, sells = [], transactions = [] }: Props) => {
  const { activePortfolio } = usePortfolio();
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [taxBracket, setTaxBracket] = useState<string>('32'); // Federal marginal rate
  const [stateTaxRate, setStateTaxRate] = useState<string>('5');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const taxRate = (parseFloat(taxBracket) + parseFloat(stateTaxRate)) / 100;
  const longTermRate = 0.15 + (parseFloat(stateTaxRate) / 100); // 15% federal LTCG + state

  // Build recent buy map for wash sale risk detection
  const recentBuys = useMemo(() => {
    const now = new Date();
    const buyMap: Record<string, Date> = {};
    
    transactions.forEach(txn => {
      if (txn.type === 'BUY') {
        const symbol = cleanSymbol(txn.symbol);
        const buyDate = new Date(txn.date);
        const daysSinceBuy = differenceInDays(now, buyDate);
        
        // Track if purchased within last 30 days
        if (daysSinceBuy <= 30) {
          if (!buyMap[symbol] || buyDate > buyMap[symbol]) {
            buyMap[symbol] = buyDate;
          }
        }
      }
    });
    
    return buyMap;
  }, [transactions]);

  // Find holdings with unrealized losses
  const candidates = useMemo((): HarvestCandidate[] => {
    const holdings = activePortfolio?.holdings || [];
    const today = new Date();
    
    return holdings
      .map(h => {
        const currentPrice = h.currentPrice || h.avgPrice || 0;
        const avgPrice = h.avgPrice || 0;
        const shares = h.shares || 0;
        const currentValue = shares * currentPrice;
        const costBasis = shares * avgPrice;
        const unrealizedLoss = costBasis - currentValue;
        const unrealizedLossPercent = avgPrice > 0 ? ((avgPrice - currentPrice) / avgPrice) * 100 : 0;
        
        // Estimate holding period (in production, use actual purchase date)
        const holdingPeriod = 30 + (h.symbol.charCodeAt(0) % 400);
        const isLongTerm = holdingPeriod > 365;
        
        const symbol = cleanSymbol(h.symbol);
        const hasRecentBuy = !!recentBuys[symbol];
        
        // Calculate tax savings based on term
        const effectiveRate = isLongTerm ? longTermRate : taxRate;
        const potentialTaxSavings = unrealizedLoss > 0 ? unrealizedLoss * effectiveRate : 0;
        
        return {
          symbol,
          name: h.name,
          shares,
          avgPrice,
          currentPrice,
          unrealizedLoss,
          unrealizedLossPercent,
          holdingPeriod,
          isLongTerm,
          potentialTaxSavings,
          washSaleRisk: hasRecentBuy,
          recentPurchaseDate: recentBuys[symbol]?.toISOString()
        };
      })
      .filter(c => c.unrealizedLoss > 0)
      .sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);
  }, [activePortfolio?.holdings, taxRate, longTermRate, recentBuys]);

  // Generate optimization strategies
  const strategies = useMemo((): TaxOptimizationStrategy[] => {
    const gains = realizedGains || { shortTerm: 0, longTerm: 0, total: 0 };
    const strategies: TaxOptimizationStrategy[] = [];
    
    const shortTermLosses = candidates.filter(c => !c.isLongTerm);
    const longTermLosses = candidates.filter(c => c.isLongTerm);
    const totalHarvestable = candidates.reduce((sum, c) => sum + c.unrealizedLoss, 0);
    
    // Strategy 1: Offset short-term gains with short-term losses (highest priority)
    if (gains.shortTerm > 0 && shortTermLosses.length > 0) {
      const lossesToUse = Math.min(
        shortTermLosses.reduce((sum, c) => sum + c.unrealizedLoss, 0),
        gains.shortTerm
      );
      strategies.push({
        id: 'offset-st-gains',
        name: 'Offset Short-Term Gains',
        description: `Use short-term losses to offset short-term gains (taxed at ${(taxRate * 100).toFixed(0)}% ordinary income rate)`,
        gainsToOffset: Math.min(gains.shortTerm, lossesToUse),
        lossesToUse,
        netTaxBenefit: lossesToUse * taxRate,
        candidatesToSell: shortTermLosses.map(c => c.symbol).slice(0, 5),
        priority: 'high'
      });
    }
    
    // Strategy 2: Offset long-term gains with long-term losses
    if (gains.longTerm > 0 && longTermLosses.length > 0) {
      const lossesToUse = Math.min(
        longTermLosses.reduce((sum, c) => sum + c.unrealizedLoss, 0),
        gains.longTerm
      );
      strategies.push({
        id: 'offset-lt-gains',
        name: 'Offset Long-Term Gains',
        description: `Use long-term losses to offset long-term gains (taxed at ${(longTermRate * 100).toFixed(0)}% LTCG rate)`,
        gainsToOffset: Math.min(gains.longTerm, lossesToUse),
        lossesToUse,
        netTaxBenefit: lossesToUse * longTermRate,
        candidatesToSell: longTermLosses.map(c => c.symbol).slice(0, 5),
        priority: 'medium'
      });
    }
    
    // Strategy 3: Carry forward excess losses (up to $3,000/year offset ordinary income)
    const excessLoss = Math.max(0, totalHarvestable - gains.total);
    if (excessLoss > 0) {
      const annualDeduction = Math.min(3000, excessLoss);
      strategies.push({
        id: 'excess-deduction',
        name: 'Ordinary Income Deduction',
        description: `Deduct up to $3,000 of excess capital losses against ordinary income (remaining carries forward)`,
        gainsToOffset: 0,
        lossesToUse: annualDeduction,
        netTaxBenefit: annualDeduction * taxRate,
        candidatesToSell: [],
        priority: 'low'
      });
    }
    
    // Strategy 4: Cross-category offset (use excess ST losses for LT gains or vice versa)
    const excessShortTermLoss = Math.max(0, 
      shortTermLosses.reduce((sum, c) => sum + c.unrealizedLoss, 0) - gains.shortTerm
    );
    if (excessShortTermLoss > 0 && gains.longTerm > 0) {
      const lossesToUse = Math.min(excessShortTermLoss, gains.longTerm);
      strategies.push({
        id: 'st-to-lt-offset',
        name: 'Cross-Category Offset',
        description: `Use excess short-term losses to offset long-term gains (reduces overall tax but converts savings rate)`,
        gainsToOffset: lossesToUse,
        lossesToUse,
        netTaxBenefit: lossesToUse * longTermRate,
        candidatesToSell: shortTermLosses.map(c => c.symbol).slice(0, 3),
        priority: 'medium'
      });
    }

    return strategies.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [candidates, realizedGains, taxRate, longTermRate]);

  const toggleCandidate = (symbol: string) => {
    setSelectedCandidates(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCandidates(new Set(candidates.filter(c => !c.washSaleRisk).map(c => c.symbol)));
  };

  const clearSelection = () => {
    setSelectedCandidates(new Set());
  };

  const selectedStats = useMemo(() => {
    const selected = candidates.filter(c => selectedCandidates.has(c.symbol));
    return {
      totalLoss: selected.reduce((sum, c) => sum + c.unrealizedLoss, 0),
      totalTaxSavings: selected.reduce((sum, c) => sum + c.potentialTaxSavings, 0),
      count: selected.length,
      shortTermCount: selected.filter(c => !c.isLongTerm).length,
      longTermCount: selected.filter(c => c.isLongTerm).length,
    };
  }, [candidates, selectedCandidates]);

  const totalStats = useMemo(() => ({
    totalLoss: candidates.reduce((sum, c) => sum + c.unrealizedLoss, 0),
    totalSavings: candidates.reduce((sum, c) => sum + c.potentialTaxSavings, 0),
    shortTermLoss: candidates.filter(c => !c.isLongTerm).reduce((sum, c) => sum + c.unrealizedLoss, 0),
    longTermLoss: candidates.filter(c => c.isLongTerm).reduce((sum, c) => sum + c.unrealizedLoss, 0),
    washSaleRiskCount: candidates.filter(c => c.washSaleRisk).length,
  }), [candidates]);

  if (candidates.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
          <h3 className="text-lg font-semibold mb-2">No Harvest Opportunities</h3>
          <p className="text-muted-foreground">
            All your positions have gains or are at break-even. No tax-loss harvesting needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card with Tax Settings */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                Tax-Loss Harvesting Advisor
              </CardTitle>
              <CardDescription>
                Smart strategies to minimize your tax liability
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Calculator className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Tax Settings
            </Button>
          </div>
        </CardHeader>
        {showAdvanced && (
          <CardContent className="pt-0 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div>
                <Label htmlFor="tax-bracket">Federal Tax Bracket</Label>
                <Select value={taxBracket} onValueChange={setTaxBracket}>
                  <SelectTrigger id="tax-bracket">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="22">22%</SelectItem>
                    <SelectItem value="24">24%</SelectItem>
                    <SelectItem value="32">32%</SelectItem>
                    <SelectItem value="35">35%</SelectItem>
                    <SelectItem value="37">37%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="state-tax">State Tax Rate</Label>
                <Input 
                  id="state-tax"
                  type="number" 
                  value={stateTaxRate} 
                  onChange={(e) => setStateTaxRate(e.target.value)}
                  min={0}
                  max={15}
                  step={0.1}
                />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-muted-foreground">Combined Rate (ST)</p>
                <p className="text-lg font-bold text-primary">{(taxRate * 100).toFixed(1)}%</p>
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-muted-foreground">LTCG Rate</p>
                <p className="text-lg font-bold text-blue-500">{(longTermRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs">Total Harvestable</span>
            </div>
            <p className="text-2xl font-bold text-red-500">
              -${totalStats.totalLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{candidates.length} positions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs">Potential Tax Savings</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              ${totalStats.totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs">Short-Term Losses</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              -${totalStats.shortTermLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs">Long-Term Losses</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              -${totalStats.longTermLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Strategies */}
      {strategies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Recommended Strategies
            </CardTitle>
            <CardDescription>
              Optimize your tax situation based on current gains and available losses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className={`p-4 rounded-lg border ${
                  strategy.priority === 'high' 
                    ? 'bg-emerald-500/5 border-emerald-500/20' 
                    : strategy.priority === 'medium'
                    ? 'bg-blue-500/5 border-blue-500/20'
                    : 'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{strategy.name}</h4>
                      <Badge 
                        variant={strategy.priority === 'high' ? 'default' : 'secondary'}
                        className={strategy.priority === 'high' ? 'bg-emerald-500' : ''}
                      >
                        {strategy.priority} priority
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{strategy.description}</p>
                    {strategy.candidatesToSell.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">Candidates:</span>
                        {strategy.candidatesToSell.map(symbol => (
                          <Badge key={symbol} variant="outline" className="text-xs">{symbol}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Tax Benefit</p>
                    <p className="text-lg font-bold text-emerald-500">
                      ${strategy.netTaxBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Harvest Candidates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Harvest Candidates</CardTitle>
              <CardDescription>
                Positions with unrealized losses available for harvesting
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select Safe
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-primary mb-1">Wash Sale Rule Reminder</p>
              <p className="text-muted-foreground text-xs">
                Avoid repurchasing the same or "substantially identical" securities within 30 days 
                before or after the sale. Positions with recent purchases are flagged.
              </p>
            </div>
          </div>

          {/* Selected Summary */}
          {selectedCandidates.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {selectedStats.count} Position{selectedStats.count !== 1 ? 's' : ''} Selected
                </p>
                <p className="text-sm text-muted-foreground">
                  ${selectedStats.totalLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })} in losses
                  {' → '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ${selectedStats.totalTaxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} estimated savings
                  </span>
                  <span className="text-xs ml-2">
                    ({selectedStats.shortTermCount} ST / {selectedStats.longTermCount} LT)
                  </span>
                </p>
              </div>
              <Button className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Generate Sell Orders
              </Button>
            </div>
          )}

          {/* Candidates List */}
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.symbol}
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer ${
                  candidate.washSaleRisk 
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : selectedCandidates.has(candidate.symbol) 
                    ? 'bg-primary/5 border-primary/30' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleCandidate(candidate.symbol)}
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedCandidates.has(candidate.symbol)}
                    onCheckedChange={() => toggleCandidate(candidate.symbol)}
                  />
                  <div className={`p-2 rounded-full ${
                    candidate.isLongTerm ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{candidate.symbol}</span>
                      <Badge variant="outline" className={candidate.isLongTerm ? 'text-blue-500 border-blue-500/30' : 'text-amber-500 border-amber-500/30'}>
                        {candidate.isLongTerm ? 'Long-term' : 'Short-term'}
                      </Badge>
                      {candidate.washSaleRisk && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Wash Sale Risk
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-xs">
                                You purchased this security within the last 30 days. 
                                Selling now may trigger wash-sale rules.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{candidate.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.shares.toFixed(2)} shares @ ${candidate.avgPrice.toFixed(2)} avg
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Current Price</div>
                    <div className="font-medium">
                      ${candidate.currentPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Unrealized Loss</div>
                    <div className="font-semibold text-red-500">
                      -${candidate.unrealizedLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-red-400">
                      {candidate.unrealizedLossPercent.toFixed(1)}% down
                    </div>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <div className="text-xs text-muted-foreground">Tax Savings</div>
                    <div className="font-semibold text-emerald-500">
                      ${candidate.potentialTaxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @ {((candidate.isLongTerm ? longTermRate : taxRate) * 100).toFixed(0)}% rate
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-amber-700 dark:text-amber-400">
              <strong>Disclaimer:</strong> This is for informational purposes only and does not constitute 
              tax advice. Consult a qualified tax professional before making investment decisions based on 
              tax considerations. Tax rates and regulations vary by jurisdiction.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
