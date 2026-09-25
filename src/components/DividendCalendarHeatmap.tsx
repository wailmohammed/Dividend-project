import React, { useMemo, useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDividends } from '@/hooks/useDividends';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { CalendarDays, DollarSign, TrendingUp, Flame } from 'lucide-react';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, getWeek, parseISO, isSameDay } from 'date-fns';

const DividendCalendarHeatmap: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { dividends } = useDividends(activePortfolio?.id);
  const holdings = activePortfolio?.holdings || [];
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const year = parseInt(selectedYear);

  const { dayMap, monthLabels, weeks, stats } = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    const allDays = eachDayOfInterval({ start, end });

    // Build dividend map by date
    const map = new Map<string, { amount: number; symbols: string[]; isEstimated: boolean }>();
    
    // From actual dividend records
    dividends.forEach(d => {
      const dateKey = d.ex_date.substring(0, 10);
      const existing = map.get(dateKey) || { amount: 0, symbols: [], isEstimated: false };
      existing.amount += Number(d.amount);
      if (!existing.symbols.includes(d.symbol)) existing.symbols.push(d.symbol);
      if (d.is_estimated) existing.isEstimated = true;
      map.set(dateKey, existing);
    });

    // Project from holdings if no dividend records for future months
    if (holdings.length > 0) {
      const today = new Date();
      holdings.filter(h => h.dividendYield > 0).forEach(h => {
        const quarterlyAmount = (h.currentPrice * (h.dividendYield / 100) * h.shares) / 4;
        const payMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
        payMonths.forEach(m => {
          if (m >= 0 && m <= 11) {
            const payDate = new Date(year, m, 15);
            if (payDate > today) {
              const dateKey = format(payDate, 'yyyy-MM-dd');
              const existing = map.get(dateKey) || { amount: 0, symbols: [], isEstimated: true };
              existing.amount += quarterlyAmount;
              if (!existing.symbols.includes(h.symbol)) existing.symbols.push(h.symbol);
              existing.isEstimated = true;
              map.set(dateKey, existing);
            }
          }
        });
      });
    }

    // Build weeks grid (like GitHub contributions)
    const weeksArr: { date: Date; dateKey: string }[][] = [];
    let currentWeek: { date: Date; dateKey: string }[] = [];

    // Pad first week
    const firstDayOfWeek = getDay(allDays[0]); // 0 = Sunday
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({ date: new Date(0), dateKey: '' });
    }

    allDays.forEach(day => {
      const dayOfWeek = getDay(day);
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push({ date: day, dateKey: format(day, 'yyyy-MM-dd') });
    });
    if (currentWeek.length > 0) weeksArr.push(currentWeek);

    // Month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = months.map((label, idx) => {
      const firstDay = new Date(year, idx, 1);
      const weekIdx = weeksArr.findIndex(w => w.some(d => d.dateKey && isSameDay(d.date, firstDay)));
      return { label, weekIdx: Math.max(weekIdx, 0) };
    });

    // Stats
    const totalIncome = Array.from(map.values()).reduce((s, v) => s + v.amount, 0);
    const paymentDays = map.size;
    const maxDay = Math.max(...Array.from(map.values()).map(v => v.amount), 1);
    const streak = (() => {
      let max = 0, current = 0;
      for (let m = 0; m < 12; m++) {
        const hasPayment = Array.from(map.entries()).some(([k]) => {
          const d = parseISO(k);
          return d.getMonth() === m && d.getFullYear() === year;
        });
        if (hasPayment) { current++; max = Math.max(max, current); }
        else { current = 0; }
      }
      return max;
    })();

    return { dayMap: map, monthLabels: labels, weeks: weeksArr, stats: { totalIncome, paymentDays, maxDay, streak } };
  }, [dividends, holdings, year]);

  const getHeatColor = (amount: number) => {
    if (amount === 0) return 'bg-muted/30';
    const intensity = Math.min(amount / stats.maxDay, 1);
    if (intensity < 0.25) return 'bg-emerald-500/20';
    if (intensity < 0.5) return 'bg-emerald-500/40';
    if (intensity < 0.75) return 'bg-emerald-500/60';
    return 'bg-emerald-500/90';
  };

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Income ({year})</span>
            </div>
            <div className="text-2xl font-bold text-foreground">${stats.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Payment Days</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.paymentDays}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Best Single Day</span>
            </div>
            <div className="text-2xl font-bold text-foreground">${stats.maxDay.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Month Streak</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.streak}</div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="w-5 h-5 text-primary" />
            Dividend Income Heatmap
          </CardTitle>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={100}>
            <div className="overflow-x-auto">
              {/* Month labels */}
              <div className="flex mb-1 ml-8">
                {monthLabels.map((m, i) => (
                  <div
                    key={m.label}
                    className="text-[10px] text-muted-foreground"
                    style={{ position: 'absolute', left: `${m.weekIdx * 14 + 32}px` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              <div className="relative mt-5">
                {/* Day labels */}
                <div className="absolute left-0 top-0 flex flex-col gap-[2px]">
                  {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
                    <div key={i} className="h-[12px] text-[9px] text-muted-foreground leading-[12px] pr-1">{label}</div>
                  ))}
                </div>

                {/* Heatmap grid */}
                <div className="flex gap-[2px] ml-8">
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px]">
                      {week.map((day, di) => {
                        if (!day.dateKey) return <div key={di} className="w-[12px] h-[12px]" />;
                        const data = dayMap.get(day.dateKey);
                        const amount = data?.amount || 0;
                        return (
                          <Tooltip key={di}>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-[12px] h-[12px] rounded-[2px] transition-colors cursor-default ${getHeatColor(amount)} ${
                                  amount > 0 ? 'ring-1 ring-emerald-500/20' : ''
                                }`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-medium">{format(day.date, 'MMM d, yyyy')}</div>
                              {amount > 0 ? (
                                <>
                                  <div className="text-emerald-400 font-bold">${amount.toFixed(2)}</div>
                                  <div className="text-muted-foreground">{data!.symbols.join(', ')}</div>
                                  {data!.isEstimated && <Badge variant="outline" className="text-[8px] mt-1">Estimated</Badge>}
                                </>
                              ) : (
                                <div className="text-muted-foreground">No payment</div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="w-3 h-3 rounded-sm bg-muted/30" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/20" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/90" />
              <span>More</span>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
};

export default DividendCalendarHeatmap;
