import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { getPriceHistory } from '@/hooks/useStockPrices';

interface Props {
  symbol: string;
  /** Changing this forces a re-read of the shared history buffer. */
  version?: number | string | null;
  height?: number;
}

const fmtTime = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const SparkTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as { t: number; p: number };
  return (
    <div
      className="rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md"
      data-testid="sparkline-tooltip"
    >
      <div className="font-medium">${point.p.toFixed(2)}</div>
      <div className="text-muted-foreground">{fmtTime(point.t)}</div>
    </div>
  );
};

/** Tiny sparkline of the last few refreshed prices for a symbol. */
const PriceSparkline: React.FC<Props> = ({ symbol, version, height = 36 }) => {
  const points = React.useMemo(() => getPriceHistory(symbol), [symbol, version]);
  if (points.length < 2) return null;

  const first = points[0].p;
  const last = points[points.length - 1].p;
  const rising = last >= first;
  // WCAG-friendly contrast on both light and dark surfaces.
  const stroke = rising ? 'hsl(152 62% 32%)' : 'hsl(0 68% 44%)';
  const direction = rising ? 'up' : 'down';

  return (
    <div
      style={{ height }}
      className="mt-1"
      data-testid="price-sparkline"
      data-direction={direction}
      role="img"
      aria-label={`${symbol} price history, ${points.length} points, trending ${direction}: ${first.toFixed(2)} to ${last.toFixed(2)}`}
      title={`Trending ${direction} · ${first.toFixed(2)} → ${last.toFixed(2)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            content={<SparkTooltip />}
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: stroke, stroke: 'hsl(var(--background))', strokeWidth: 1 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceSparkline;
