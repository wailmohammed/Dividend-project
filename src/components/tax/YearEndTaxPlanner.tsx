import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Lightbulb, 
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { TaxLot } from '@/hooks/useTaxLots';
import { useWashSaleEnforcement } from '@/hooks/useWashSaleEnforcement';
import { differenceInDays } from 'date-fns';

interface YearEndTaxPlannerProps {
  taxLots: TaxLot[];
  currentPrices: Record<string, number>;
}

// 2024 Tax Brackets
const TAX_BRACKETS = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 }
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 }
  ]
};

const LONG_TERM_BRACKETS = {
  single: [
    { min: 0, max: 47025, rate: 0 },
    { min: 47025, max: 518900, rate: 0.15 },
    { min: 518900, max: Infinity, rate: 0.20 }
  ],
  married: [
    { min: 0, max: 94050, rate: 0 },
    { min: 94050, max: 583750, rate: 0.15 },
    { min: 583750, max: Infinity, rate: 0.20 }
  ]
};

interface SuggestedTrade {
  lot: TaxLot;
  currentPrice: number;
  gainLoss: number;
  isLongTerm: boolean;
  action: 'harvest_loss' | 'realize_gain' | 'wait_long_term' | 'hold';
  reason: string;
  taxImpact: number;
  priority: number;
  daysToLongTerm?: number;
}

export const YearEndTaxPlanner: React.FC<YearEndTaxPlannerProps> = ({ 
  taxLots, 
  currentPrices 
}) => {
  const currentYear = new Date().getFullYear();
  const [ordinaryIncome, setOrdinaryIncome] = useState<string>('75000');
  const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('single');
  const [targetTax, setTargetTax] = useState<string>('');
  
  const { totalDisallowedLoss, washSaleAdjustments } = useWashSaleEnforcement(taxLots);

  // Calculate year-to-date realized gains/losses
  const ytdRealizedGains = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return taxLots
      .filter(lot => {
        if (!lot.is_closed || !lot.sale_date) return false;
        return new Date(lot.sale_date).getFullYear() === currentYear;
      })
      .reduce((sum, lot) => {
        const isLongTerm = differenceInDays(
          new Date(lot.sale_date!),
          new Date(lot.purchase_date)
        ) >= 365;
        
        return {
          shortTerm: sum.shortTerm + (isLongTerm ? 0 : (lot.realized_gain_loss || 0)),
          longTerm: sum.longTerm + (isLongTerm ? (lot.realized_gain_loss || 0) : 0)
        };
      }, { shortTerm: 0, longTerm: 0 });
  }, [taxLots]);

  // Calculate unrealized gains/losses for open positions
  const unrealizedPositions = useMemo(() => {
    return taxLots
      .filter(lot => !lot.is_closed)
      .map(lot => {
        const currentPrice = currentPrices[lot.symbol] || lot.cost_basis;
        const gainLoss = (currentPrice - lot.cost_basis) * lot.shares;
        const daysHeld = differenceInDays(new Date(), new Date(lot.purchase_date));
        const isLongTerm = daysHeld >= 365;
        const daysToLongTerm = isLongTerm ? 0 : 365 - daysHeld;

        return {
          ...lot,
          currentPrice,
          gainLoss,
          gainLossPercent: ((currentPrice - lot.cost_basis) / lot.cost_basis) * 100,
          daysHeld,
          isLongTerm,
          daysToLongTerm
        };
      });
  }, [taxLots, currentPrices]);

  // Calculate projected tax liability
  const projectedTax = useMemo(() => {
    const income = parseFloat(ordinaryIncome) || 0;
    const brackets = TAX_BRACKETS[filingStatus];
    const ltBrackets = LONG_TERM_BRACKETS[filingStatus];

    // Short-term gains taxed as ordinary income
    const totalOrdinaryIncome = income + Math.max(0, ytdRealizedGains.shortTerm);
    
    let ordinaryTax = 0;
    let remainingIncome = totalOrdinaryIncome;
    for (const bracket of brackets) {
      if (remainingIncome <= 0) break;
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
      ordinaryTax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }

    // Long-term gains taxed at preferential rates
    let ltTax = 0;
    let remainingLT = Math.max(0, ytdRealizedGains.longTerm);
    for (const bracket of ltBrackets) {
      if (remainingLT <= 0) break;
      const taxableInBracket = Math.min(remainingLT, bracket.max - bracket.min);
      ltTax += taxableInBracket * bracket.rate;
      remainingLT -= taxableInBracket;
    }

    // Deductible loss limit
    const netGainLoss = ytdRealizedGains.shortTerm + ytdRealizedGains.longTerm;
    const deductibleLoss = netGainLoss < 0 ? Math.min(Math.abs(netGainLoss), 3000) : 0;
    const carryoverLoss = netGainLoss < 0 ? Math.max(0, Math.abs(netGainLoss) - 3000) : 0;

    return {
      ordinaryTax,
      ltTax,
      totalTax: ordinaryTax + ltTax,
      deductibleLoss,
      carryoverLoss,
      effectiveTaxRate: totalOrdinaryIncome > 0 ? ((ordinaryTax + ltTax) / totalOrdinaryIncome) * 100 : 0
    };
  }, [ordinaryIncome, filingStatus, ytdRealizedGains]);

  // Generate December trade suggestions
  const suggestedTrades = useMemo((): SuggestedTrade[] => {
    const suggestions: SuggestedTrade[] = [];
    const netGains = ytdRealizedGains.shortTerm + ytdRealizedGains.longTerm - totalDisallowedLoss;

    unrealizedPositions.forEach(pos => {
      const lot = taxLots.find(l => l.id === pos.id)!;
      
      // Calculate tax impact
      let taxImpact = 0;
      if (pos.gainLoss < 0) {
        // Loss can offset gains
        if (netGains > 0) {
          taxImpact = Math.min(Math.abs(pos.gainLoss), netGains) * 
            (pos.isLongTerm ? 0.15 : 0.22); // Approximate tax savings
        } else {
          taxImpact = Math.min(Math.abs(pos.gainLoss), 3000) * 0.22; // Standard deduction benefit
        }
      } else {
        // Gain will be taxed
        taxImpact = -pos.gainLoss * (pos.isLongTerm ? 0.15 : 0.22);
      }

      // Determine action
      let action: SuggestedTrade['action'] = 'hold';
      let reason = '';
      let priority = 0;

      if (pos.gainLoss < 0 && netGains > 0) {
        action = 'harvest_loss';
        reason = `Harvest ${Math.abs(pos.gainLoss).toFixed(0)} loss to offset $${netGains.toFixed(0)} in gains`;
        priority = 10 + Math.abs(pos.gainLossPercent);
      } else if (pos.gainLoss < 0 && netGains <= -3000) {
        action = 'hold';
        reason = 'Already have sufficient losses to maximize $3,000 deduction';
        priority = 1;
      } else if (pos.gainLoss > 0 && pos.daysToLongTerm > 0 && pos.daysToLongTerm <= 45) {
        action = 'wait_long_term';
        reason = `Wait ${pos.daysToLongTerm} days for long-term treatment (save ~${((pos.gainLoss * 0.07)).toFixed(0)} in taxes)`;
        priority = 8;
      } else if (pos.gainLoss > 0 && pos.isLongTerm && netGains < 0) {
        action = 'realize_gain';
        reason = 'Use existing losses to offset this long-term gain tax-free';
        priority = 7;
      } else if (pos.gainLoss < 0 && Math.abs(pos.gainLoss) > 1000) {
        action = 'harvest_loss';
        reason = `Consider harvesting for future tax benefit or $3,000 deduction`;
        priority = 5;
      }

      suggestions.push({
        lot,
        currentPrice: pos.currentPrice,
        gainLoss: pos.gainLoss,
        isLongTerm: pos.isLongTerm,
        action,
        reason,
        taxImpact,
        priority,
        daysToLongTerm: pos.daysToLongTerm
      });
    });

    return suggestions
      .filter(s => s.action !== 'hold' || s.priority > 3)
      .sort((a, b) => b.priority - a.priority);
  }, [unrealizedPositions, ytdRealizedGains, totalDisallowedLoss, taxLots]);

  // Calculate days until year end
  const daysUntilYearEnd = differenceInDays(new Date(`${currentYear}-12-31`), new Date());

  const getActionBadge = (action: SuggestedTrade['action']) => {
    switch (action) {
      case 'harvest_loss':
        return <Badge className="bg-red-500">Harvest Loss</Badge>;
      case 'realize_gain':
        return <Badge className="bg-green-500">Realize Gain</Badge>;
      case 'wait_long_term':
        return <Badge className="bg-amber-500">Wait</Badge>;
      default:
        return <Badge variant="secondary">Hold</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with countdown */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Year-End Tax Planning</h2>
          <p className="text-muted-foreground">Optimize your December trades for tax efficiency</p>
        </div>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Days Until Year End</p>
                <p className="text-xl font-bold">{Math.max(0, daysUntilYearEnd)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Tax Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Estimated Ordinary Income</Label>
              <Input
                type="number"
                value={ordinaryIncome}
                onChange={(e) => setOrdinaryIncome(e.target.value)}
                placeholder="75000"
              />
            </div>
            <div className="space-y-2">
              <Label>Filing Status</Label>
              <Select value={filingStatus} onValueChange={(v) => setFilingStatus(v as 'single' | 'married')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married Filing Jointly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Tax (Optional)</Label>
              <Input
                type="number"
                value={targetTax}
                onChange={(e) => setTargetTax(e.target.value)}
                placeholder="Leave blank for optimization"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YTD Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">YTD Short-Term</p>
                <p className={`text-2xl font-bold ${ytdRealizedGains.shortTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${ytdRealizedGains.shortTerm.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">YTD Long-Term</p>
                <p className={`text-2xl font-bold ${ytdRealizedGains.longTerm >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                  ${ytdRealizedGains.longTerm.toLocaleString()}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projected Tax</p>
                <p className="text-2xl font-bold text-amber-600">
                  ${projectedTax.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Effective Rate</p>
                <p className="text-2xl font-bold text-purple-600">
                  {projectedTax.effectiveTaxRate.toFixed(1)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wash Sale Warning */}
      {totalDisallowedLoss > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle>Wash Sales Detected</AlertTitle>
          <AlertDescription>
            ${totalDisallowedLoss.toLocaleString()} in losses have been disallowed due to wash sale rules. 
            Wait 31+ days before repurchasing sold positions to avoid wash sales.
          </AlertDescription>
        </Alert>
      )}

      {/* Trade Suggestions */}
      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList>
          <TabsTrigger value="suggestions">
            <Lightbulb className="w-4 h-4 mr-1" />
            December Trades ({suggestedTrades.length})
          </TabsTrigger>
          <TabsTrigger value="positions">
            All Positions ({unrealizedPositions.length})
          </TabsTrigger>
          <TabsTrigger value="projections">
            Tax Projections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Suggested December Trades
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestedTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No specific trade recommendations at this time.</p>
                  <p className="text-sm mt-2">Your portfolio is well-positioned for year-end.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>Gain/Loss</TableHead>
                      <TableHead>Tax Impact</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestedTrades.slice(0, 10).map((suggestion, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-bold">{suggestion.lot.symbol}</TableCell>
                        <TableCell>{getActionBadge(suggestion.action)}</TableCell>
                        <TableCell>
                          ${(suggestion.currentPrice * suggestion.lot.shares).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className={suggestion.gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {suggestion.gainLoss >= 0 ? '+' : ''}${suggestion.gainLoss.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={suggestion.taxImpact >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {suggestion.taxImpact >= 0 ? '+' : ''}${suggestion.taxImpact.toFixed(0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {suggestion.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Cost Basis</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Unrealized G/L</TableHead>
                    <TableHead>Days Held</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unrealizedPositions.map((pos, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-bold">{pos.symbol}</TableCell>
                      <TableCell>{pos.shares}</TableCell>
                      <TableCell>${pos.cost_basis.toFixed(2)}</TableCell>
                      <TableCell>${pos.currentPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={pos.gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                          {pos.gainLoss >= 0 ? '+' : ''}${pos.gainLoss.toFixed(2)}
                          <span className="text-xs ml-1">({pos.gainLossPercent.toFixed(1)}%)</span>
                        </span>
                      </TableCell>
                      <TableCell>{pos.daysHeld} days</TableCell>
                      <TableCell>
                        {pos.isLongTerm ? (
                          <Badge className="bg-green-500">Long-Term</Badge>
                        ) : (
                          <Badge variant="secondary">
                            {pos.daysToLongTerm}d to LT
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projections" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Ordinary Income Tax</span>
                    <span className="font-bold">${projectedTax.ordinaryTax.toLocaleString()}</span>
                  </div>
                  <Progress value={(projectedTax.ordinaryTax / projectedTax.totalTax) * 100 || 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Long-Term Capital Gains Tax</span>
                    <span className="font-bold">${projectedTax.ltTax.toLocaleString()}</span>
                  </div>
                  <Progress value={(projectedTax.ltTax / projectedTax.totalTax) * 100 || 0} className="h-2 bg-blue-100" />
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Total Estimated Tax</span>
                    <span className="font-bold">${projectedTax.totalTax.toLocaleString()}</span>
                  </div>
                </div>
                {projectedTax.carryoverLoss > 0 && (
                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <AlertDescription>
                      ${projectedTax.carryoverLoss.toLocaleString()} in losses will carry over to next year 
                      (exceeds $3,000 annual limit)
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax Saving Opportunities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {unrealizedPositions.filter(p => p.gainLoss < 0).length > 0 && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      <span className="font-semibold">Harvestable Losses</span>
                    </div>
                    <p className="text-2xl font-bold text-red-500">
                      ${Math.abs(unrealizedPositions.filter(p => p.gainLoss < 0).reduce((s, p) => s + p.gainLoss, 0)).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Available to offset gains or deduct up to $3,000
                    </p>
                  </div>
                )}

                {unrealizedPositions.filter(p => p.daysToLongTerm > 0 && p.daysToLongTerm <= 45 && p.gainLoss > 0).length > 0 && (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold">Near Long-Term Status</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {unrealizedPositions.filter(p => p.daysToLongTerm > 0 && p.daysToLongTerm <= 45 && p.gainLoss > 0).length} position(s) 
                      will qualify for long-term rates within 45 days
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">Tax-Loss Harvesting Tip</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Wait 31 days before repurchasing sold securities to avoid wash sale rules.
                    Consider similar (but not "substantially identical") ETFs as placeholders.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
