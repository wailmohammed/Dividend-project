import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Percent } from 'lucide-react';
import { Holding } from '@/types';
import { DbDividend } from '@/hooks/useDividends';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';

interface YieldOnCostChartProps {
  holdings: Holding[];
  dividends?: DbDividend[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(262 83% 58%)',
  'hsl(0 84% 60%)',
  'hsl(199 89% 48%)',
];

export const YieldOnCostChart = ({ holdings, dividends = [] }: YieldOnCostChartProps) => {
  const chartData = useMemo(() => {
    // Only include holdings with cost basis
    const eligibleHoldings = holdings.filter(h => h.avgPrice > 0 && h.shares > 0);
    if (eligibleHoldings.length === 0) return { data: [], symbols: [], hasRealData: false };
    if (dividends.length === 0) return { data: [], symbols: [], hasRealData: false };

    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      months.push({
        key: format(d, 'yyyy-MM'),
        label: format(d, "MMM ''yy"),
        start: startOfMonth(d),
        end: endOfMonth(d),
      });
    }

    // Calculate YoC per holding per month
    const holdingYocData = eligibleHoldings.map(h => {
      const costBasis = h.avgPrice * h.shares;
      if (costBasis === 0) return null;

      const monthlyYoc = months.map(m => {
        const monthDividends = dividends.filter(d =>
          d.symbol === h.symbol &&
          isWithinInterval(parseISO(d.pay_date || d.ex_date), { start: m.start, end: m.end })
        );
        const monthlyDivIncome = monthDividends.reduce((sum, d) => sum + Number(d.amount) * h.shares, 0);
        // Annualize recorded payments for a comparable monthly trend.
        const annualizedYoc = (monthlyDivIncome * 12 / costBasis) * 100;
        return { month: m.label, yoc: parseFloat(annualizedYoc.toFixed(2)) };
      });

      const avgYoc = monthlyYoc.reduce((s, d) => s + d.yoc, 0) / monthlyYoc.length;
      return { symbol: h.symbol, data: monthlyYoc, avgYoc };
    }).filter(Boolean);

    // Sort by average YoC descending, take top 6
    const topHoldings = holdingYocData
      .sort((a, b) => (b?.avgYoc || 0) - (a?.avgYoc || 0))
      .slice(0, 6);

    if (topHoldings.length === 0) return { data: [], symbols: [], hasRealData: false };

    // Merge into unified chart data
    const merged = months.map((m, idx) => {
      const row: Record<string, string | number> = { month: m.label };
      topHoldings.forEach(h => {
        if (h) row[h.symbol] = h.data[idx]?.yoc || 0;
      });
      return row;
    });

    return {
      data: merged,
      symbols: topHoldings.map(h => h!.symbol),
      hasRealData: true,
    };
  }, [holdings, dividends]);

  if (chartData.symbols.length === 0) {
    return holdings.some(h => h.avgPrice > 0 && h.shares > 0) ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Percent className="h-5 w-5 text-primary" />Yield on Cost Over Time</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Record dated dividend payments to build this chart. Current yield alone cannot show how yield on cost changed historically.
        </CardContent>
      </Card>
    ) : null;
  }

  const chartConfig = Object.fromEntries(
    chartData.symbols.map((s, i) => [s, { label: s, color: COLORS[i % COLORS.length] }])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="w-5 h-5 text-primary" />
          Yield on Cost (YoC) Over Time
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          'Calculated from dividend payments recorded in your ledger, relative to your purchase price.'
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={chartData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
              className="fill-muted-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name as string]}
                />
              }
            />
            <Legend />
            {chartData.symbols.map((symbol, i) => (
              <Line
                key={symbol}
                type="monotone"
                dataKey={symbol}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
