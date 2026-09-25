import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine, LineChart, Line } from 'recharts';
import { RefreshCw, GitCompareArrows } from 'lucide-react';
import { Holding } from '@/types';
import { DripTransaction } from '@/hooks/useDripTransactions';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

interface DRIPImpactChartProps {
  holdings: Holding[];
  dripTransactions: DripTransaction[];
}

interface ProjectionPoint {
  year: number;
  withDrip: number;
  withoutDrip: number;
  dripGain: number;
  // Comparison scenario fields
  scenarioA?: number;
  scenarioB?: number;
  scenarioC?: number;
}

type TimeHorizon = '5' | '10' | '20' | '30';

const TIME_HORIZONS: { value: TimeHorizon; label: string }[] = [
  { value: '5', label: '5yr' },
  { value: '10', label: '10yr' },
  { value: '20', label: '20yr' },
  { value: '30', label: '30yr' },
];

interface Scenario {
  label: string;
  yield: number;
  growth: number;
  color: string;
}

const DEFAULT_SCENARIOS: Scenario[] = [
  { label: 'Conservative', yield: 1.5, growth: 3, color: 'hsl(199 89% 48%)' },
  { label: 'Moderate', yield: 3, growth: 5, color: 'hsl(142 71% 45%)' },
  { label: 'Aggressive', yield: 5, growth: 8, color: 'hsl(38 92% 50%)' },
];

function runProjection(
  totalValue: number,
  totalShares: number,
  avgYield: number,
  avgPriceGrowth: number,
  avgDivGrowth: number,
  years: number,
): ProjectionPoint[] {
  const data: ProjectionPoint[] = [];
  let withDripValue = totalValue;
  let withDripShares = totalShares;
  let withoutDripValue = totalValue;
  let currentYield = avgYield;
  let sharePrice = totalShares > 0 ? totalValue / totalShares : 0;

  for (let year = 0; year <= years; year++) {
    data.push({
      year,
      withDrip: Math.round(withDripValue),
      withoutDrip: Math.round(withoutDripValue),
      dripGain: Math.round(withDripValue - withoutDripValue),
    });

    if (year < years) {
      const dividends = withDripValue * currentYield;
      sharePrice *= (1 + avgPriceGrowth);
      const newDripShares = sharePrice > 0 ? dividends / sharePrice : 0;
      withDripShares += newDripShares;
      withDripValue = withDripShares * sharePrice;
      withoutDripValue *= (1 + avgPriceGrowth);
      currentYield *= (1 + avgDivGrowth);
    }
  }
  return data;
}

function runScenarioProjection(
  totalValue: number,
  yieldPct: number,
  divGrowthPct: number,
  priceGrowth: number,
  years: number,
): number[] {
  const values: number[] = [];
  let value = totalValue;
  let shares = 1; // normalized
  let price = totalValue;
  let currentYield = yieldPct / 100;

  for (let year = 0; year <= years; year++) {
    values.push(Math.round(value));
    if (year < years) {
      const divs = value * currentYield;
      price *= (1 + priceGrowth / 100);
      const newShares = price > 0 ? divs / price : 0;
      shares += newShares;
      value = shares * price;
      currentYield *= 1.05; // 5% div growth for all scenarios
    }
  }
  return values;
}

export const DRIPImpactChart = ({ holdings, dripTransactions }: DRIPImpactChartProps) => {
  const [horizon, setHorizon] = useState<TimeHorizon>('20');
  const [showComparison, setShowComparison] = useState(false);
  const [customYield, setCustomYield] = useState(3);
  const [customGrowth, setCustomGrowth] = useState(7);

  const years = parseInt(horizon);

  const baseData = useMemo(() => {
    const totalValue = holdings.reduce((s, h) => s + (h.shares * (h.currentPrice || h.avgPrice)), 0);
    const totalAnnualDividends = holdings.reduce((s, h) => {
      const val = h.shares * (h.currentPrice || h.avgPrice);
      return s + val * ((h.dividendYield || 0) / 100);
    }, 0);

    if (totalValue === 0 || totalAnnualDividends === 0) return null;

    const avgYield = totalAnnualDividends / totalValue;
    const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
    const actualDripShares = dripTransactions.reduce((s, t) => s + Number(t.shares_purchased), 0);
    const actualDripValue = dripTransactions.reduce((s, t) => s + Number(t.dividend_amount), 0);

    return { totalValue, avgYield, totalShares, actualDripShares, actualDripValue };
  }, [holdings, dripTransactions]);

  const projection = useMemo(() => {
    if (!baseData) return null;
    return runProjection(baseData.totalValue, baseData.totalShares, baseData.avgYield, 0.07, 0.05, years);
  }, [baseData, years]);

  const comparisonData = useMemo(() => {
    if (!baseData || !showComparison) return null;

    const scenarios = DEFAULT_SCENARIOS;
    const scenarioValues = scenarios.map(s =>
      runScenarioProjection(baseData.totalValue, s.yield, s.growth, customGrowth, years)
    );

    return Array.from({ length: years + 1 }, (_, i) => ({
      year: i,
      [scenarios[0].label]: scenarioValues[0][i],
      [scenarios[1].label]: scenarioValues[1][i],
      [scenarios[2].label]: scenarioValues[2][i],
    }));
  }, [baseData, showComparison, years, customGrowth]);

  if (!projection || !baseData) return null;

  const finalYear = projection[projection.length - 1];
  const dripAdvantage = finalYear.withDrip - finalYear.withoutDrip;
  const dripAdvantagePercent = finalYear.withoutDrip > 0
    ? ((dripAdvantage / finalYear.withoutDrip) * 100).toFixed(0)
    : '0';

  const mainChartConfig = {
    withDrip: { label: 'With DRIP', color: 'hsl(142 71% 45%)' },
    withoutDrip: { label: 'Without DRIP', color: 'hsl(var(--muted-foreground))' },
  };

  const comparisonChartConfig = {
    Conservative: { label: 'Conservative (1.5% yield)', color: 'hsl(199 89% 48%)' },
    Moderate: { label: 'Moderate (3% yield)', color: 'hsl(142 71% 45%)' },
    Aggressive: { label: 'Aggressive (5% yield)', color: 'hsl(38 92% 50%)' },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5 text-primary" />
              DRIP Impact — Compounding Visualization
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Projected portfolio growth with vs. without dividend reinvestment over {years} years.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={horizon}
              onValueChange={(v) => v && setHorizon(v as TimeHorizon)}
              variant="outline"
              size="sm"
            >
              {TIME_HORIZONS.map(h => (
                <ToggleGroupItem key={h.value} value={h.value} className="text-xs px-3">
                  {h.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">With DRIP ({years}yr)</p>
            <p className="text-lg font-bold text-emerald-500">${finalYear.withDrip.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Without DRIP ({years}yr)</p>
            <p className="text-lg font-bold text-foreground">${finalYear.withoutDrip.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">DRIP Advantage</p>
            <p className="text-lg font-bold text-primary">+${dripAdvantage.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Extra Growth</p>
            <p className="text-lg font-bold text-amber-500">+{dripAdvantagePercent}%</p>
          </div>
        </div>

        {/* Actual DRIP Activity */}
        {baseData.actualDripValue > 0 && (
          <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
            📊 You've already reinvested <span className="font-medium text-foreground">${baseData.actualDripValue.toFixed(2)}</span> in dividends,
            purchasing <span className="font-medium text-foreground">{baseData.actualDripShares.toFixed(4)}</span> additional shares via DRIP.
          </div>
        )}

        {/* Main Chart */}
        <ChartContainer config={mainChartConfig} className="h-[320px] w-full">
          <AreaChart data={projection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dripGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="noDripGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
              label={{ value: 'Years', position: 'bottom', offset: -5, className: 'fill-muted-foreground', fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              className="fill-muted-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    `$${Number(value).toLocaleString()}`,
                    name === 'withDrip' ? 'With DRIP' : 'Without DRIP',
                  ]}
                />
              }
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="withDrip"
              name="With DRIP"
              stroke="hsl(142 71% 45%)"
              strokeWidth={2}
              fill="url(#dripGrad)"
            />
            <Area
              type="monotone"
              dataKey="withoutDrip"
              name="Without DRIP"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#noDripGrad)"
            />
          </AreaChart>
        </ChartContainer>

        <p className="text-xs text-muted-foreground text-center">
          Assumes 7% annual price growth and 5% annual dividend growth. For illustration only.
        </p>

        <Separator />

        {/* Comparison Mode Toggle */}
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setShowComparison(!showComparison)}
        >
          <GitCompareArrows className={`w-5 h-5 ${showComparison ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${showComparison ? 'text-foreground' : 'text-muted-foreground'}`}>
            Scenario Comparison Mode
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {showComparison ? 'Hide' : 'Show'}
          </span>
        </div>

        {showComparison && comparisonData && (
          <div className="space-y-4">
            {/* Scenario Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Assumed Price Growth: <span className="font-semibold text-foreground">{customGrowth}%</span>
                </Label>
                <Slider
                  value={[customGrowth]}
                  onValueChange={([v]) => setCustomGrowth(v)}
                  min={0}
                  max={15}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Yield Scenarios</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_SCENARIOS.map(s => (
                    <div key={s.label} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-muted-foreground">{s.label} ({s.yield}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scenario Summary */}
            <div className="grid grid-cols-3 gap-3">
              {DEFAULT_SCENARIOS.map(s => {
                const finalVal = comparisonData[comparisonData.length - 1]?.[s.label] as number;
                return (
                  <div key={s.label} className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{s.label} ({s.yield}%)</p>
                    <p className="text-lg font-bold" style={{ color: s.color }}>
                      ${(finalVal || 0).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Comparison Chart */}
            <ChartContainer config={comparisonChartConfig} className="h-[280px] w-full">
              <LineChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  label={{ value: 'Years', position: 'bottom', offset: -5, className: 'fill-muted-foreground', fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  className="fill-muted-foreground"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name as string]}
                    />
                  }
                />
                <Legend />
                {DEFAULT_SCENARIOS.map(s => (
                  <Line
                    key={s.label}
                    type="monotone"
                    dataKey={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ChartContainer>

            <p className="text-xs text-muted-foreground text-center">
              Compares DRIP compounding at different dividend yields with {customGrowth}% annual price growth.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
