import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { Calculator, TrendingUp, DollarSign, Repeat } from 'lucide-react';

const DividendCompoundCalculator: React.FC = () => {
  const [initialInvestment, setInitialInvestment] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [dividendYield, setDividendYield] = useState(3.5);
  const [dividendGrowthRate, setDividendGrowthRate] = useState(7);
  const [priceAppreciation, setPriceAppreciation] = useState(6);
  const [years, setYears] = useState(20);
  const [reinvestDividends, setReinvestDividends] = useState(true);

  const projection = useMemo(() => {
    const data: { year: number; portfolioValue: number; totalDividends: number; annualDividend: number; contributions: number; totalInvested: number }[] = [];

    let portfolioValue = initialInvestment;
    let totalDividends = 0;
    let currentYield = dividendYield / 100;
    let totalInvested = initialInvestment;

    for (let y = 1; y <= years; y++) {
      // Monthly contributions
      const yearContrib = monthlyContribution * 12;
      totalInvested += yearContrib;

      // Dividends for the year (on average balance)
      const avgBalance = portfolioValue + yearContrib / 2;
      const annualDividend = avgBalance * currentYield;
      totalDividends += annualDividend;

      // Growth
      portfolioValue += yearContrib;
      if (reinvestDividends) {
        portfolioValue += annualDividend;
      }
      portfolioValue *= (1 + priceAppreciation / 100);

      // Dividend growth for next year
      currentYield *= (1 + dividendGrowthRate / 100);

      data.push({
        year: y,
        portfolioValue: Math.round(portfolioValue),
        totalDividends: Math.round(totalDividends),
        annualDividend: Math.round(annualDividend),
        contributions: Math.round(totalInvested),
        totalInvested: Math.round(totalInvested),
      });
    }

    return data;
  }, [initialInvestment, monthlyContribution, dividendYield, dividendGrowthRate, priceAppreciation, years, reinvestDividends]);

  const final = projection[projection.length - 1] || { portfolioValue: 0, totalDividends: 0, annualDividend: 0, totalInvested: 0 };
  const totalReturn = final.totalInvested > 0 ? ((final.portfolioValue + (reinvestDividends ? 0 : final.totalDividends) - final.totalInvested) / final.totalInvested) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Dividend Compound Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inputs */}
            <div className="space-y-5">
              <div>
                <Label className="text-xs">Initial Investment</Label>
                <Input type="number" value={initialInvestment} onChange={e => setInitialInvestment(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Monthly Contribution: ${monthlyContribution}</Label>
                <Slider value={[monthlyContribution]} onValueChange={([v]) => setMonthlyContribution(v)} min={0} max={5000} step={50} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Dividend Yield: {dividendYield}%</Label>
                <Slider value={[dividendYield]} onValueChange={([v]) => setDividendYield(v)} min={0.5} max={12} step={0.1} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Dividend Growth Rate: {dividendGrowthRate}%</Label>
                <Slider value={[dividendGrowthRate]} onValueChange={([v]) => setDividendGrowthRate(v)} min={0} max={20} step={0.5} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Price Appreciation: {priceAppreciation}%</Label>
                <Slider value={[priceAppreciation]} onValueChange={([v]) => setPriceAppreciation(v)} min={0} max={15} step={0.5} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Time Horizon: {years} years</Label>
                <Slider value={[years]} onValueChange={([v]) => setYears(v)} min={1} max={40} step={1} className="mt-2" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setReinvestDividends(!reinvestDividends)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    reinvestDividends ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/50 text-muted-foreground border-border'
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                  {reinvestDividends ? 'DRIP On' : 'DRIP Off'}
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="growth">
                <TabsList className="mb-4">
                  <TabsTrigger value="growth">Portfolio Growth</TabsTrigger>
                  <TabsTrigger value="income">Annual Income</TabsTrigger>
                </TabsList>
                <TabsContent value="growth">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={projection}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `Y${v}`} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, '']} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                      <Area type="monotone" dataKey="totalInvested" stackId="1" fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" name="Invested" />
                      <Area type="monotone" dataKey="portfolioValue" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" name="Portfolio Value" />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>
                <TabsContent value="income">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={projection}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `Y${v}`} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Annual Dividend']} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                      <Bar dataKey="annualDividend" fill="hsl(160, 70%, 45%)" radius={[4, 4, 0, 0]} name="Annual Dividend" />
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Results Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <div className="p-3 bg-muted/30 rounded-xl text-center">
              <div className="text-xs text-muted-foreground">Final Portfolio</div>
              <div className="text-xl font-bold text-foreground">${final.portfolioValue.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-center">
              <div className="text-xs text-muted-foreground">Total Dividends Earned</div>
              <div className="text-xl font-bold text-emerald-500">${final.totalDividends.toLocaleString()}</div>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-center">
              <div className="text-xs text-muted-foreground">Final Year Income</div>
              <div className="text-xl font-bold text-primary">${final.annualDividend.toLocaleString()}/yr</div>
              <div className="text-[10px] text-muted-foreground">${Math.round(final.annualDividend / 12).toLocaleString()}/month</div>
            </div>
            <div className="p-3 bg-muted/30 rounded-xl text-center">
              <div className="text-xs text-muted-foreground">Total Return</div>
              <div className="text-xl font-bold text-foreground">{totalReturn.toFixed(0)}%</div>
              <div className="text-[10px] text-muted-foreground">on ${final.totalInvested.toLocaleString()} invested</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DividendCompoundCalculator;
