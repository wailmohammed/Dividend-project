import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { Flame, Target, TrendingUp, Calendar, DollarSign, Percent, PiggyBank } from 'lucide-react';

const RetirementPlanner: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const currentPortfolioValue = Number(activePortfolio?.totalValue) || 0;

  const [currentAge, setCurrentAge] = useState(30);
  const [retireAge, setRetireAge] = useState(55);
  const [monthlyContribution, setMonthlyContribution] = useState(2000);
  const [expectedReturn, setExpectedReturn] = useState(8);
  const [inflationRate, setInflationRate] = useState(3);
  const [annualExpenses, setAnnualExpenses] = useState(60000);
  const [withdrawalRate, setWithdrawalRate] = useState(4);

  const fireNumber = useMemo(() => annualExpenses / (withdrawalRate / 100), [annualExpenses, withdrawalRate]);

  const projectionData = useMemo(() => {
    const data = [];
    const years = 80 - currentAge;
    let balance = currentPortfolioValue;
    const realReturn = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1;
    const annualContribution = monthlyContribution * 12;

    for (let i = 0; i <= years; i++) {
      const age = currentAge + i;
      const isRetired = age >= retireAge;

      if (!isRetired) {
        balance = balance * (1 + realReturn) + annualContribution;
      } else {
        balance = balance * (1 + realReturn) - annualExpenses;
      }

      data.push({
        age,
        balance: Math.max(0, Math.round(balance)),
        fireTarget: Math.round(fireNumber),
        phase: isRetired ? 'Retirement' : 'Accumulation',
      });

      if (balance <= 0 && isRetired) break;
    }
    return data;
  }, [currentAge, retireAge, monthlyContribution, expectedReturn, inflationRate, annualExpenses, currentPortfolioValue, fireNumber, withdrawalRate]);

  const yearsToFire = useMemo(() => {
    const realReturn = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1;
    let balance = currentPortfolioValue;
    const annualContribution = monthlyContribution * 12;
    let years = 0;
    while (balance < fireNumber && years < 100) {
      balance = balance * (1 + realReturn) + annualContribution;
      years++;
    }
    return years >= 100 ? null : years;
  }, [currentPortfolioValue, monthlyContribution, expectedReturn, inflationRate, fireNumber]);

  const progress = Math.min(100, (currentPortfolioValue / fireNumber) * 100);
  const retirementBalance = projectionData.find(d => d.age === retireAge)?.balance || 0;
  const runOutAge = projectionData.find(d => d.balance <= 0 && d.age > retireAge)?.age;
  const coastFireNumber = fireNumber / Math.pow(1 + (expectedReturn - inflationRate) / 100, retireAge - currentAge);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" /> Retirement / FIRE Planner
        </h2>
        <p className="text-muted-foreground">Plan your path to financial independence with real-time projections</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">${(fireNumber / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">FIRE Number</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-2xl font-bold text-foreground">{progress.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold text-foreground">{yearsToFire !== null ? `${yearsToFire}y` : '∞'}</div>
            <div className="text-xs text-muted-foreground">Years to FIRE</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <PiggyBank className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <div className="text-2xl font-bold text-foreground">${(coastFireNumber / 1000).toFixed(0)}K</div>
            <div className="text-xs text-muted-foreground">Coast FIRE</div>
          </CardContent>
        </Card>
      </div>

      {/* FIRE Progress Bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Current: <span className="font-bold text-foreground">${currentPortfolioValue.toLocaleString()}</span></span>
            <span className="text-muted-foreground">FIRE: <span className="font-bold text-foreground">${fireNumber.toLocaleString()}</span></span>
          </div>
          <div className="h-4 bg-muted rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-1000"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
            {progress < 100 && (
              <div className="absolute right-2 top-0 h-full flex items-center">
                <span className="text-[10px] font-bold text-muted-foreground">{(100 - progress).toFixed(0)}% to go</span>
              </div>
            )}
          </div>
          {runOutAge && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
              <span>⚠️ Funds run out at age {runOutAge}. Consider reducing expenses or increasing savings.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projection Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Wealth Trajectory</CardTitle>
            <CardDescription>Real returns adjusted for {inflationRate}% inflation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="age" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--popover-foreground))' }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
                    labelFormatter={l => `Age ${l}`}
                  />
                  <ReferenceLine x={retireAge} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Retire', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <ReferenceLine y={fireNumber} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: 'FIRE Target', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill="url(#fireGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-xs">Current Age: <span className="font-bold">{currentAge}</span></Label>
              <Slider value={[currentAge]} onValueChange={v => setCurrentAge(v[0])} min={18} max={65} step={1} className="mt-2" />
            </div>
            <div>
              <Label className="text-xs">Retirement Age: <span className="font-bold">{retireAge}</span></Label>
              <Slider value={[retireAge]} onValueChange={v => setRetireAge(v[0])} min={30} max={75} step={1} className="mt-2" />
            </div>
            <div>
              <Label className="text-xs">Monthly Contribution</Label>
              <Input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Annual Expenses</Label>
              <Input type="number" value={annualExpenses} onChange={e => setAnnualExpenses(Number(e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Expected Return: <span className="font-bold">{expectedReturn}%</span></Label>
              <Slider value={[expectedReturn]} onValueChange={v => setExpectedReturn(v[0])} min={1} max={15} step={0.5} className="mt-2" />
            </div>
            <div>
              <Label className="text-xs">Withdrawal Rate: <span className="font-bold">{withdrawalRate}%</span></Label>
              <Slider value={[withdrawalRate]} onValueChange={v => setWithdrawalRate(v[0])} min={2} max={6} step={0.25} className="mt-2" />
            </div>

            <div className="pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>At retirement:</span> <span className="font-bold text-foreground">${retirementBalance.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Monthly income:</span> <span className="font-bold text-foreground">${Math.round(retirementBalance * withdrawalRate / 100 / 12).toLocaleString()}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RetirementPlanner;
