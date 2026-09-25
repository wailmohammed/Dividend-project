import React, { useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { TrendingUp, Calendar, Activity } from 'lucide-react';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { usePortfolio } from '@/context/PortfolioContext';
import { subDays, format, isAfter, parseISO } from 'date-fns';

interface PortfolioPerformanceChartProps {
  totalValue: number;
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({ totalValue }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const { activePortfolio } = usePortfolio();
  const { snapshots, loading } = usePortfolioSnapshots(activePortfolio?.id);

  // Filter snapshots based on time range and generate chart data
  const { data, percentChange, absoluteChange, hasNoHistory } = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '1D': startDate = subDays(now, 1); break;
      case '1W': startDate = subDays(now, 7); break;
      case '1M': startDate = subDays(now, 30); break;
      case '3M': startDate = subDays(now, 90); break;
      case '1Y': startDate = subDays(now, 365); break;
      case 'ALL':
      default: startDate = new Date(0);
    }

    // Filter and transform snapshots
    const filteredSnapshots = snapshots.filter(s =>
      isAfter(parseISO(s.snapshot_date), startDate)
    );

    if (filteredSnapshots.length > 0) {
      const chartData: { date: string; portfolio: number }[] = filteredSnapshots.map(s => ({
        date: format(parseISO(s.snapshot_date), 'MMM d'),
        portfolio: s.total_value,
      }));

      const today = format(now, 'yyyy-MM-dd');
      if (filteredSnapshots[filteredSnapshots.length - 1]?.snapshot_date === today) {
        chartData[chartData.length - 1].portfolio = totalValue;
      } else if (totalValue > 0) {
        chartData.push({ date: format(now, 'MMM d'), portfolio: totalValue });
      }

      const startVal = chartData[0]?.portfolio || totalValue;
      const pctChange = startVal > 0 ? ((totalValue - startVal) / startVal) * 100 : 0;
      const absChange = totalValue - startVal;

      return { data: chartData, percentChange: pctChange, absoluteChange: absChange, hasNoHistory: false };
    }

    return { data: [], percentChange: null, absoluteChange: null, hasNoHistory: true };
  }, [snapshots, timeRange, totalValue]);


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
          <p className="text-muted-foreground text-xs mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}:</span>
              <span className="text-xs font-bold text-popover-foreground">
                ${entry.value?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const timeRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  const getRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '1D': return 'Past Day';
      case '1W': return 'Past Week';
      case '1M': return 'Past Month';
      case '3M': return 'Past 3 Months';
      case '1Y': return 'Past Year';
      case 'ALL': return 'All Time';
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Portfolio value trend
          </h3>
          {hasNoHistory ? (
            <p className="mt-2 text-sm text-muted-foreground">{loading ? 'Loading saved history…' : 'History starts with your first recorded daily snapshot.'}</p>
          ) : (
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-sm font-bold ${(percentChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {(percentChange ?? 0) >= 0 ? '+' : ''}{(percentChange ?? 0).toFixed(2)}%
              </span>
              <span className={`text-xs ${(absoluteChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ({(absoluteChange ?? 0) >= 0 ? '+' : ''}${Math.abs(absoluteChange ?? 0).toLocaleString()})
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {getRangeLabel(timeRange)}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* A range selector only makes sense once real history exists. */}
          {!hasNoHistory && (
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                aria-pressed={timeRange === range}
                className={`min-h-11 px-3 py-1.5 text-xs font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      {/* Chart */}
      {hasNoHistory ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
          <div className="max-w-md">
            <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="font-medium text-foreground">No portfolio history for this period yet</p>
            <p className="mt-1 text-sm text-muted-foreground">This chart will fill with recorded portfolio values over time. No estimated performance is shown.</p>
          </div>
        </div>
      ) : (
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
              <Area type="monotone" dataKey="portfolio" name="Your Portfolio" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#portfolioGradient)" dot={false} activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
        </ResponsiveContainer>
      </div>
      )}


      {/* Performance Summary */}
      <div className={`mt-6 border-t border-border pt-4 ${hasNoHistory ? 'text-center' : 'grid grid-cols-2 gap-4 sm:grid-cols-3'}`}>
        {!hasNoHistory && <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Value change in selected range</p>
          <p className={`text-sm font-bold ${(percentChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {(percentChange ?? 0) >= 0 ? '+' : ''}{(percentChange ?? 0).toFixed(1)}%
          </p>
        </div>}
        {!hasNoHistory && <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Value change</p>
          <p className={`text-sm font-bold ${(absoluteChange ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {(absoluteChange ?? 0) >= 0 ? '+' : '−'}${Math.abs(absoluteChange ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>}
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Current portfolio value</p>
          <p className="text-sm font-bold text-foreground">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPerformanceChart;
