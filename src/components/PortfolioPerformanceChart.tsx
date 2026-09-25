import React, { useState, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart } from 'recharts';
import { TrendingUp, Calendar, Activity, Layers } from 'lucide-react';
import { usePortfolioSnapshots, PortfolioSnapshot } from '@/hooks/usePortfolioSnapshots';
import { usePortfolio } from '@/context/PortfolioContext';
import { subDays, format, isAfter, parseISO } from 'date-fns';

interface PortfolioPerformanceChartProps {
  totalValue: number;
}

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
type ViewMode = 'trend' | 'stacked';

const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({ totalValue }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [viewMode, setViewMode] = useState<ViewMode>('trend');
  const { activePortfolio } = usePortfolio();
  const { snapshots, loading } = usePortfolioSnapshots(activePortfolio?.id);

  // Cost basis and annual dividend income from current holdings
  const { costBasis, annualDividends } = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const cb = holdings.reduce((sum, h) => sum + (h.shares * h.avgPrice), 0);
    const div = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice * (h.dividendYield || 0) / 100), 0);
    return { costBasis: cb, annualDividends: div };
  }, [activePortfolio?.holdings]);

  // Filter snapshots based on time range and generate chart data
  const { data, percentChange, absoluteChange, isSimulated } = useMemo(() => {
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

    const enrichStacked = (rows: any[]) => {
      if (rows.length === 0) return rows;
      const totalDays = Math.max(1, rows.length - 1);
      const dailyDiv = annualDividends / 365;
      return rows.map((r, i) => ({
        ...r,
        ...(costBasis > 0 ? { costBasis } : {}),
        estimatedDividends: Math.round(dailyDiv * (i / totalDays) * rows.length),
      }));
    };

    // Filter and transform snapshots
    let filteredSnapshots = snapshots.filter(s => 
      isAfter(parseISO(s.snapshot_date), startDate)
    );

    if (filteredSnapshots.length > 0) {
      const chartData = filteredSnapshots.map(s => ({
        date: format(parseISO(s.snapshot_date), 'MMM d'),
        portfolio: s.total_value,
      }));

      chartData.push({
        date: format(now, 'MMM d'),
        portfolio: totalValue,
      });

      const startVal = chartData[0]?.portfolio || totalValue;
      const pctChange = startVal > 0 ? ((totalValue - startVal) / startVal) * 100 : 0;
      const absChange = totalValue - startVal;

      return { data: enrichStacked(chartData), percentChange: pctChange, absoluteChange: absChange, isSimulated: false };
    }

    // Generate mock data if no snapshots
    const days = timeRange === '1D' ? 24 :
                 timeRange === '1W' ? 7 :
                 timeRange === '1M' ? 30 :
                 timeRange === '3M' ? 90 :
                 timeRange === '1Y' ? 365 : 730;
    
    const baseValue = totalValue * 0.85;
    const mockData: { date: string; portfolio: number }[] = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      if (timeRange === '1D') date.setHours(date.getHours() - i);
      else date.setDate(date.getDate() - i);
      
      const progress = (days - i) / days;
      const portfolioGrowth = baseValue * (1 + progress * 0.18 + Math.sin(i / 10) * 0.03);
      
      mockData.push({
        date: timeRange === '1D' ? format(date, 'HH:mm') : format(date, 'MMM d'),
        portfolio: Math.round(portfolioGrowth),
      });
    }
    
    if (mockData.length > 0) mockData[mockData.length - 1].portfolio = Math.round(totalValue);

    const startVal = mockData[0]?.portfolio || totalValue;
    const pctChange = startVal > 0 ? ((totalValue - startVal) / startVal) * 100 : 0;
    const absChange = totalValue - startVal;

    return { data: enrichStacked(mockData), percentChange: pctChange, absoluteChange: absChange, isSimulated: true };
  }, [snapshots, timeRange, totalValue, costBasis, annualDividends]);


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
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-sm font-bold ${percentChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </span>
            <span className={`text-xs ${absoluteChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ({absoluteChange >= 0 ? '+' : ''}${Math.abs(absoluteChange).toLocaleString()})
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {getRangeLabel(timeRange)}
            </span>
          </div>
          {isSimulated && (
            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Illustrative trend only. Portfolio history is not available for this period.
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('trend')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                viewMode === 'trend' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingUp className="w-3 h-3" /> Value trend
            </button>
            <button
              onClick={() => setViewMode('stacked')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                viewMode === 'stacked' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3 h-3" /> Stacked
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeRange === range
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'trend' ? (
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
          ) : (
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="marketValueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="dividendsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 76% 45%)" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="hsl(142 76% 45%)" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
              <Area type="monotone" dataKey="portfolio" name="Market Value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#marketValueGradient)" dot={false} />
              <Area type="monotone" dataKey="estimatedDividends" name="Estimated Dividends" stroke="hsl(142 76% 45%)" strokeWidth={1.5} fill="url(#dividendsGradient)" dot={false} />
              <Line type="monotone" dataKey="costBasis" name="Cost Basis" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>


      {/* Performance Summary */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Portfolio value change</p>
          <p className={`text-sm font-bold ${percentChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Value change</p>
          <p className={`text-sm font-bold ${absoluteChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {absoluteChange >= 0 ? '+' : '-'}${Math.abs(absoluteChange).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
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
