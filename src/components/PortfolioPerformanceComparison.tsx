import PortfolioBenchmark from './PortfolioBenchmark';

/** Reuse the same sourced metrics wherever analytics exposes benchmark data. */
export const PortfolioPerformanceComparison = () => (
  <section className="space-y-6" aria-label="Portfolio and benchmark snapshots">
    <PortfolioBenchmark />
  </section>
);
