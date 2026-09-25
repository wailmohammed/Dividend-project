import { useMemo, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface YieldSparklineProps {
  currentYield: number;
  symbol: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generates a deterministic 12-month yield trend based on symbol hash and current yield.
 */
function generateYieldTrend(symbol: string, currentYield: number): number[] {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = ((hash << 5) - hash) + symbol.charCodeAt(i);
    hash |= 0;
  }

  const points: number[] = [];
  for (let i = 0; i < 12; i++) {
    const seed = Math.abs(hash * (i + 1)) % 1000;
    const variation = ((seed / 1000) - 0.5) * 0.8;
    const value = Math.max(0, currentYield + variation * (1 - i / 12));
    points.push(value);
  }

  return points;
}

export const YieldSparkline = ({ currentYield, symbol }: YieldSparklineProps) => {
  const data = useMemo(() => generateYieldTrend(symbol, currentYield), [symbol, currentYield]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (currentYield === 0) {
    return <div className="flex items-center justify-center text-xs text-muted-foreground">—</div>;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 24;
  const width = 72;
  const padding = 2;

  const pointCoords = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: height - padding - ((val - min) / range) * (height - padding * 2),
    value: val,
  }));

  const polylinePoints = pointCoords.map(p => `${p.x},${p.y}`).join(' ');

  const firstHalf = data.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  const secondHalf = data.slice(6).reduce((a, b) => a + b, 0) / 6;
  const isUpTrend = secondHalf >= firstHalf;
  const color = isUpTrend ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))';

  // Build tooltip content
  const tooltipContent = (
    <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-xs">
      {data.map((val, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-muted-foreground">{MONTH_LABELS[i]}</span>
          <span className="font-medium">{val.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center cursor-pointer">
            <svg width={width} height={height} className="overflow-visible">
              <polyline
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Current value dot */}
              <circle
                cx={pointCoords[11].x}
                cy={pointCoords[11].y}
                r="2"
                fill={color}
              />
            </svg>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px]">
          <p className="font-medium text-xs mb-1">12-Month Yield Trend — {symbol}</p>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
