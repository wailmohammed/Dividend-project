import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { differenceInDays, format } from 'date-fns';
import {
  Scissors, TrendingDown, AlertTriangle, DollarSign,
  Calendar, Info, CheckCircle2, ArrowRight
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface HarvestCandidate {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedLoss: number;
  unrealizedLossPercent: number;
  holdingPeriod: number; // days
  isLongTerm: boolean;
  potentialTaxSavings: number;
  washSaleRisk: boolean;
}

export const TaxLossHarvesting: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [taxRate, setTaxRate] = useState(0.35); // Assume 35% marginal rate

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
        
        // Simulate holding period (in real app, would come from purchase date)
        const holdingPeriod = 30 + (h.symbol.charCodeAt(0) % 400); // Random 30-430 days
        const isLongTerm = holdingPeriod > 365;
        
        // Calculate potential tax savings
        const effectiveRate = isLongTerm ? taxRate * 0.6 : taxRate; // Long-term has lower rate
        const potentialTaxSavings = unrealizedLoss > 0 ? unrealizedLoss * effectiveRate : 0;
        
        return {
          symbol: cleanSymbol(h.symbol),
          name: h.name,
          shares,
          avgPrice,
          currentPrice,
          unrealizedLoss,
          unrealizedLossPercent,
          holdingPeriod,
          isLongTerm,
          potentialTaxSavings,
          washSaleRisk: false, // Would need to check recent transactions
        };
      })
      .filter(c => c.unrealizedLoss > 0) // Only include losses
      .sort((a, b) => b.unrealizedLoss - a.unrealizedLoss);
  }, [activePortfolio?.holdings, taxRate]);

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
    setSelectedCandidates(new Set(candidates.map(c => c.symbol)));
  };

  const clearSelection = () => {
    setSelectedCandidates(new Set());
  };

  // Calculate totals for selected candidates
  const selectedStats = useMemo(() => {
    const selected = candidates.filter(c => selectedCandidates.has(c.symbol));
    return {
      totalLoss: selected.reduce((sum, c) => sum + c.unrealizedLoss, 0),
      totalTaxSavings: selected.reduce((sum, c) => sum + c.potentialTaxSavings, 0),
      count: selected.length,
    };
  }, [candidates, selectedCandidates]);

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              Tax-Loss Harvesting
            </CardTitle>
            <CardDescription>
              Identify positions with losses to offset capital gains
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Total Harvestable Loss</div>
            <div className="text-xl font-bold text-red-500">
              -${candidates.reduce((sum, c) => sum + c.unrealizedLoss, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Potential Tax Savings</div>
            <div className="text-xl font-bold text-emerald-500">
              ${candidates.reduce((sum, c) => sum + c.potentialTaxSavings, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Candidates</div>
            <div className="text-xl font-bold">
              {candidates.length} positions
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-primary mb-1">How Tax-Loss Harvesting Works</p>
            <p className="text-muted-foreground text-xs">
              Sell positions with losses to realize capital losses, which can offset capital gains 
              and reduce your tax bill. Be aware of the wash-sale rule: avoid repurchasing the 
              same or "substantially identical" securities within 30 days.
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
                  ${selectedStats.totalTaxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} potential savings
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
                selectedCandidates.has(candidate.symbol) 
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
                <div className="p-2 rounded-full bg-red-500/10 text-red-500">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{candidate.symbol}</span>
                    <Badge variant="outline" className={candidate.isLongTerm ? 'text-primary' : ''}>
                      {candidate.isLongTerm ? 'Long-term' : 'Short-term'}
                    </Badge>
                    {candidate.washSaleRisk && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Wash Sale Risk
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-xs">
                              You may have recently purchased this security. Selling now could 
                              trigger wash-sale rules, disallowing the loss deduction.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{candidate.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
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
                    {candidate.shares} shares
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
  );
};

export default TaxLossHarvesting;
