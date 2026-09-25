import React, { useState, useMemo } from 'react';
import { useTaxLots } from '@/hooks/useTaxLots';
import { usePortfolio } from '@/context/PortfolioContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useStateTaxRates } from '@/hooks/useStateTaxRates';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  Plus,
  Trash2,
  DollarSign,
  PiggyBank,
  AlertTriangle,
  Info
} from 'lucide-react';

interface ProjectedTrade {
  id: string;
  symbol: string;
  gainLoss: number;
  isShortTerm: boolean;
}

// 2024 Federal tax brackets for single filers
const FEDERAL_BRACKETS_SINGLE = [
  { min: 0, max: 11600, rate: 0.10 },
  { min: 11600, max: 47150, rate: 0.12 },
  { min: 47150, max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 }
];

const FEDERAL_BRACKETS_MARRIED = [
  { min: 0, max: 23200, rate: 0.10 },
  { min: 23200, max: 94300, rate: 0.12 },
  { min: 94300, max: 201050, rate: 0.22 },
  { min: 201050, max: 383900, rate: 0.24 },
  { min: 383900, max: 487450, rate: 0.32 },
  { min: 487450, max: 731200, rate: 0.35 },
  { min: 731200, max: Infinity, rate: 0.37 }
];

// Long-term capital gains brackets
const LTCG_BRACKETS_SINGLE = [
  { min: 0, max: 47025, rate: 0 },
  { min: 47025, max: 518900, rate: 0.15 },
  { min: 518900, max: Infinity, rate: 0.20 }
];

const LTCG_BRACKETS_MARRIED = [
  { min: 0, max: 94050, rate: 0 },
  { min: 94050, max: 583750, rate: 0.15 },
  { min: 583750, max: Infinity, rate: 0.20 }
];

type FilingStatus = 'single' | 'married_filing_jointly';

export const TaxProjectionCalculator: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { taxLots } = useTaxLots(activePortfolio?.id);
  const { settings } = useUserSettings();
  const { calculateStateTax } = useStateTaxRates();

  const currentYear = new Date().getFullYear();
  const [ordinaryIncome, setOrdinaryIncome] = useState('100000');
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [projectedTrades, setProjectedTrades] = useState<ProjectedTrade[]>([]);
  const [newTrade, setNewTrade] = useState({ symbol: '', gainLoss: '', isShortTerm: true });

  // Calculate YTD realized gains from closed lots
  const ytdGains = useMemo(() => {
    const closedLots = taxLots.filter(lot => {
      if (!lot.is_closed || !lot.sale_date) return false;
      const saleYear = new Date(lot.sale_date).getFullYear();
      return saleYear === currentYear;
    });

    let shortTermGains = 0;
    let longTermGains = 0;

    closedLots.forEach(lot => {
      const purchaseDate = new Date(lot.purchase_date);
      const saleDate = new Date(lot.sale_date!);
      const holdingDays = (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      const isLongTerm = holdingDays >= 365;
      const gainLoss = lot.realized_gain_loss || 0;

      if (isLongTerm) {
        longTermGains += gainLoss;
      } else {
        shortTermGains += gainLoss;
      }
    });

    return { shortTermGains, longTermGains, total: shortTermGains + longTermGains };
  }, [taxLots, currentYear]);

  // Add projected trade
  const handleAddTrade = () => {
    if (!newTrade.symbol || !newTrade.gainLoss) return;
    
    setProjectedTrades([...projectedTrades, {
      id: crypto.randomUUID(),
      symbol: newTrade.symbol.toUpperCase(),
      gainLoss: parseFloat(newTrade.gainLoss),
      isShortTerm: newTrade.isShortTerm
    }]);
    setNewTrade({ symbol: '', gainLoss: '', isShortTerm: true });
  };

  const handleRemoveTrade = (id: string) => {
    setProjectedTrades(projectedTrades.filter(t => t.id !== id));
  };

  // Calculate projected gains
  const projectedGains = useMemo(() => {
    let shortTerm = 0;
    let longTerm = 0;
    
    projectedTrades.forEach(trade => {
      if (trade.isShortTerm) {
        shortTerm += trade.gainLoss;
      } else {
        longTerm += trade.gainLoss;
      }
    });

    return { shortTerm, longTerm, total: shortTerm + longTerm };
  }, [projectedTrades]);

  // Calculate total gains (YTD + projected)
  const totalGains = useMemo(() => ({
    shortTerm: ytdGains.shortTermGains + projectedGains.shortTerm,
    longTerm: ytdGains.longTermGains + projectedGains.longTerm,
    total: ytdGains.total + projectedGains.total
  }), [ytdGains, projectedGains]);

  // Calculate federal tax
  const calculateFederalTax = (income: number, shortTermGains: number, longTermGains: number, status: FilingStatus) => {
    const ordinaryBrackets = status === 'single' ? FEDERAL_BRACKETS_SINGLE : FEDERAL_BRACKETS_MARRIED;
    const ltcgBrackets = status === 'single' ? LTCG_BRACKETS_SINGLE : LTCG_BRACKETS_MARRIED;

    // Short-term gains are taxed as ordinary income
    const taxableOrdinaryIncome = income + Math.max(0, shortTermGains);
    
    let ordinaryTax = 0;
    let remainingIncome = taxableOrdinaryIncome;
    
    for (const bracket of ordinaryBrackets) {
      if (remainingIncome <= 0) break;
      const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min);
      ordinaryTax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }

    // Long-term gains taxed at preferential rates
    let ltcgTax = 0;
    let remainingLTCG = Math.max(0, longTermGains);
    const baseIncome = taxableOrdinaryIncome;

    for (const bracket of ltcgBrackets) {
      if (remainingLTCG <= 0) break;
      const bracketStart = Math.max(0, bracket.min - baseIncome);
      const bracketEnd = bracket.max - baseIncome;
      
      if (bracketEnd <= 0) continue;
      
      const taxableInBracket = Math.min(remainingLTCG, bracketEnd - bracketStart);
      if (taxableInBracket > 0) {
        ltcgTax += taxableInBracket * bracket.rate;
        remainingLTCG -= taxableInBracket;
      }
    }

    // Apply loss deduction (up to $3,000 net loss can offset ordinary income)
    const netGains = shortTermGains + longTermGains;
    let lossDeduction = 0;
    if (netGains < 0) {
      lossDeduction = Math.min(Math.abs(netGains), 3000);
    }

    return {
      ordinaryTax,
      ltcgTax,
      lossDeduction,
      totalFederal: Math.max(0, ordinaryTax + ltcgTax)
    };
  };

  // Calculate estimated tax liability
  const taxEstimate = useMemo(() => {
    const income = parseFloat(ordinaryIncome) || 0;
    
    const federal = calculateFederalTax(income, totalGains.shortTerm, totalGains.longTerm, filingStatus);
    
    const stateRate = settings?.state_tax_rate || 0;
    const stateTax = (income + totalGains.shortTerm + totalGains.longTerm) * (stateRate / 100);

    const niit = income > (filingStatus === 'single' ? 200000 : 250000) 
      ? Math.max(0, totalGains.shortTerm + totalGains.longTerm) * 0.038 
      : 0;

    return {
      ...federal,
      stateTax,
      niit,
      totalTax: federal.totalFederal + stateTax + niit,
      effectiveRate: ((federal.totalFederal + stateTax + niit) / (income + totalGains.total)) * 100
    };
  }, [ordinaryIncome, totalGains, filingStatus, settings]);

  // Quarterly payment suggestion
  const quarterlyPayment = useMemo(() => {
    const remaining = taxEstimate.totalTax;
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
    const remainingQuarters = Math.max(1, 4 - currentQuarter + 1);
    return remaining / remainingQuarters;
  }, [taxEstimate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="w-6 h-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Tax Projection Calculator</h3>
          <p className="text-sm text-muted-foreground">
            Estimate your full-year tax liability based on YTD gains and projected trades
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          {/* Income & Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Income & Filing Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="income">Ordinary Income (Wages, etc.)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="income"
                    type="number"
                    className="pl-9"
                    value={ordinaryIncome}
                    onChange={(e) => setOrdinaryIncome(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Filing Status</Label>
                <Select value={filingStatus} onValueChange={(v: FilingStatus) => setFilingStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married_filing_jointly">Married Filing Jointly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* YTD Gains Summary */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                YTD Realized Gains ({currentYear})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Short-Term</p>
                  <p className={`font-semibold ${ytdGains.shortTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {ytdGains.shortTermGains >= 0 ? '+' : ''}${ytdGains.shortTermGains.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Long-Term</p>
                  <p className={`font-semibold ${ytdGains.longTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {ytdGains.longTermGains >= 0 ? '+' : ''}${ytdGains.longTermGains.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projected Trades */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Projected Trades</CardTitle>
              <CardDescription>Add expected trades for the rest of the year</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-12 gap-2">
                <Input
                  placeholder="Symbol"
                  className="col-span-3"
                  value={newTrade.symbol}
                  onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value.toUpperCase() })}
                />
                <div className="col-span-4 relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Gain/Loss"
                    className="pl-9"
                    value={newTrade.gainLoss}
                    onChange={(e) => setNewTrade({ ...newTrade, gainLoss: e.target.value })}
                  />
                </div>
                <Select 
                  value={newTrade.isShortTerm ? 'short' : 'long'} 
                  onValueChange={(v) => setNewTrade({ ...newTrade, isShortTerm: v === 'short' })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" className="col-span-2" onClick={handleAddTrade}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {projectedTrades.length > 0 && (
                <div className="space-y-2">
                  {projectedTrades.map(trade => (
                    <div key={trade.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{trade.symbol}</span>
                        <Badge variant="outline" className="text-xs">
                          {trade.isShortTerm ? 'Short' : 'Long'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={trade.gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                          {trade.gainLoss >= 0 ? '+' : ''}${trade.gainLoss.toLocaleString()}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveTrade(trade.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Projected Total</span>
                    <span className={`font-semibold ${projectedGains.total >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {projectedGains.total >= 0 ? '+' : ''}${projectedGains.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {/* Tax Breakdown */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5" />
                Estimated Tax Liability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">Total Estimated Tax</p>
                <p className="text-4xl font-bold text-primary">
                  ${taxEstimate.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Effective Rate: {taxEstimate.effectiveRate.toFixed(1)}%
                </p>
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Federal (Ordinary Income)</span>
                  <span>${taxEstimate.ordinaryTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Federal (Long-Term CG)</span>
                  <span>${taxEstimate.ltcgTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                {taxEstimate.stateTax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State Tax</span>
                    <span>${taxEstimate.stateTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                )}
                {taxEstimate.niit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Investment Income Tax (3.8%)</span>
                    <span>${taxEstimate.niit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                )}
                {taxEstimate.lossDeduction > 0 && (
                  <div className="flex justify-between text-emerald-500">
                    <span>Loss Deduction (up to $3,000)</span>
                    <span>-${taxEstimate.lossDeduction.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quarterly Payment Suggestion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Quarterly Payment Suggestion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${quarterlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-sm text-muted-foreground">per remaining quarter to avoid underpayment penalties</p>
            </CardContent>
          </Card>

          {/* Gains Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Full-Year Capital Gains Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Short-Term Gains</span>
                    <span className={totalGains.shortTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {totalGains.shortTerm >= 0 ? '+' : ''}${totalGains.shortTerm.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={totalGains.total !== 0 ? Math.abs(totalGains.shortTerm / totalGains.total) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Long-Term Gains</span>
                    <span className={totalGains.longTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {totalGains.longTerm >= 0 ? '+' : ''}${totalGains.longTerm.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={totalGains.total !== 0 ? Math.abs(totalGains.longTerm / totalGains.total) * 100 : 0} 
                    className="h-2" 
                  />
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Net Capital Gains</span>
                  <span className={totalGains.total >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {totalGains.total >= 0 ? '+' : ''}${totalGains.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">This calculator provides estimates based on 2024 tax brackets. Actual liability may vary.</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Short-term gains taxed at ordinary income rates</li>
                    <li>Long-term gains taxed at 0%, 15%, or 20%</li>
                    <li>Net losses can offset up to $3,000 of ordinary income</li>
                    <li>NIIT applies to income over $200K (single) / $250K (married)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
