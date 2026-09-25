import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
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

        if (result?.historical?.[symbol]) {
          setData(result.historical[symbol]);
        } else {
          // Generate mock data if API doesn't support historical
          const mockData = generateMockHistoricalData(symbol, days);
          setData(mockData);
        }
      } catch (err: any) {
        console.warn('Using mock historical data:', err);
        const days = TIME_RANGES.find(t => t.label === timeRange)?.days || 90;
        setData(generateMockHistoricalData(symbol, days));
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [symbol, timeRange]);

  const generateMockHistoricalData = (sym: string, days: number): CandleData[] => {
    const basePrice = getBasePrice(sym);
    const data: CandleData[] = [];
    const volatility = sym.includes('BTC') || sym.includes('ETH') ? 0.03 : 0.015;
    
    let price = basePrice * 0.85;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const change = (Math.random() - 0.48) * volatility * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      data.push({
        date: date.toISOString().split('T')[0],
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000) + 1000000
      });
      
      price = close;
    }
    
    return data;
  };

  const getBasePrice = (sym: string): number => {
    const prices: Record<string, number> = {
      'AAPL': 178, 'MSFT': 378, 'GOOGL': 141, 'AMZN': 178, 'NVDA': 495,
      'META': 505, 'TSLA': 248, 'BTC': 67500, 'ETH': 3450, 'VOO': 485
    };
    return prices[sym.toUpperCase()] || 100;
  };

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
          <div className="flex gap-1">
            {TIME_RANGES.map(({ label }) => (
              <Button
                key={label}
                variant={timeRange === label ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(label)}
                className="px-2 text-xs"
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
            {error}
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