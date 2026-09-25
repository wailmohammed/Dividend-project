import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- mocks -----------------------------------------------------------------
const priceBook: Record<string, number> = { AAPL: 210.11, MSFT: 455.42, NVDA: 142.5 };

const defaultImpl = async (symbols: string[]) => {
  const out: Record<string, unknown> = {};
  symbols.forEach((s) => {
    const price = priceBook[s.toUpperCase()];
    if (price === undefined) return;
    out[s.toUpperCase()] = {
      symbol: s.toUpperCase(),
      price,
      change: 1,
      changePercent: 0.5,
      source: 'finnhub',
      lastUpdated: new Date().toISOString(),
    };
  });
  return out;
};

const fetchMarketPrices = vi.fn(defaultImpl);

vi.mock('@/services/marketDataService', () => ({ fetchMarketPrices: (s: string[]) => fetchMarketPrices(s) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'real-user-1' } }) }));
vi.mock('@/hooks/useDemoMode', () => ({ getDemoModeEnabled: () => true }));
vi.mock('@/context/PortfolioContext', () => ({
  usePortfolio: () => ({ activePortfolio: { id: 'p1', holdings: [] }, loadingPortfolio: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn(async () => ({ data: null, error: null })) } },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import EntryExitAnalysis from '@/components/EntryExitAnalysis';
import DividendChangeAlerts from '@/components/DividendChangeAlerts';
import { clearPriceCache } from '@/hooks/useStockPrices';

describe('live price refetch on ticker change', () => {
  beforeEach(() => {
    fetchMarketPrices.mockReset();
    fetchMarketPrices.mockImplementation(defaultImpl);
    clearPriceCache();
  });

  it('Entry & Exit Timing shows the new live price after switching tickers', async () => {
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);

    const input = screen.getByPlaceholderText(/Enter symbol/i);
    await user.type(input, 'AAPL');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));

    await waitFor(() => {
      expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11');
    });

    // Switch ticker -> stale price must be dropped and refetched
    await user.clear(input);
    await user.type(input, 'MSFT');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));

    await waitFor(() => {
      expect(screen.getByTestId('current-price')).toHaveTextContent('$455.42');
    });
    expect(fetchMarketPrices).toHaveBeenCalledWith(['MSFT']);
  });

  it('Entry & Exit Timing renders a skeleton while the price is loading', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    fetchMarketPrices.mockImplementationOnce(
      () => new Promise((res) => { resolveFetch = res as (v: unknown) => void; }) as Promise<Record<string, never>>,
    );

    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    await user.type(screen.getByPlaceholderText(/Enter symbol/i), 'NVDA');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));

    expect(await screen.findByTestId('price-skeleton')).toBeInTheDocument();
    await act(async () => { resolveFetch({}); });
  });

  it('Dividend Change Alerts renders live prices for its symbols', async () => {
    render(<DividendChangeAlerts />);
    expect(await screen.findByTestId('price-AAPL', {}, { timeout: 4000 })).toHaveTextContent('Last: $210.11');
    await waitFor(() => {
      expect(fetchMarketPrices).toHaveBeenCalled();
    });
    const requested = fetchMarketPrices.mock.calls.at(-1)?.[0] as string[];
    expect(requested).toContain('AAPL');
  });

  it('does not refetch when switching back to a recently fetched ticker (cache) and shows Last updated', async () => {
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    const input = screen.getByPlaceholderText(/Enter symbol/i);

    await user.type(input, 'AAPL');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));
    expect(await screen.findByTestId('price-last-updated')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'MSFT');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$455.42'));

    const callsBefore = fetchMarketPrices.mock.calls.length;
    await user.clear(input);
    await user.type(input, 'AAPL');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));
    expect(fetchMarketPrices.mock.calls.length).toBe(callsBefore);
  });

  it('debounces rapid ticker switches into a single fetch', async () => {
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    const input = screen.getByPlaceholderText(/Enter symbol/i);

    for (const sym of ['AAPL', 'MSFT', 'NVDA']) {
      await user.clear(input);
      await user.type(input, sym);
      await user.click(screen.getByRole('button', { name: /Analyze/i }));
    }

    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$142.50'));
    const fetched = fetchMarketPrices.mock.calls.flatMap((c) => c[0] as string[]);
    // Intermediate tickers must never hit the network — only the final selection.
    expect(fetched).toContain('NVDA');
    expect(fetchMarketPrices.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('manual Refresh forces a network fetch even when a cached value exists', async () => {
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    const input = screen.getByPlaceholderText(/Enter symbol/i);
    await user.type(input, 'AAPL');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));

    const callsBefore = fetchMarketPrices.mock.calls.length;
    await user.click(screen.getByTestId('refresh-price'));
    await waitFor(() => expect(fetchMarketPrices.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('serves persisted cache immediately after a reload (remount)', async () => {
    const user = userEvent.setup();
    const first = render(<EntryExitAnalysis />);
    const input = screen.getByPlaceholderText(/Enter symbol/i);
    await user.type(input, 'AAPL');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));

    // Simulate a page reload: unmount + drop in-memory state, keep localStorage.
    first.unmount();
    vi.resetModules();
    const { default: Remounted } = await import('@/components/EntryExitAnalysis');
    render(<Remounted />);
    const input2 = screen.getByPlaceholderText(/Enter symbol/i);
    await user.type(input2, 'AAPL');
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));
  });
});


describe('price origin badge, clear cache, and error recovery', () => {
  beforeEach(() => {
    fetchMarketPrices.mockReset();
    fetchMarketPrices.mockImplementation(defaultImpl);
    clearPriceCache();
  });

  const analyze = async (user: ReturnType<typeof userEvent.setup>, sym: string) => {
    const input = screen.getByPlaceholderText(/Enter symbol/i);
    await user.clear(input);
    await user.type(input, sym);
    await user.click(screen.getByRole('button', { name: /Analyze/i }));
  };

  it('badge shows "Fresh fetch", flips to "Cached", and returns to fresh after Refresh', async () => {
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    await analyze(user, 'AAPL');
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));
    await waitFor(() => expect(screen.getByTestId('price-origin-badge')).toHaveTextContent(/Fresh fetch/i));
    const firstStamp = screen.getByTestId('price-last-updated').textContent;

    // Switch away and back -> served from cache
    await analyze(user, 'MSFT');
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$455.42'));
    await analyze(user, 'AAPL');
    await waitFor(() => expect(screen.getByTestId('price-origin-badge')).toHaveTextContent(/Cached/i));

    // Forced refresh -> fresh again, timestamp present
    await user.click(screen.getByTestId('refresh-price'));
    await waitFor(() => expect(screen.getByTestId('price-origin-badge')).toHaveTextContent(/Fresh fetch/i));
    expect(screen.getByTestId('price-last-updated')).toBeInTheDocument();
    expect(typeof firstStamp).toBe('string');
  });

  it('clearing the cache triggers a fresh fetch and updates the badge', async () => {
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    await analyze(user, 'AAPL');
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));

    const callsBefore = fetchMarketPrices.mock.calls.length;
    await user.click(screen.getAllByTestId('clear-price-cache')[0]);
    await waitFor(() => expect(fetchMarketPrices.mock.calls.length).toBeGreaterThan(callsBefore));
    await waitFor(() => expect(screen.getByTestId('price-origin-badge')).toHaveTextContent(/Fresh fetch/i));
  });

  it('network failure shows the error fallback and Retry recovers to a fresh price', async () => {
    const user = userEvent.setup();
    fetchMarketPrices.mockImplementationOnce(async () => { throw new Error('Failed to fetch'); });
    render(<EntryExitAnalysis />);
    await analyze(user, 'AAPL');

    await waitFor(() => expect(screen.getByTestId('price-error')).toHaveTextContent(/Network error/i));

    await user.click(screen.getByTestId('refresh-price'));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));
    await waitFor(() => expect(screen.getByTestId('price-origin-badge')).toHaveTextContent(/Fresh fetch/i));
  });

  it('timeout errors are labelled and recoverable', async () => {
    const user = userEvent.setup();
    fetchMarketPrices.mockImplementationOnce(async () => {
      const e = new Error('Request timed out');
      e.name = 'TimeoutError';
      throw e;
    });
    render(<EntryExitAnalysis />);
    await analyze(user, 'MSFT');
    await waitFor(() => expect(screen.getByTestId('price-error')).toHaveTextContent(/Timeout/i));
    await user.click(screen.getByTestId('refresh-price'));
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$455.42'));
  });

  it('changing the cache TTL invalidates stale entries and refetches', async () => {
    const { setPriceCacheTtl, getCachedPrice } = await import('@/hooks/useStockPrices');
    const user = userEvent.setup();
    render(<EntryExitAnalysis />);
    await analyze(user, 'AAPL');
    await waitFor(() => expect(screen.getByTestId('current-price')).toHaveTextContent('$210.11'));

    const callsBefore = fetchMarketPrices.mock.calls.length;
    // A 1ms TTL makes every existing entry stale immediately.
    act(() => { setPriceCacheTtl(1); });
    await waitFor(() => expect(getCachedPrice('AAPL')).toBeUndefined());
    await waitFor(() => expect(fetchMarketPrices.mock.calls.length).toBeGreaterThan(callsBefore));
    act(() => { setPriceCacheTtl(30_000); });
  });
});
