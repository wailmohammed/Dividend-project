import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface HistoricalPriceChartProps {
  symbol: string;
  name?: string;
}

interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const TIME_RANGES: { label: TimeRange; days: number }[] = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: 1825 },
];

export const HistoricalPriceChart = ({ symbol, name }: HistoricalPriceChartProps) => {
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoading(true);
      setError(null);

      try {
        const days = TIME_RANGES.find(t => t.label === timeRange)?.days || 90;
        
        const { data: result, error: fetchError } = await supabase.functions.invoke('market-data', {
          body: { 
            symbols: [symbol], 
            type: 'historical',
            days 
          },
        });

        if (fetchError) throw fetchError;

        const history = result?.historical?.[symbol];
        if (Array.isArray(history) && history.length > 0) setData(history);
        else {
          setData([]);
          setError('Historical prices are unavailable from the connected market-data source.');
        }
      } catch (err: any) {
        console.warn('Failed to load historical prices:', err);
        setData([]);
        setError('Could not load historical prices. Check the connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [symbol, timeRange]);

  const stats = data.length > 0 ? {
    currentPrice: data[data.length - 1]?.close || 0,
    startPrice: data[0]?.close || 0,
    high: Math.max(...data.map(d => d.high)),
    low: Math.min(...data.map(d => d.low)),
    change: data[data.length - 1]?.close - data[0]?.close,
    changePercent: ((data[data.length - 1]?.close - data[0]?.close) / data[0]?.close) * 100
  } : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {symbol}
              {name && <span className="text-sm font-normal text-muted-foreground">({name})</span>}
            </CardTitle>
            {stats && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl font-bold">${stats.currentPrice.toFixed(2)}</span>
                <Badge 
                  variant={stats.change >= 0 ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {stats.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stats.change >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
                </Badge>
              </div>
            )}
          </div>
          
          {/* Time Range Selector */}
          <div className="flex flex-wrap justify-end gap-1" role="group" aria-label="Historical chart range">
            {TIME_RANGES.map(({ label }) => (
              <Button
                key={label}
                variant={timeRange === label ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(label)}
                aria-pressed={timeRange === label}
                className="min-h-11 px-2 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="max-w-md px-4 text-center">
              <p>{error}</p>
              <p className="mt-2 text-xs text-muted-foreground">Showing no chart because no verified daily prices were returned.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop 
                        offset="0%" 
                        stopColor={stats && stats.change >= 0 ? '#10b981' : '#ef4444'} 
                        stopOpacity={0.3} 
                      />
                      <stop 
                        offset="100%" 
                        stopColor={stats && stats.change >= 0 ? '#10b981' : '#ef4444'} 
                        stopOpacity={0} 
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      return timeRange === '1W' ? d.toLocaleDateString('en-US', { weekday: 'short' }) :
                             timeRange === '1M' ? d.toLocaleDateString('en-US', { day: 'numeric' }) :
                             d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={stats && stats.change >= 0 ? '#10b981' : '#ef4444'}
                    strokeWidth={2}
                    fill={`url(#gradient-${symbol})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stats Footer */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Period High</p>
                  <p className="font-semibold text-emerald-500">${stats.high.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Period Low</p>
                  <p className="font-semibold text-red-500">${stats.low.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Change</p>
                  <p className={`font-semibold ${stats.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {stats.change >= 0 ? '+' : ''}${stats.change.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Period
                  </p>
                  <p className="font-semibold">{timeRange}</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
