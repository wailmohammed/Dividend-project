/**
 * Dual return engine: MWR (XIRR / money-weighted) and TWR (time-weighted).
 *
 * MWR reflects the investor's actual experience (timing + size of cash flows).
 * TWR removes the effect of deposits/withdrawals and measures pure strategy
 * performance — this is the number that is comparable to an index.
 */

export interface CashFlow {
  date: Date;
  /** Negative = money into the portfolio (buy/deposit), positive = money out (sell/withdrawal). */
  amount: number;
}

export interface ValuePoint {
  date: Date;
  value: number;
}

const DAY = 1000 * 60 * 60 * 24;

/** Money-weighted return (annualized %, e.g. 12.4). Returns null when undefined. */
export function calculateXIRR(cashflows: CashFlow[]): number | null {
  const flows = [...cashflows]
    .filter(cf => cf.date instanceof Date && !isNaN(cf.date.getTime()) && isFinite(cf.amount))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (flows.length < 2) return null;
  const hasNegative = flows.some(cf => cf.amount < 0);
  const hasPositive = flows.some(cf => cf.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const t0 = flows[0].date.getTime();
  const years = flows.map(cf => (cf.date.getTime() - t0) / DAY / 365);

  const xnpv = (rate: number) => flows.reduce(
    (sum, cf, i) => sum + cf.amount / Math.pow(1 + rate, years[i]), 0,
  );

  // Search for a root first. Returning the last Newton iterate can report a
  // plausible-looking but completely unconverged rate (often the old 1,000% cap).
  const rates = [-0.9999, -0.99, -0.95, -0.9, -0.75, -0.5, -0.25, 0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 1_000, 10_000, 100_000, 1_000_000];
  const points = rates.map(rate => ({ rate, value: xnpv(rate) }));
  const brackets: Array<{ low: number; high: number }> = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.value === 0) return point.rate * 100;
    if (i === 0) continue;
    const previous = points[i - 1];
    if (Number.isFinite(previous.value) && Number.isFinite(point.value)
      && Math.sign(previous.value) !== Math.sign(point.value)) {
      brackets.push({ low: previous.rate, high: point.rate });
    }
  }

  if (brackets.length === 0) return null;

  // For non-conventional cash flows there can be multiple roots; choose the
  // bracket closest to a modest positive return, then solve it by bisection.
  const bracket = brackets.reduce((best, candidate) => {
    const distance = (low: number, high: number) =>
      0.1 < low ? low - 0.1 : 0.1 > high ? 0.1 - high : 0;
    return distance(candidate.low, candidate.high) < distance(best.low, best.high) ? candidate : best;
  });
  let low = bracket.low;
  let high = bracket.high;
  let lowValue = xnpv(low);

  for (let i = 0; i < 120; i++) {
    const mid = (low + high) / 2;
    const midValue = xnpv(mid);
    if (!Number.isFinite(midValue)) return null;
    if (midValue === 0 || high - low < 1e-10) return mid * 100;
    if (Math.sign(midValue) === Math.sign(lowValue)) {
      low = mid;
      lowValue = midValue;
    } else {
      high = mid;
    }
  }

  const result = ((low + high) / 2) * 100;
  return Number.isFinite(result) ? result : null;
}

/**
 * True time-weighted return using sub-period chain-linking.
 * Each valuation point starts a new sub-period; external cash flows inside a
 * sub-period are handled with the Modified Dietz approximation.
 *
 * Returns cumulative TWR in % over the covered window (not annualized).
 */
export function calculateTWR(valuations: ValuePoint[], cashflows: CashFlow[] = []): number | null {
  const points = [...valuations]
    .filter(v => v.date instanceof Date && !isNaN(v.date.getTime()) && isFinite(v.value))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (points.length < 2) return null;

  let chain = 1;
  let usable = false;

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    if (start.value <= 0) continue;

    const spanDays = Math.max((end.date.getTime() - start.date.getTime()) / DAY, 1);

    // External flows within (start, end]. Sign convention: contribution positive.
    const flows = cashflows.filter(
      cf => cf.date.getTime() > start.date.getTime() && cf.date.getTime() <= end.date.getTime(),
    );
    const netFlow = flows.reduce((s, cf) => s - cf.amount, 0); // contributions positive
    const weighted = flows.reduce((s, cf) => {
      const w = (end.date.getTime() - cf.date.getTime()) / DAY / spanDays;
      return s + -cf.amount * Math.min(Math.max(w, 0), 1);
    }, 0);

    const denominator = start.value + weighted;
    if (denominator <= 0) continue;

    const periodReturn = (end.value - start.value - netFlow) / denominator;
    if (!isFinite(periodReturn)) continue;

    chain *= 1 + periodReturn;
    usable = true;
  }

  if (!usable || !isFinite(chain)) return null;
  return (chain - 1) * 100;
}

/** Annualize a cumulative return (%) over a window expressed in days. */
export function annualize(cumulativePct: number | null, days: number): number | null {
  if (cumulativePct === null || days <= 0) return null;
  const years = days / 365;
  if (years < 1 / 365) return null;
  const factor = 1 + cumulativePct / 100;
  if (factor <= 0) return null;
  const value = (Math.pow(factor, 1 / years) - 1) * 100;
  return isFinite(value) ? value : null;
}

/** Simple cost-basis based total return (%) as a fallback when history is missing. */
export function simpleTotalReturn(totalCost: number, totalValue: number): number | null {
  if (!isFinite(totalCost) || totalCost <= 0) return null;
  return ((totalValue - totalCost) / totalCost) * 100;
}
