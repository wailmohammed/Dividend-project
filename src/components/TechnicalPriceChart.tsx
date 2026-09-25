import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, AreaChart, Line, ComposedChart, ReferenceLine, Bar
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Activity, BarChart2, LineChart, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TechnicalPriceChartProps {
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

interface ChartData extends CandleData {
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  upperBand?: number;
  lowerBand?: number;
  middleBand?: number;
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

// Calculate Simple Moving Average
const calculateSMA = (data: number[], period: number): (number | undefined)[] => {
  const result: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
};

// Calculate Exponential Moving Average
const calculateEMA = (data: number[], period: number): (number | undefined)[] => {
  const result: (number | undefined)[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
    } else if (i === period - 1) {
      const sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(sma);
    } else {
      const prevEma = result[i - 1] as number;
      result.push((data[i] - prevEma) * multiplier + prevEma);
    }
  }
  return result;
};

// Calculate RSI
const calculateRSI = (data: number[], period: number = 14): (number | undefined)[] => {
  const result: (number | undefined)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(undefined);
    } else {
      const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }
  }
  return result;
};

// Calculate Bollinger Bands
const calculateBollingerBands = (data: number[], period: number = 20, stdDev: number = 2): { upper: (number | undefined)[], middle: (number | undefined)[], lower: (number | undefined)[] } => {
  const sma = calculateSMA(data, period);
  const upper: (number | undefined)[] = [];
  const lower: (number | undefined)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || sma[i] === undefined) {
      upper.push(undefined);
      lower.push(undefined);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i] as number;
      const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }

  return { upper, middle: sma, lower };
};

export const TechnicalPriceChart = ({ symbol, name }: TechnicalPriceChartProps) => {
  const [data, setData] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [showBollingerBands, setShowBollingerBands] = useState(false);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [chartType, setChartType] = useState<'area' | 'line'>('area');

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoading(true);
      setError(null);

      try {
        const days = TIME_RANGES.find(t => t.label === timeRange)?.days || 90;
        
        const { data: result, error: fetchError } = await supabase.functions.invoke('market-data', {
          body: { symbols: [symbol], type: 'historical', days },
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

  // Calculate technical indicators
  const chartData: ChartData[] = useMemo(() => {
    if (data.length === 0) return [];
    
    const closePrices = data.map(d => d.close);
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const ema12 = calculateEMA(closePrices, 12);
    const ema26 = calculateEMA(closePrices, 26);
    const rsi = calculateRSI(closePrices, 14);
    const bollingerBands = calculateBollingerBands(closePrices, 20, 2);
    
    // Calculate MACD
    const macd: (number | undefined)[] = [];
    for (let i = 0; i < closePrices.length; i++) {
      if (ema12[i] !== undefined && ema26[i] !== undefined) {
        macd.push((ema12[i] as number) - (ema26[i] as number));
      } else {
        macd.push(undefined);
      }
    }
    
    // Calculate MACD Signal Line (9-period EMA of MACD)
    const macdSignal: (number | undefined)[] = [];
    const macdValues = macd.filter(v => v !== undefined) as number[];
    const macdSignalEma = calculateEMA(macdValues, 9);
    let macdIdx = 0;
    for (let i = 0; i < macd.length; i++) {
      if (macd[i] !== undefined) {
        macdSignal.push(macdSignalEma[macdIdx]);
        macdIdx++;
      } else {
        macdSignal.push(undefined);
      }
    }
    
    return data.map((d, i) => ({
      ...d,
      sma20: sma20[i],
      sma50: sma50[i],
      ema12: ema12[i],
      ema26: ema26[i],
      rsi: rsi[i],
      macd: macd[i],
      macdSignal: macdSignal[i],
      macdHistogram: macd[i] !== undefined && macdSignal[i] !== undefined 
        ? (macd[i] as number) - (macdSignal[i] as number)
        : undefined,
      upperBand: bollingerBands.upper[i],
      middleBand: bollingerBands.middle[i],
      lowerBand: bollingerBands.lower[i],
    }));
  }, [data]);

  const stats = chartData.length > 0 ? {
    currentPrice: chartData[chartData.length - 1]?.close || 0,
    startPrice: chartData[0]?.close || 0,
    high: Math.max(...chartData.map(d => d.high)),
    low: Math.min(...chartData.map(d => d.low)),
    change: chartData[chartData.length - 1]?.close - chartData[0]?.close,
    changePercent: ((chartData[chartData.length - 1]?.close - chartData[0]?.close) / chartData[0]?.close) * 100,
    currentRSI: chartData[chartData.length - 1]?.rsi,
    currentSMA20: chartData[chartData.length - 1]?.sma20,
    currentSMA50: chartData[chartData.length - 1]?.sma50,
  } : null;

  const getRSISignal = (rsi: number | undefined): { text: string; color: string } => {
    if (!rsi) return { text: 'N/A', color: 'text-muted-foreground' };
    if (rsi >= 70) return { text: 'Overbought', color: 'text-red-500' };
    if (rsi <= 30) return { text: 'Oversold', color: 'text-emerald-500' };
    return { text: 'Neutral', color: 'text-yellow-500' };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  const rsiSignal = getRSISignal(stats?.currentRSI);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {symbol} Technical Analysis
              {name && <span className="text-sm font-normal text-muted-foreground">({name})</span>}
            </CardTitle>
            {stats && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-2xl font-bold">${stats.currentPrice.toFixed(2)}</span>
                <Badge variant={stats.change >= 0 ? "default" : "destructive"} className="flex items-center gap-1">
                  {stats.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stats.change >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
                </Badge>
                {stats.currentRSI !== undefined && (
                  <Badge variant="outline" className={rsiSignal.color}>
                    RSI: {stats.currentRSI.toFixed(1)} ({rsiSignal.text})
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-1 flex-wrap">
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

        {/* Indicator Toggles */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center space-x-2">
            <Switch id="sma20" checked={showSMA20} onCheckedChange={setShowSMA20} />
            <Label htmlFor="sma20" className="text-xs text-blue-400">SMA 20</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="sma50" checked={showSMA50} onCheckedChange={setShowSMA50} />
            <Label htmlFor="sma50" className="text-xs text-orange-400">SMA 50</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="bollinger" checked={showBollingerBands} onCheckedChange={setShowBollingerBands} />
            <Label htmlFor="bollinger" className="text-xs text-purple-400">Bollinger Bands</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="rsi" checked={showRSI} onCheckedChange={setShowRSI} />
            <Label htmlFor="rsi" className="text-xs text-cyan-400">RSI Panel</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="macd" checked={showMACD} onCheckedChange={setShowMACD} />
            <Label htmlFor="macd" className="text-xs text-pink-400">MACD</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="volume" checked={showVolume} onCheckedChange={setShowVolume} />
            <Label htmlFor="volume" className="text-xs text-amber-400">Volume</Label>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
              className="p-1"
            >
              <BarChart2 className="w-4 h-4" />
            </Button>
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
              className="p-1"
            >
              <LineChart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">{error}</div>
        ) : (
          <>
            {/* Main Price Chart */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stats && stats.change >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={stats && stats.change >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bollingerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
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
                    formatter={(value: number, name: string) => {
                      if (name === 'close') return [`$${value.toFixed(2)}`, 'Price'];
                      if (name === 'sma20') return [`$${value.toFixed(2)}`, 'SMA 20'];
                      if (name === 'sma50') return [`$${value.toFixed(2)}`, 'SMA 50'];
                      if (name === 'upperBand') return [`$${value.toFixed(2)}`, 'Upper Band'];
                      if (name === 'lowerBand') return [`$${value.toFixed(2)}`, 'Lower Band'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  />

                  {/* Bollinger Bands */}
                  {showBollingerBands && (
                    <>
                      <Area type="monotone" dataKey="upperBand" stroke="#a855f7" strokeWidth={1} fill="none" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="lowerBand" stroke="#a855f7" strokeWidth={1} fill="none" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="middleBand" stroke="#a855f7" strokeWidth={1} dot={false} />
                    </>
                  )}

                  {/* Price */}
                  {chartType === 'area' ? (
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={stats && stats.change >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      fill={`url(#gradient-${symbol})`}
                    />
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke={stats && stats.change >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                    />
                  )}

                  {/* Moving Averages */}
                  {showSMA20 && (
                    <Line type="monotone" dataKey="sma20" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                  )}
                  {showSMA50 && (
                    <Line type="monotone" dataKey="sma50" stroke="#f97316" strokeWidth={1.5} dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* RSI Panel */}
            {showRSI && (
              <div className="h-24 mt-4 pt-4 border-t">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis dataKey="date" hide />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} ticks={[30, 50, 70]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [value.toFixed(2), 'RSI']}
                    />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '70', position: 'right', fontSize: 10 }} />
                    <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" label={{ value: '30', position: 'right', fontSize: 10 }} />
                    <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="rsi"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      fill="#06b6d4"
                      fillOpacity={0.2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Volume Chart */}
            {showVolume && (
              <div className="h-20 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Volume</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis dataKey="date" hide />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [(value / 1000000).toFixed(2) + 'M', 'Volume']}
                    />
                    <Bar
                      dataKey="volume"
                      fill="#f59e0b"
                      fillOpacity={0.6}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* MACD Panel */}
            {showMACD && (
              <div className="h-28 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-medium text-pink-400">MACD</span>
                  <span className="text-xs text-muted-foreground">(12, 26, 9)</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis dataKey="date" hide />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'macd') return [value?.toFixed(4), 'MACD'];
                        if (name === 'macdSignal') return [value?.toFixed(4), 'Signal'];
                        if (name === 'macdHistogram') return [value?.toFixed(4), 'Histogram'];
                        return [value, name];
                      }}
                    />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
                    <Bar
                      dataKey="macdHistogram"
                      fill="#ec4899"
                      fillOpacity={0.6}
                    />
                    <Line
                      type="monotone"
                      dataKey="macd"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="macdSignal"
                      stroke="#f97316"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Stats Footer */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Period High</p>
                  <p className="font-semibold text-emerald-500">${stats.high.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Period Low</p>
                  <p className="font-semibold text-red-500">${stats.low.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SMA 20</p>
                  <p className={`font-semibold ${stats.currentPrice > (stats.currentSMA20 || 0) ? 'text-emerald-500' : 'text-red-500'}`}>
                    ${stats.currentSMA20?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SMA 50</p>
                  <p className={`font-semibold ${stats.currentPrice > (stats.currentSMA50 || 0) ? 'text-emerald-500' : 'text-red-500'}`}>
                    ${stats.currentSMA50?.toFixed(2) || 'N/A'}
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

export default TechnicalPriceChart;
