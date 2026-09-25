import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingDown, TrendingUp, Calculator, Target, DollarSign, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTaxLots } from '@/hooks/useTaxLots';
import { useStockPrices } from '@/hooks/useStockPrices';
import { usePortfolio } from '@/context/PortfolioContext';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';

interface OptimizationStrategy {
  name: string;
  description: string;
  estimatedTax: number;
  lotsToSell: { lotId: string; symbol: string; shares: number; gain: number; isLongTerm: boolean }[];
  netGain: number;
  taxSavings: number;
}

// 2024 Tax Brackets
const TAX_BRACKETS = {
  single: {
    shortTerm: [
      { max: 11600, rate: 0.10 },
      { max: 47150, rate: 0.12 },
      { max: 100525, rate: 0.22 },
      { max: 191950, rate: 0.24 },
      { max: 243725, rate: 0.32 },
      { max: 609350, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    longTerm: [
      { max: 47025, rate: 0 },
      { max: 518900, rate: 0.15 },
      { max: Infinity, rate: 0.20 }
    ]
  },
  married_joint: {
    shortTerm: [
      { max: 23200, rate: 0.10 },
      { max: 94300, rate: 0.12 },
      { max: 201050, rate: 0.22 },
      { max: 383900, rate: 0.24 },
      { max: 487450, rate: 0.32 },
      { max: 731200, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    longTerm: [
      { max: 94050, rate: 0 },
      { max: 583750, rate: 0.15 },
      { max: Infinity, rate: 0.20 }
    ]
  },
  married_separate: {
    shortTerm: [
      { max: 11600, rate: 0.10 },
      { max: 47150, rate: 0.12 },
      { max: 100525, rate: 0.22 },
      { max: 191950, rate: 0.24 },
      { max: 243725, rate: 0.32 },
      { max: 365600, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    longTerm: [
      { max: 47025, rate: 0 },
      { max: 291850, rate: 0.15 },
      { max: Infinity, rate: 0.20 }
    ]
  },
  head_of_household: {
    shortTerm: [
      { max: 16550, rate: 0.10 },
      { max: 63100, rate: 0.12 },
      { max: 100500, rate: 0.22 },
      { max: 191950, rate: 0.24 },
      { max: 243700, rate: 0.32 },
      { max: 609350, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    longTerm: [
      { max: 63000, rate: 0 },
      { max: 551350, rate: 0.15 },
      { max: Infinity, rate: 0.20 }
    ]
  }
};

export const CapitalGainsOptimizer: React.FC = () => {
  const [ordinaryIncome, setOrdinaryIncome] = useState<string>('75000');
  const [existingGains, setExistingGains] = useState<string>('0');
  const [existingLosses, setExistingLosses] = useState<string>('0');
  const [targetNetGain, setTargetNetGain] = useState<string>('');
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  
  const { taxLots } = useTaxLots();
  const { activePortfolio } = usePortfolio();
  const symbols = useMemo(() => [...new Set(taxLots.map(l => l.symbol))], [taxLots]);
  const { prices } = useStockPrices(symbols);

  const openLots = useMemo(() => {
    return taxLots.filter(lot => !lot.is_closed);
  }, [taxLots]);

  const lotsWithGains = useMemo(() => {
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());

    return openLots.map(lot => {
      const currentPrice = prices[lot.symbol] || 0;
      const marketValue = lot.shares * currentPrice;
      const gain = marketValue - lot.cost_basis;
      const purchaseDate = new Date(lot.purchase_date);
      const isLongTerm = purchaseDate < oneYearAgo;

      return {
        ...lot,
        currentPrice,
        marketValue,
        gain,
        gainPercent: lot.cost_basis > 0 ? (gain / lot.cost_basis) * 100 : 0,
        isLongTerm
      };
    });
  }, [openLots, prices]);

  const calculateTax = (
    shortTermGains: number, 
    longTermGains: number, 
    income: number,
    status: FilingStatus
  ): number => {
    const brackets = TAX_BRACKETS[status];
    
    // Short-term gains taxed as ordinary income
    let shortTermTax = 0;
    let remainingShortTerm = Math.max(0, shortTermGains);
    let totalIncome = income;
    
    for (const bracket of brackets.shortTerm) {
      if (totalIncome >= bracket.max) continue;
      const taxableInBracket = Math.min(remainingShortTerm, bracket.max - totalIncome);
      shortTermTax += taxableInBracket * bracket.rate;
      remainingShortTerm -= taxableInBracket;
      totalIncome += taxableInBracket;
      if (remainingShortTerm <= 0) break;
    }

    // Long-term gains
    let longTermTax = 0;
    let remainingLongTerm = Math.max(0, longTermGains);
    
    for (const bracket of brackets.longTerm) {
      if (totalIncome >= bracket.max) {
        continue;
      }
      const taxableInBracket = Math.min(remainingLongTerm, bracket.max - totalIncome);
      longTermTax += taxableInBracket * bracket.rate;
      remainingLongTerm -= taxableInBracket;
      totalIncome += taxableInBracket;
      if (remainingLongTerm <= 0) break;
    }

    return shortTermTax + longTermTax;
  };

  const strategies = useMemo((): OptimizationStrategy[] => {
    const income = parseFloat(ordinaryIncome) || 0;
    const priorGains = parseFloat(existingGains) || 0;
    const priorLosses = parseFloat(existingLosses) || 0;
    const target = targetNetGain ? parseFloat(targetNetGain) : null;

    const losers = lotsWithGains.filter(l => l.gain < 0).sort((a, b) => a.gain - b.gain);
    const winners = lotsWithGains.filter(l => l.gain > 0).sort((a, b) => b.gain - a.gain);
    const longTermWinners = winners.filter(l => l.isLongTerm);
    const shortTermLosers = losers.filter(l => !l.isLongTerm);

    // Calculate baseline tax (no action)
    const baselineShortTermGains = priorGains - priorLosses;
    const baselineTax = calculateTax(Math.max(0, baselineShortTermGains), 0, income, filingStatus);

    const strategies: OptimizationStrategy[] = [];

    // Strategy 1: Harvest all losses
    if (losers.length > 0) {
      const totalLoss = losers.reduce((sum, l) => sum + l.gain, 0);
      const netGain = priorGains - priorLosses + totalLoss;
      const estimatedTax = calculateTax(Math.max(0, netGain), 0, income, filingStatus);
      
      strategies.push({
        name: 'Harvest All Losses',
        description: 'Sell all positions with unrealized losses to offset gains and reduce taxes',
        lotsToSell: losers.map(l => ({
          lotId: l.id,
          symbol: l.symbol,
          shares: l.shares,
          gain: l.gain,
          isLongTerm: l.isLongTerm
        })),
        estimatedTax,
        netGain,
        taxSavings: baselineTax - estimatedTax
      });
    }

    // Strategy 2: Realize long-term gains (lower tax rate)
    if (longTermWinners.length > 0) {
      const shortTermGains = priorGains - priorLosses;
      const longTermGains = longTermWinners.reduce((sum, l) => sum + l.gain, 0);
      const estimatedTax = calculateTax(Math.max(0, shortTermGains), longTermGains, income, filingStatus);
      
      strategies.push({
        name: 'Realize Long-Term Gains',
        description: 'Lock in long-term gains at preferential tax rates (0-20%)',
        lotsToSell: longTermWinners.map(l => ({
          lotId: l.id,
          symbol: l.symbol,
          shares: l.shares,
          gain: l.gain,
          isLongTerm: l.isLongTerm
        })),
        estimatedTax,
        netGain: shortTermGains + longTermGains,
        taxSavings: 0 // This is for taking gains, not saving
      });
    }

    // Strategy 3: Offset gains with short-term losses
    if (shortTermLosers.length > 0 && priorGains > 0) {
      const totalLoss = shortTermLosers.reduce((sum, l) => sum + l.gain, 0);
      const netGain = priorGains - priorLosses + totalLoss;
      const estimatedTax = calculateTax(Math.max(0, netGain), 0, income, filingStatus);
      
      strategies.push({
        name: 'Offset Short-Term Gains',
        description: 'Use short-term losses to offset short-term gains (taxed at highest rates)',
        lotsToSell: shortTermLosers.map(l => ({
          lotId: l.id,
          symbol: l.symbol,
          shares: l.shares,
          gain: l.gain,
          isLongTerm: l.isLongTerm
        })),
        estimatedTax,
        netGain,
        taxSavings: baselineTax - estimatedTax
      });
    }

    // Strategy 4: Target net gain (if specified)
    if (target !== null && lotsWithGains.length > 0) {
      const currentNet = priorGains - priorLosses;
      const neededGainOrLoss = target - currentNet;
      
      let selectedLots: typeof lotsWithGains = [];
      let runningTotal = 0;

      if (neededGainOrLoss < 0) {
        // Need losses
        for (const lot of losers) {
          if (runningTotal <= neededGainOrLoss) break;
          selectedLots.push(lot);
          runningTotal += lot.gain;
        }
      } else {
        // Need gains
        for (const lot of longTermWinners) {
          if (runningTotal >= neededGainOrLoss) break;
          selectedLots.push(lot);
          runningTotal += lot.gain;
        }
      }

      if (selectedLots.length > 0) {
        const longTermGains = selectedLots.filter(l => l.isLongTerm && l.gain > 0).reduce((sum, l) => sum + l.gain, 0);
        const shortTermAdjustment = selectedLots.filter(l => !l.isLongTerm || l.gain < 0).reduce((sum, l) => sum + l.gain, 0);
        const newShortTermNet = currentNet + shortTermAdjustment;
        const estimatedTax = calculateTax(Math.max(0, newShortTermNet), longTermGains, income, filingStatus);

        strategies.push({
          name: `Target: $${target.toLocaleString()} Net`,
          description: `Optimize trades to achieve approximately $${target.toLocaleString()} in net capital gains`,
          lotsToSell: selectedLots.map(l => ({
            lotId: l.id,
            symbol: l.symbol,
            shares: l.shares,
            gain: l.gain,
            isLongTerm: l.isLongTerm
          })),
          estimatedTax,
          netGain: currentNet + runningTotal,
          taxSavings: baselineTax - estimatedTax
        });
      }
    }

    return strategies.sort((a, b) => b.taxSavings - a.taxSavings);
  }, [ordinaryIncome, existingGains, existingLosses, targetNetGain, filingStatus, lotsWithGains]);

  const summary = useMemo(() => {
    const totalUnrealizedGains = lotsWithGains.filter(l => l.gain > 0).reduce((sum, l) => sum + l.gain, 0);
    const totalUnrealizedLosses = lotsWithGains.filter(l => l.gain < 0).reduce((sum, l) => sum + l.gain, 0);
    const longTermGains = lotsWithGains.filter(l => l.isLongTerm && l.gain > 0).reduce((sum, l) => sum + l.gain, 0);
    const shortTermGains = lotsWithGains.filter(l => !l.isLongTerm && l.gain > 0).reduce((sum, l) => sum + l.gain, 0);
    
    return { totalUnrealizedGains, totalUnrealizedLosses, longTermGains, shortTermGains };
  }, [lotsWithGains]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tax Situation
          </CardTitle>
          <CardDescription>
            Enter your tax details to get personalized optimization strategies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Filing Status</Label>
              <Select value={filingStatus} onValueChange={(v) => setFilingStatus(v as FilingStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married_joint">Married Filing Jointly</SelectItem>
                  <SelectItem value="married_separate">Married Filing Separately</SelectItem>
                  <SelectItem value="head_of_household">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordinary Income ($)</Label>
              <Input
                type="number"
                value={ordinaryIncome}
                onChange={(e) => setOrdinaryIncome(e.target.value)}
                placeholder="75000"
              />
            </div>
            <div className="space-y-2">
              <Label>Existing Gains YTD ($)</Label>
              <Input
                type="number"
                value={existingGains}
                onChange={(e) => setExistingGains(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Existing Losses YTD ($)</Label>
              <Input
                type="number"
                value={existingLosses}
                onChange={(e) => setExistingLosses(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Net Gain ($)</Label>
              <Input
                type="number"
                value={targetNetGain}
                onChange={(e) => setTargetNetGain(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Position Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Unrealized Gains
              </div>
              <div className="text-xl font-semibold text-green-500">
                ${summary.totalUnrealizedGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Unrealized Losses
              </div>
              <div className="text-xl font-semibold text-red-500">
                ${Math.abs(summary.totalUnrealizedLosses).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Long-Term Gains</div>
              <div className="text-xl font-semibold">
                ${summary.longTermGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground">0-20% tax rate</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Short-Term Gains</div>
              <div className="text-xl font-semibold">
                ${summary.shortTermGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-muted-foreground">Ordinary income rates</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Optimization Strategies
          </CardTitle>
          <CardDescription>
            Ranked by potential tax savings based on your situation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {strategies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No optimization strategies available.</p>
              <p className="text-sm">Add tax lots with gains or losses to see suggestions.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {strategies.map((strategy, idx) => (
                <Card key={idx} className={idx === 0 ? 'border-primary' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{strategy.name}</h3>
                          {idx === 0 && <Badge variant="default">Recommended</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                      </div>
                      {strategy.taxSavings > 0 && (
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Save ${strategy.taxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Badge>
                      )}
                    </div>

                    <Separator className="my-3" />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Lots to Sell</div>
                        <div className="font-medium">{strategy.lotsToSell.length}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Net Gain/Loss</div>
                        <div className={`font-medium ${strategy.netGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ${strategy.netGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Estimated Tax</div>
                        <div className="font-medium">
                          ${strategy.estimatedTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Tax Savings</div>
                        <div className="font-medium text-green-500">
                          ${strategy.taxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground mb-2">Positions to sell:</div>
                      <div className="flex flex-wrap gap-2">
                        {strategy.lotsToSell.slice(0, 5).map((lot, lotIdx) => (
                          <Badge 
                            key={lotIdx} 
                            variant="outline"
                            className={lot.gain >= 0 ? 'border-green-500/50' : 'border-red-500/50'}
                          >
                            {lot.symbol}: {lot.shares} shares
                            <span className={lot.gain >= 0 ? 'text-green-500 ml-1' : 'text-red-500 ml-1'}>
                              ({lot.gain >= 0 ? '+' : ''}${lot.gain.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </span>
                          </Badge>
                        ))}
                        {strategy.lotsToSell.length > 5 && (
                          <Badge variant="secondary">+{strategy.lotsToSell.length - 5} more</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
