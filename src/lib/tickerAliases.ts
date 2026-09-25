/**
 * Corporate-action / ticker alias registry.
 *
 * Broker exports frequently carry legacy, venue-suffixed or renamed symbols
 * (e.g. Trading 212's `ATAC_US_EQ`). Normalizing here keeps pricing, alerts and
 * holdings consistent instead of failing the market refresh.
 */

export interface TickerAlias {
  /** Canonical, tradable symbol used for pricing. */
  symbol: string;
  /** Canonical company name. */
  name?: string;
  /** Why the alias exists: rename, merger, spinoff, broker-suffix. */
  reason: 'rename' | 'merger' | 'spinoff' | 'broker-format' | 'correction';
  /** Optional share ratio applied on splits/spinoffs (newShares = shares * ratio). */
  ratio?: number;
}

export const TICKER_ALIASES: Record<string, TickerAlias> = {
  ATAC: { symbol: 'OWL', name: 'Blue Owl Capital Inc.', reason: 'correction' },
  FB: { symbol: 'META', name: 'Meta Platforms, Inc.', reason: 'rename' },
  TWTR: { symbol: 'X', name: 'X Corp. (private)', reason: 'merger' },
  RTN: { symbol: 'RTX', name: 'RTX Corporation', reason: 'merger' },
  GOOG_OLD: { symbol: 'GOOGL', name: 'Alphabet Inc.', reason: 'rename' },
  SQ: { symbol: 'XYZ', name: 'Block, Inc.', reason: 'rename' },
  ANTM: { symbol: 'ELV', name: 'Elevance Health, Inc.', reason: 'rename' },
  WPX: { symbol: 'DVN', name: 'Devon Energy Corporation', reason: 'merger' },
  CERN: { symbol: 'ORCL', name: 'Oracle Corporation', reason: 'merger' },
};

/** Strip broker formatting such as `ABT_US_EQ`, `ABT.US`, `ABT:NYSE`, whitespace. */
export function stripBrokerFormatting(raw: string): string {
  return (raw || '')
    .trim()
    .toUpperCase()
    .replace(/_(US|UK|EU|DE|CA|GB)?_?EQ$/i, '')
    .replace(/\.(US|L|TO|DE|PA|AS|MI)$/i, '')
    .replace(/:[A-Z]+$/i, '')
    .trim();
}

export interface NormalizedTicker {
  symbol: string;
  name?: string;
  changed: boolean;
  reason?: TickerAlias['reason'];
  ratio?: number;
}

/** Normalize any broker symbol into the canonical tradable ticker. */
export function normalizeTicker(raw: string, fallbackName?: string): NormalizedTicker {
  const cleaned = stripBrokerFormatting(raw);
  const alias = TICKER_ALIASES[cleaned];
  if (!alias) {
    return { symbol: cleaned, name: fallbackName, changed: cleaned !== (raw || '').trim().toUpperCase() };
  }
  return {
    symbol: alias.symbol,
    name: alias.name || fallbackName,
    changed: true,
    reason: alias.reason,
    ratio: alias.ratio,
  };
}
