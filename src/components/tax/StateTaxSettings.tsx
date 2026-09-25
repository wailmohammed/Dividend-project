import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Percent, 
  DollarSign,
  Info,
  CheckCircle2,
  Calculator,
  TrendingUp
} from 'lucide-react';
import { useStateTaxRates } from '@/hooks/useStateTaxRates';

interface StateTaxSettingsProps {
  shortTermGains?: number;
  longTermGains?: number;
  dividendIncome?: number;
  qualifiedDividends?: number;
}

export const StateTaxSettings: React.FC<StateTaxSettingsProps> = ({
  shortTermGains = 0,
  longTermGains = 0,
  dividendIncome = 0,
  qualifiedDividends = 0
}) => {
  const { 
    states, 
    loading, 
    setUserState, 
    setCustomRate,
    getCurrentState,
    calculateStateTax,
    calculateDividendTax,
    setFederalRate,
    setDividendRate,
    setQualifiedDividendRate,
    userStateCode,
    userStateTaxRate,
    federalTaxRate,
    dividendTaxRate,
    qualifiedDividendRate: savedQualifiedRate
  } = useStateTaxRates();

  const [useCustomRate, setUseCustomRateToggle] = useState(false);
  const [customRateInput, setCustomRateInput] = useState(String(userStateTaxRate || 0));
  const [federalInput, setFederalInput] = useState(String(federalTaxRate || 22));
  const [dividendInput, setDividendInput] = useState(String(dividendTaxRate || 22));
  const [qualifiedInput, setQualifiedInput] = useState(String(savedQualifiedRate || 15));

  useEffect(() => {
    setFederalInput(String(federalTaxRate || 22));
    setDividendInput(String(dividendTaxRate || 22));
    setQualifiedInput(String(savedQualifiedRate || 15));
  }, [federalTaxRate, dividendTaxRate, savedQualifiedRate]);

  const currentState = getCurrentState();
  const stateTax = calculateStateTax(shortTermGains, longTermGains);
  const dividendTax = calculateDividendTax(dividendIncome, qualifiedDividends);

  const handleStateChange = async (stateCode: string) => {
    await setUserState(stateCode);
    setUseCustomRateToggle(false);
  };

  const handleCustomRateSubmit = async () => {
    const rate = parseFloat(customRateInput);
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      await setCustomRate(userStateCode || 'CUSTOM', rate);
    }
  };

  const handleFederalRateSave = async () => {
    const rate = parseFloat(federalInput);
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      await setFederalRate(rate);
    }
  };

  const handleDividendRateSave = async () => {
    const rate = parseFloat(dividendInput);
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      await setDividendRate(rate);
    }
  };

  const handleQualifiedRateSave = async () => {
    const rate = parseFloat(qualifiedInput);
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      await setQualifiedDividendRate(rate);
    }
  };

  const noTaxStates = states.filter(s => s.income_tax_rate === 0);
  const taxStates = states.filter(s => s.income_tax_rate > 0);

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rates">
            <Percent className="w-4 h-4 mr-1" /> Tax Rates
          </TabsTrigger>
          <TabsTrigger value="capital-gains">
            <TrendingUp className="w-4 h-4 mr-1" /> Capital Gains
          </TabsTrigger>
          <TabsTrigger value="dividends">
            <DollarSign className="w-4 h-4 mr-1" /> Dividend Tax
          </TabsTrigger>
        </TabsList>

        {/* TAX RATES CONFIGURATION TAB */}
        <TabsContent value="rates" className="space-y-4 mt-4">
          {/* Federal Tax Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="w-5 h-5" />
                Federal Tax Rates
              </CardTitle>
              <CardDescription>
                Set your federal tax bracket for accurate capital gains and dividend tax estimates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Federal Income Tax Rate (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={federalInput}
                      onChange={(e) => setFederalInput(e.target.value)}
                      placeholder="22"
                    />
                    <Button size="sm" onClick={handleFederalRateSave}>Save</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[10, 12, 22, 24, 32, 35, 37].map(r => (
                      <Button
                        key={r}
                        size="sm"
                        variant={parseFloat(federalInput) === r ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        onClick={() => { setFederalInput(String(r)); setFederalRate(r); }}
                      >
                        {r}%
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Used for short-term capital gains</p>
                </div>
                <div className="space-y-2">
                  <Label>Ordinary Dividend Tax Rate (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={dividendInput}
                      onChange={(e) => setDividendInput(e.target.value)}
                      placeholder="22"
                    />
                    <Button size="sm" onClick={handleDividendRateSave}>Save</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[10, 12, 15, 22, 24, 25, 30, 35, 37].map(r => (
                      <Button
                        key={r}
                        size="sm"
                        variant={parseFloat(dividendInput) === r ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        onClick={() => { setDividendInput(String(r)); setDividendRate(r); }}
                      >
                        {r}%
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">For non-qualified dividends</p>
                </div>
                <div className="space-y-2">
                  <Label>Qualified Dividend Rate (%)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={qualifiedInput}
                      onChange={(e) => setQualifiedInput(e.target.value)}
                      placeholder="15"
                    />
                    <Button size="sm" onClick={handleQualifiedRateSave}>Save</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 15, 20].map(r => (
                      <Button
                        key={r}
                        size="sm"
                        variant={parseFloat(qualifiedInput) === r ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        onClick={() => { setQualifiedInput(String(r)); setQualifiedDividendRate(r); }}
                      >
                        {r}%
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">0%, 15%, or 20% based on income</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">2024 Federal Tax Brackets Reference:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>10% – Up to $11,600</span>
                  <span>12% – $11,601-$47,150</span>
                  <span>22% – $47,151-$100,525</span>
                  <span>24% – $100,526-$191,950</span>
                  <span>32% – $191,951-$243,725</span>
                  <span>35% – $243,726-$609,350</span>
                  <span>37% – Over $609,350</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* State Tax Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-5 h-5" />
                State Tax Configuration
              </CardTitle>
              <CardDescription>
                Select your state for accurate tax estimates. Some states have no income tax or special capital gains rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Your State</Label>
                <Select value={userStateCode || ''} onValueChange={handleStateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a state..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      No State Income Tax
                    </div>
                    {noTaxStates.map(state => (
                      <SelectItem key={state.state_code} value={state.state_code}>
                        <div className="flex items-center gap-2">
                          <span>{state.state_name}</span>
                          <Badge variant="secondary" className="text-xs">No Tax</Badge>
                        </div>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                      States with Income Tax
                    </div>
                    {taxStates.map(state => (
                      <SelectItem key={state.state_code} value={state.state_code}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{state.state_name}</span>
                          <span className="text-muted-foreground text-sm">{state.income_tax_rate}%</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentState && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{currentState.state_name}</span>
                    <Badge variant="outline">{currentState.state_code}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Income Tax Rate:</span>
                      <span className="ml-2 font-medium">{currentState.income_tax_rate}%</span>
                    </div>
                    {currentState.has_separate_cg_rate && currentState.capital_gains_rate !== null && (
                      <div>
                        <span className="text-muted-foreground">Capital Gains Rate:</span>
                        <span className="ml-2 font-medium">{currentState.capital_gains_rate}%</span>
                      </div>
                    )}
                  </div>
                  {currentState.notes && (
                    <p className="text-xs text-muted-foreground">{currentState.notes}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>Use Custom Rate</Label>
                  <p className="text-sm text-muted-foreground">Override with your actual marginal rate</p>
                </div>
                <Switch checked={useCustomRate} onCheckedChange={setUseCustomRateToggle} />
              </div>

              {useCustomRate && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={customRateInput}
                      onChange={(e) => setCustomRateInput(e.target.value)}
                      placeholder="Enter rate %"
                    />
                  </div>
                  <Button onClick={handleCustomRateSubmit}>Save Rate</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPITAL GAINS TAB */}
        <TabsContent value="capital-gains" className="space-y-4 mt-4">
          {(shortTermGains !== 0 || longTermGains !== 0) ? (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4" />
                  Estimated Capital Gains Tax
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Short-Term Gains</p>
                    <p className="text-xl font-bold">${shortTermGains.toLocaleString()}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Federal ({federalTaxRate || 22}%)</span>
                        <span>${(shortTermGains * ((federalTaxRate || 22) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">State ({stateTax.effectiveRate}%)</span>
                        <span>${stateTax.shortTermTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Long-Term Gains</p>
                    <p className="text-xl font-bold">${longTermGains.toLocaleString()}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Federal ({savedQualifiedRate || 15}%)</span>
                        <span>${(longTermGains * ((savedQualifiedRate || 15) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">State ({stateTax.effectiveRate}%)</span>
                        <span>${stateTax.longTermTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Estimated Tax</span>
                    <span className="text-2xl font-bold text-primary">
                      ${(
                        (shortTermGains * ((federalTaxRate || 22) / 100)) +
                        (longTermGains * ((savedQualifiedRate || 15) / 100)) +
                        stateTax.totalStateTax
                      ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No capital gains data to calculate. Add transactions to see tax estimates.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DIVIDEND TAX TAB */}
        <TabsContent value="dividends" className="space-y-4 mt-4">
          {dividendIncome > 0 ? (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="w-4 h-4" />
                  Estimated Dividend Tax
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Ordinary Dividends</p>
                    <p className="text-xl font-bold">${dividendTax.ordinaryDividends.toLocaleString()}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Federal ({dividendTax.effectiveFederalRate}%)</span>
                        <span>${dividendTax.ordinaryFederalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-xs text-muted-foreground mb-1">Qualified Dividends</p>
                    <p className="text-xl font-bold">${dividendTax.qualifiedDividends.toLocaleString()}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Federal ({dividendTax.effectiveQualifiedRate}%)</span>
                        <span>${dividendTax.qualifiedFederalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-muted-foreground mb-1">State Tax ({dividendTax.effectiveStateRate}%)</p>
                    <p className="text-lg font-bold">${dividendTax.stateTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-1">Total Dividend Tax</p>
                    <p className="text-lg font-bold text-destructive">${dividendTax.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Net After Tax</p>
                    <p className="text-lg font-bold text-primary">${dividendTax.netAfterTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No dividend income data. Your dividend tax will auto-calculate based on your holdings.</p>
              </CardContent>
            </Card>
          )}

          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              Qualified dividends (held 60+ days) are taxed at lower capital gains rates (0%, 15%, or 20%).
              Ordinary dividends are taxed at your regular income tax rate. Set your rates in the Tax Rates tab.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {currentState && currentState.income_tax_rate === 0 && (
        <Alert>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <AlertDescription>
            <strong>{currentState.state_name}</strong> has no state income tax on capital gains or dividends.
            You only need to pay federal taxes on your investment gains.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          Tax rates shown are approximate for 2024. Your actual rate may vary 
          based on total income and filing status. Consult a tax professional for accurate calculations.
        </AlertDescription>
      </Alert>
    </div>
  );
};
