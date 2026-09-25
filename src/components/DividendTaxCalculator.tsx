import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Calculator, Save, Percent, TrendingDown, DollarSign, Info } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface DividendTaxCalculatorProps {
  grossAnnualIncome: number;
  grossMonthlyIncome: number;
  grossQuarterlyIncome: number;
  grossWeeklyIncome: number;
  grossDailyIncome: number;
}

const TAX_PRESETS = [
  { label: 'US 0% (Qualified)', rate: 0 },
  { label: 'US 15% (Qualified)', rate: 15 },
  { label: 'US 20% (Qualified)', rate: 20 },
  { label: 'US 22% (Ordinary)', rate: 22 },
  { label: 'US 24% (Ordinary)', rate: 24 },
  { label: 'US 32% (Ordinary)', rate: 32 },
  { label: 'US 37% (Ordinary)', rate: 37 },
  { label: 'Non-US 30% WHT', rate: 30 },
  { label: 'UK 8.75%', rate: 8.75 },
  { label: 'Canada 15%', rate: 15.31 },
  { label: 'Germany 26.375%', rate: 26.375 },
];

export const DividendTaxCalculator = ({
  grossAnnualIncome,
  grossMonthlyIncome,
  grossQuarterlyIncome,
  grossWeeklyIncome,
  grossDailyIncome,
}: DividendTaxCalculatorProps) => {
  const { settings, updateSettings, loading: settingsLoading } = useUserSettings();
  const [ordinaryRate, setOrdinaryRate] = useState<number>(0);
  const [qualifiedRate, setQualifiedRate] = useState<number>(0);
  const [qualifiedPct, setQualifiedPct] = useState<number>(80); // % of dividends that are qualified
  const [saving, setSaving] = useState(false);

  // Load saved rates from settings
  useEffect(() => {
    if (settings) {
      setOrdinaryRate(settings.dividend_tax_rate || 0);
      setQualifiedRate(settings.qualified_dividend_rate || 0);
    }
  }, [settings]);

  const taxCalc = useMemo(() => {
    const qualifiedFraction = qualifiedPct / 100;
    const ordinaryFraction = 1 - qualifiedFraction;

    const qualifiedIncome = grossAnnualIncome * qualifiedFraction;
    const ordinaryIncome = grossAnnualIncome * ordinaryFraction;

    const qualifiedTax = qualifiedIncome * (qualifiedRate / 100);
    const ordinaryTax = ordinaryIncome * (ordinaryRate / 100);
    const totalTax = qualifiedTax + ordinaryTax;

    const effectiveRate = grossAnnualIncome > 0 ? (totalTax / grossAnnualIncome) * 100 : 0;
    const netAnnual = grossAnnualIncome - totalTax;

    return {
      qualifiedIncome,
      ordinaryIncome,
      qualifiedTax,
      ordinaryTax,
      totalTax,
      effectiveRate,
      netAnnual,
      netMonthly: netAnnual / 12,
      netQuarterly: netAnnual / 4,
      netWeekly: netAnnual / 52,
      netDaily: netAnnual / 365,
    };
  }, [grossAnnualIncome, ordinaryRate, qualifiedRate, qualifiedPct]);

  const handleSaveRates = async () => {
    setSaving(true);
    try {
      await updateSettings({
        dividend_tax_rate: ordinaryRate,
        qualified_dividend_rate: qualifiedRate,
      });
      toast.success('Dividend tax rates saved');
    } catch {
      toast.error('Failed to save tax rates');
    } finally {
      setSaving(false);
    }
  };

  const handlePreset = (rate: string) => {
    const parsed = parseFloat(rate);
    if (!isNaN(parsed)) {
      setOrdinaryRate(parsed);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Dividend Tax Calculator
            </CardTitle>
            <CardDescription>Configure your tax rates to see after-tax dividend income</CardDescription>
          </div>
          <Button size="sm" onClick={handleSaveRates} disabled={saving || settingsLoading}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Saving...' : 'Save Rates'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tax Rate Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ordinary Dividend Tax Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Ordinary Dividend Tax Rate
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Tax rate applied to non-qualified (ordinary) dividends. This is typically your marginal income tax rate.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={ordinaryRate}
                onChange={(e) => setOrdinaryRate(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Percent className="w-4 h-4 text-muted-foreground" />
            </div>
            <Select onValueChange={handlePreset}>
              <SelectTrigger className="w-full text-xs h-8">
                <SelectValue placeholder="Quick preset..." />
              </SelectTrigger>
              <SelectContent>
                {TAX_PRESETS.map((p) => (
                  <SelectItem key={p.label} value={p.rate.toString()}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Qualified Dividend Tax Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              Qualified Dividend Tax Rate
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Preferential tax rate for qualified dividends (typically 0%, 15%, or 20% in the US).</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={qualifiedRate}
                onChange={(e) => setQualifiedRate(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Percent className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Qualified Dividend Percentage */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              % Qualified Dividends
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Estimated percentage of your total dividends that qualify for the lower tax rate. US stocks held 60+ days typically qualify.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={qualifiedPct}
                onChange={(e) => setQualifiedPct(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <Percent className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <Separator />

        {/* After-Tax Results */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            After-Tax Income Breakdown
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Daily (Net)</p>
              <p className="text-lg font-bold text-foreground">${fmt(taxCalc.netDaily)}</p>
              <p className="text-xs text-muted-foreground line-through">${fmt(grossDailyIncome)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Weekly (Net)</p>
              <p className="text-lg font-bold text-foreground">${fmt(taxCalc.netWeekly)}</p>
              <p className="text-xs text-muted-foreground line-through">${fmt(grossWeeklyIncome)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Monthly (Net)</p>
              <p className="text-lg font-bold text-foreground">${fmt(taxCalc.netMonthly)}</p>
              <p className="text-xs text-muted-foreground line-through">${fmt(grossMonthlyIncome)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Quarterly (Net)</p>
              <p className="text-lg font-bold text-foreground">${fmt(taxCalc.netQuarterly)}</p>
              <p className="text-xs text-muted-foreground line-through">${fmt(grossQuarterlyIncome)}</p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Annual (Net)</p>
              <p className="text-lg font-bold text-primary">${fmt(taxCalc.netAnnual)}</p>
              <p className="text-xs text-muted-foreground line-through">${fmt(grossAnnualIncome)}</p>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Total Tax</p>
              <p className="text-lg font-bold text-destructive">-${fmt(taxCalc.totalTax)}</p>
              <Badge variant="outline" className="text-xs mt-1">
                {taxCalc.effectiveRate.toFixed(1)}% eff.
              </Badge>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/20 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Qualified Dividends
            </h4>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Income ({qualifiedPct}%)</span>
              <span className="font-medium">${fmt(taxCalc.qualifiedIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax @ {qualifiedRate}%</span>
              <span className="font-medium text-destructive">-${fmt(taxCalc.qualifiedTax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-bold">
              <span>Net Income</span>
              <span className="text-primary">${fmt(taxCalc.qualifiedIncome - taxCalc.qualifiedTax)}</span>
            </div>
          </div>
          <div className="bg-muted/20 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-500" />
              Ordinary Dividends
            </h4>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Income ({(100 - qualifiedPct).toFixed(0)}%)</span>
              <span className="font-medium">${fmt(taxCalc.ordinaryIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax @ {ordinaryRate}%</span>
              <span className="font-medium text-destructive">-${fmt(taxCalc.ordinaryTax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-bold">
              <span>Net Income</span>
              <span className="text-primary">${fmt(taxCalc.ordinaryIncome - taxCalc.ordinaryTax)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
