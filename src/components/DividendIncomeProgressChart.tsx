import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { IncomeSnapshot } from '@/hooks/useDividendIncomeSnapshots';

interface DividendIncomeProgressChartProps {
  currentMonthlyIncome: number;
  goalTarget: number | null;
  goalType: 'monthly' | 'annual' | null;
  snapshots: IncomeSnapshot[];
}

export const DividendIncomeProgressChart = ({
  currentMonthlyIncome,
  goalTarget,
  goalType,
  snapshots,
}: DividendIncomeProgressChartProps) => {
  const chartData = useMemo(() => {
    const now = new Date();
    const months: { month: string; label: string; income: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, 'yyyy-MM');
      const existing = snapshots.find(s => s.month === key);
      months.push({
        month: key,
        label: format(d, 'MMM yyyy'),
        income: existing ? existing.monthly_income : (i === 0 ? currentMonthlyIncome : 0),
      });
    }

    return months.map(m => ({
      month: m.label,
      income: parseFloat(m.income.toFixed(2)),
    }));
  }, [currentMonthlyIncome, snapshots]);

  const monthlyGoal = useMemo(() => {
    if (!goalTarget) return null;
    return goalType === 'annual' ? goalTarget / 12 : goalTarget;
  }, [goalTarget, goalType]);

  const chartConfig = {
    income: {
      label: 'Monthly Income',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          Income Progress Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={v => `$${v}`}
              className="fill-muted-foreground"
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Income']}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#incomeGradient)"
            />
            {monthlyGoal && (
              <ReferenceLine
                y={monthlyGoal}
                stroke="hsl(142 71% 45%)"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `Goal: $${monthlyGoal.toFixed(0)}/mo`,
                  position: 'right',
                  fill: 'hsl(142 71% 45%)',
                  fontSize: 12,
                }}
              />
            )}
          </AreaChart>
        </ChartContainer>
        {!monthlyGoal && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Set an income goal above to see the target line on the chart.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
