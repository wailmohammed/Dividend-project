import { FairValueAnalysis } from './FairValueAnalysis';

/** Keep the full report on the same sourced fundamentals and valuation logic
 * as the portfolio valuation page; avoid duplicating stale sample metrics.
 */
export const UnifiedStockReport = () => <FairValueAnalysis />;

export default UnifiedStockReport;
