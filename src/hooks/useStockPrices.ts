import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMarketPrices, PriceData } from '@/services/marketDataService';
import { useAuth } from '@/context/AuthContext';
import { DEMO_PRICES } from '@/constants/demoTaxLots';

export interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  source: string;
  lastUpdated: Date;
}

export type PriceErrorKind = 'timeout' | 'not_found' | 'empty' | 'network' | 'unknown';

export interface PriceError {
  kind: PriceErrorKind;
  message: string;
}

/** Short-lived shared cache so flipping between tickers doesn't refetch. */
const DEFAULT_PRICE_CACHE_TTL = 30_000;
const FETCH_TIMEOUT = 10_000;
const PRICE_CACHE_STORAGE_KEY = 'live-price-cache-v1';
const PRICE_HISTORY_STORAGE_KEY = 'live-price-history-v1';
const PRICE_TTL_STORAGE_KEY = 'live-price-cache-ttl';
const HISTORY_LIMIT = 12;

export const PRICE_TTL_OPTIONS = [
  { value: 30_000, label: '30 seconds' },
  { value: 60_000, label: '1 minute' },
  { value: 300_000, label: '5 minutes' },
] as const;

const priceCache = new Map<string, { data: StockPrice; ts: number }>();
const priceHistory = new Map<string, { t: number; p: number }[]>();
const cacheListeners = new Set<() => void>();

const notifyCacheListeners = () => cacheListeners.forEach(fn => fn());

export const subscribeToPriceCache = (fn: () => void) => {
  cacheListeners.add(fn);
  return () => { cacheListeners.delete(fn); };
};

let priceCacheTtl = DEFAULT_PRICE_CACHE_TTL;
if (typeof window !== 'undefined') {
  const stored = Number(window.localStorage.getItem(PRICE_TTL_STORAGE_KEY));
  if (Number.isFinite(stored) && stored > 0) priceCacheTtl = stored;
}

export const getPriceCacheTtl = () => priceCacheTtl;

export const setPriceCacheTtl = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return;
  if (ms === priceCacheTtl) return;
  priceCacheTtl = ms;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(PRICE_TTL_STORAGE_KEY, String(ms)); } catch { /* noop */ }
  }
  // Automatic invalidation: drop entries that fall outside the new freshness
  // window (and persist the pruned cache) so the next view reflects the change.
  invalidateStalePrices();
  notifyCacheListeners();
};

/** Remove cache entries older than the current TTL. Returns the number dropped. */
export const invalidateStalePrices = () => {
  const now = Date.now();
  let dropped = 0;
  priceCache.forEach((entry, symbol) => {
    if (now - entry.ts > priceCacheTtl) {
      priceCache.delete(symbol);
      dropped++;
    }
  });
  if (dropped > 0) persistPriceCache();
  return dropped;
};

/** Hydrate the in-memory cache from localStorage so prices show instantly after a reload. */
const hydratePriceCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PRICE_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { data: Omit<StockPrice, 'lastUpdated'> & { lastUpdated: string }; ts: number }>;
      const now = Date.now();
      Object.entries(parsed).forEach(([symbol, entry]) => {
        if (!entry?.data || now - entry.ts > priceCacheTtl) return;
        priceCache.set(symbol, {
          ts: entry.ts,
          data: { ...entry.data, lastUpdated: new Date(entry.data.lastUpdated) },
        });
      });
    }
    const rawHistory = window.localStorage.getItem(PRICE_HISTORY_STORAGE_KEY);
    if (rawHistory) {
      const parsed = JSON.parse(rawHistory) as Record<string, { t: number; p: number }[]>;
      Object.entries(parsed).forEach(([symbol, points]) => {
        if (Array.isArray(points)) priceHistory.set(symbol, points.slice(-HISTORY_LIMIT));
      });
    }
  } catch {
    /* corrupt cache — ignore */
  }
};

const persistPriceCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const out: Record<string, unknown> = {};
    const now = Date.now();
    priceCache.forEach((entry, symbol) => {
      if (now - entry.ts > priceCacheTtl) return;
      out[symbol] = { ts: entry.ts, data: { ...entry.data, lastUpdated: entry.data.lastUpdated.toISOString() } };
    });
    window.localStorage.setItem(PRICE_CACHE_STORAGE_KEY, JSON.stringify(out));
    const hist: Record<string, { t: number; p: number }[]> = {};
    priceHistory.forEach((points, symbol) => { hist[symbol] = points; });
    window.localStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(hist));
  } catch {
    /* storage full / unavailable — cache stays in memory only */
  }
};

hydratePriceCache();

const recordHistory = (symbol: string, price: number) => {
  const key = symbol.toUpperCase();
  const points = priceHistory.get(key) ?? [];
  const last = points[points.length - 1];
  if (last && last.p === price) return;
  points.push({ t: Date.now(), p: price });
  priceHistory.set(key, points.slice(-HISTORY_LIMIT));
};

export const getPriceHistory = (symbol: string): { t: number; p: number }[] =>
  priceHistory.get((symbol || '').toUpperCase()) ?? [];

const setCachedPrice = (symbol: string, data: StockPrice) => {
  priceCache.set(symbol.toUpperCase(), { data, ts: Date.now() });
  recordHistory(symbol, data.price);
  persistPriceCache();
};

export const getCachedPrice = (symbol: string): StockPrice | undefined => {
  const hit = priceCache.get(symbol.toUpperCase());
  if (!hit) return undefined;
  if (Date.now() - hit.ts > priceCacheTtl) {
    priceCache.delete(symbol.toUpperCase());
    return undefined;
  }
  return hit.data;
};

export const clearPriceCache = () => {
  priceCache.clear();
  priceHistory.clear();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PRICE_CACHE_STORAGE_KEY);
      window.localStorage.removeItem(PRICE_HISTORY_STORAGE_KEY);
    } catch { /* noop */ }
  }
  notifyCacheListeners();
};

/** Warm the cache for symbols the user is likely to select next. Never throws. */
export const prefetchPrices = async (symbols: string[]) => {
  const missing = Array.from(
    new Set(symbols.map(s => (s || '').toUpperCase()).filter(Boolean))
  ).filter(s => !getCachedPrice(s));
  if (missing.length === 0) return;
  try {
    const priceData = await fetchMarketPrices(missing);
    Object.entries(priceData as Record<string, PriceData>).forEach(([symbol, data]) => {
      if (!data || typeof data.price !== 'number' || !isFinite(data.price)) return;
      setCachedPrice(symbol, {
        symbol: (data.symbol || symbol).toUpperCase(),
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        source: data.source,
        lastUpdated: new Date(data.lastUpdated),
      });
    });
  } catch {
    /* prefetch is best-effort */
  }
};

/** Most-recently viewed symbols, newest first — used to guess the next selection. */
const RECENT_LIMIT = 6;
const recentSymbols: string[] = [];

export const rememberSymbol = (symbol: string) => {
  const s = (symbol || '').toUpperCase();
  if (!s) return;
  const i = recentSymbols.indexOf(s);
  if (i !== -1) recentSymbols.splice(i, 1);
  recentSymbols.unshift(s);
  if (recentSymbols.length > RECENT_LIMIT) recentSymbols.length = RECENT_LIMIT;
};

export const getLikelyNextSymbols = (exclude: string[] = []): string[] => {
  const skip = new Set(exclude.map(s => (s || '').toUpperCase()));
  return recentSymbols.filter(s => !skip.has(s) && !getCachedPrice(s)).slice(0, 3);
};



const describeError = (err: any): PriceError => {
  const raw = String(err?.message || err || 'Unknown error');
  const status = err?.status ?? err?.context?.status;
  if (err?.name === 'TimeoutError' || /timeout|timed out|aborted/i.test(raw)) {
    return { kind: 'timeout', message: 'Request timed out after 10s' };
  }
  if (status === 404 || /404|not found/i.test(raw)) {
    return { kind: 'not_found', message: 'Symbol not found (404)' };
  }
  if (/failed to fetch|network|ECONN|offline/i.test(raw)) {
    return { kind: 'network', message: 'Network error reaching the price service' };
  }
  return { kind: 'unknown', message: raw };
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      const e = new Error('Request timed out');
      e.name = 'TimeoutError';
      reject(e);
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });

export const useStockPrices = (symbols: string[], refreshInterval = 30000, debounceMs = 400) => {
  const { user } = useAuth();
  const [prices, setPrices] = useState<Map<string, StockPrice>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<PriceError | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [origin, setOrigin] = useState<'cache' | 'live' | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const symbolsRef = useRef<string[]>(symbols);
  const symbolsKey = symbols.map(s => (s || '').toUpperCase()).filter(Boolean).sort().join(',');

  const isDemoMode = !user || user.id === 'demo-user';

  useEffect(() => {
    symbolsRef.current = symbols;
  }, [symbolsKey]);

  const fetchPrices = useCallback(async (force = false) => {
    const currentSymbols = Array.from(
      new Set(symbolsRef.current.map(s => (s || '').toUpperCase()).filter(Boolean))
    );
    if (currentSymbols.length === 0) {
      setPrices(new Map());
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      const newPrices = new Map<string, StockPrice>();
      currentSymbols.forEach(symbol => {
        const demoPrice = DEMO_PRICES[symbol];
        if (demoPrice) {
          newPrices.set(symbol, {
            symbol,
            price: demoPrice,
            change: -2.50,
            changePercent: -1.5,
            source: 'demo',
            lastUpdated: new Date(),
          });
        }
      });
      setPrices(newPrices);
      setError(null);
      setErrorDetail(null);
      setLastUpdated(new Date());
      setOrigin('live');
      setLoading(false);
      return;
    }

    // Serve from the short-lived cache when possible
    const cached = new Map<string, StockPrice>();
    if (!force) {
      currentSymbols.forEach(s => {
        const hit = getCachedPrice(s);
        if (hit) cached.set(s, hit);
      });
      if (cached.size === currentSymbols.length) {
        setPrices(cached);
        setError(null);
        setErrorDetail(null);
        setLastUpdated(new Date(Math.max(...Array.from(cached.values()).map(p => p.lastUpdated.getTime()))));
        setOrigin('cache');
        setLoading(false);
        return;
      }
      if (cached.size > 0) setPrices(new Map(cached));
    }

    const toFetch = force ? currentSymbols : currentSymbols.filter(s => !cached.has(s));

    try {
      setLoading(true);
      const priceData = await withTimeout(fetchMarketPrices(toFetch), FETCH_TIMEOUT);

      const newPrices = new Map<string, StockPrice>(force ? [] : cached);

      Object.entries(priceData as Record<string, PriceData>).forEach(([symbol, data]) => {
        if (!data || typeof data.price !== 'number' || !isFinite(data.price)) return;
        const entry: StockPrice = {
          symbol: (data.symbol || symbol).toUpperCase(),
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          source: data.source,
          lastUpdated: new Date(data.lastUpdated),
        };
        newPrices.set(symbol.toUpperCase(), entry);
        setCachedPrice(symbol, entry);
      });

      setPrices(newPrices);
      setLastUpdated(new Date());
      setOrigin(newPrices.size > 0 && toFetch.length > 0 ? 'live' : 'cache');
      if (newPrices.size === 0) {
        setError('No price data available');
        setErrorDetail({ kind: 'empty', message: 'The price service returned an empty response' });
      } else {
        setError(null);
        setErrorDetail(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch prices:', err);
      const detail = describeError(err);
      setPrices(new Map(cached));
      setError(detail.message);
      setErrorDetail(detail);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    // Keep cached values on screen; only clear what we don't have cached
    const currentSymbols = Array.from(new Set(symbolsKey.split(',').filter(Boolean)));
    const cached = new Map<string, StockPrice>();
    currentSymbols.forEach(s => {
      const hit = getCachedPrice(s);
      if (hit) cached.set(s, hit);
    });
    setPrices(cached);
    const fullyCached = currentSymbols.length > 0 && cached.size === currentSymbols.length;
    setLoading(!fullyCached && currentSymbols.length > 0);

    // Debounce so rapid symbol changes only trigger one fetch
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchPrices(); }, fullyCached ? 0 : debounceMs);

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => fetchPrices(true), refreshInterval);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPrices, refreshInterval, symbolsKey, debounceMs]);

  // Refetch when the shared cache is cleared or the TTL setting changes.
  useEffect(() => subscribeToPriceCache(() => { fetchPrices(true); }), [fetchPrices]);

  // Prefetch the most likely next tickers (recently viewed ones) so switching back is instant.
  useEffect(() => {
    if (isDemoMode) return;
    const currentSymbols = symbolsKey.split(',').filter(Boolean);
    currentSymbols.forEach(rememberSymbol);
    const candidates = getLikelyNextSymbols(currentSymbols);
    if (candidates.length === 0) return;
    const t = setTimeout(() => { void prefetchPrices(candidates); }, 600);
    return () => clearTimeout(t);
  }, [symbolsKey, isDemoMode]);

  const getPrice = (symbol: string): StockPrice | undefined => {
    return prices.get(symbol.toUpperCase());
  };

  const refreshNow = () => {
    fetchPrices(true);
  };

  return {
    prices,
    loading,
    error,
    errorDetail,
    lastUpdated,
    origin,
    getPrice,
    refreshNow,
  };
};

// Hook for single stock with more frequent updates
export const useStockPrice = (symbol: string, refreshInterval = 10000, debounceMs = 400) => {
  const { prices, loading, error, errorDetail, lastUpdated, origin, refreshNow } = useStockPrices([symbol], refreshInterval, debounceMs);
  return {
    price: prices.get(symbol.toUpperCase()),
    loading,
    error,
    errorDetail,
    lastUpdated,
    origin,
    refreshNow,
  };
};

/** Reactive access to the cache TTL setting. */
export const usePriceCacheTtl = () => {
  const [ttl, setTtl] = useState(getPriceCacheTtl());
  useEffect(() => subscribeToPriceCache(() => setTtl(getPriceCacheTtl())), []);
  return { ttl, setTtl: setPriceCacheTtl, options: PRICE_TTL_OPTIONS };
};
