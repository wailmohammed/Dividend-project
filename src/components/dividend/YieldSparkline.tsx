interface YieldSparklineProps {
  currentYield: number;
  symbol: string;
}

/** A single current yield cannot support a historical sparkline. */
export const YieldSparkline = ({ currentYield, symbol }: YieldSparklineProps) => (
  <div className="flex min-w-[72px] items-center justify-center text-xs text-muted-foreground" title={`Historical yield data is unavailable for ${symbol}`} aria-label={`Historical yield trend unavailable for ${symbol}`}>
    {Number.isFinite(currentYield) && currentYield > 0 ? `${currentYield.toFixed(2)}%` : '—'}
  </div>
);

export default YieldSparkline;
