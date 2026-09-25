import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, AlertTriangle, Bell, ChevronRight, Minus, Info, Loader2, FlaskConical, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStockPrices } from '@/hooks/useStockPrices';
import PriceCacheControls from '@/components/PriceCacheControls';


interface DividendChange {
  id: string;
  symbol: string;
  name: string;
  type: 'increase' | 'decrease' | 'suspended' | 'initiated';
  previousAmount: number;
  newAmount: number;
  changePercent: number;
  announcedDate: string;
  effectiveDate: string;
  consecutiveYears?: number;
  analystNote?: string;
  isInPortfolio: boolean;
}

// Demo data only for demo mode
const DEMO_CHANGES: DividendChange[] = [
  { id: '1', symbol: 'AAPL', name: 'Apple Inc.', type: 'increase', previousAmount: 0.24, newAmount: 0.25, changePercent: 4.17, announcedDate: '2026-02-20', effectiveDate: '2026-03-15', consecutiveYears: 13, analystNote: 'Continued commitment to returning cash to shareholders. Payout ratio remains healthy at 15%.', isInPortfolio: true },
  { id: '2', symbol: 'JNJ', name: 'Johnson & Johnson', type: 'increase', previousAmount: 1.19, newAmount: 1.24, changePercent: 4.20, announcedDate: '2026-02-18', effectiveDate: '2026-03-10', consecutiveYears: 62, analystNote: 'Dividend King status maintained. Strong free cash flow supports continued growth.', isInPortfolio: true },
  { id: '3', symbol: 'INTC', name: 'Intel Corp', type: 'decrease', previousAmount: 0.365, newAmount: 0.125, changePercent: -65.75, announcedDate: '2026-02-15', effectiveDate: '2026-03-01', analystNote: 'Cut to preserve cash for foundry investments. Recovery timeline uncertain.', isInPortfolio: false },
  { id: '4', symbol: 'VZ', name: 'Verizon Communications', type: 'increase', previousAmount: 0.6650, newAmount: 0.6775, changePercent: 1.88, announcedDate: '2026-02-12', effectiveDate: '2026-03-01', consecutiveYears: 19, analystNote: 'Modest increase reflecting cautious approach amid debt reduction efforts.', isInPortfolio: true },
  { id: '5', symbol: 'LUMN', name: 'Lumen Technologies', type: 'suspended', previousAmount: 0.25, newAmount: 0, changePercent: -100, announcedDate: '2026-02-10', effectiveDate: '2026-03-01', analystNote: 'Dividend suspended to focus on debt reduction and fiber network expansion.', isInPortfolio: false },
  { id: '6', symbol: 'META', name: 'Meta Platforms', type: 'initiated', previousAmount: 0, newAmount: 0.50, changePercent: 100, announcedDate: '2026-02-08', effectiveDate: '2026-03-26', analystNote: 'First-ever dividend! Signals maturity and strong cash generation from advertising.', isInPortfolio: true },
];

const DividendChangeAlerts: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio } = usePortfolio();
  const [filter, setFilter] = useState<'all' | 'portfolio' | 'increases' | 'cuts'>('all');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [changes, setChanges] = useState<DividendChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userHoldingSymbols, setUserHoldingSymbols] = useState<string[]>([]);

  const holdingSymbols = activePortfolio?.holdings?.map(h => h.symbol) || [];
  const monitoredSymbols = Array.from(
    new Set(
      (userHoldingSymbols.length ? userHoldingSymbols : holdingSymbols)
        .map((s) => s?.toUpperCase())
        .filter((s): s is string => Boolean(s))
    )
  );

  const fetchUserHoldingSymbols = useCallback(async () => {
    if (isDemoMode || !user?.id) {
      setUserHoldingSymbols([]);
      return;
    }

    try {
      const { data: portfolios, error: portfoliosError } = await supabase
        .from('portfolios')
        .select('id')
        .eq('user_id', user.id);

      if (portfoliosError) throw portfoliosError;

      const portfolioIds = (portfolios || []).map((p) => p.id);
      if (!portfolioIds.length) {
        setUserHoldingSymbols([]);
        return;
      }

      const { data: holdingsData, error: holdingsError } = await supabase
        .from('holdings')
        .select('symbol')
        .in('portfolio_id', portfolioIds);

      if (holdingsError) throw holdingsError;

      setUserHoldingSymbols(
        Array.from(
          new Set(
            (holdingsData || [])
              .map((h) => h.symbol?.toUpperCase())
              .filter((s): s is string => Boolean(s))
          )
        )
      );
    } catch (err) {
      console.error('Failed to load holding symbols for dividend changes:', err);
      setUserHoldingSymbols([]);
    }
  }, [isDemoMode, user?.id]);

  useEffect(() => {
    fetchUserHoldingSymbols();
  }, [fetchUserHoldingSymbols]);

  const fetchLiveChanges = useCallback(async () => {
    if (isDemoMode) {
      setChanges(DEMO_CHANGES);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch dividend changes from portfolio_updates table
      const { data, error } = await supabase
        .from('portfolio_updates')
        .select('*')
        .eq('user_id', user!.id)
        .eq('update_type', 'dividend_change')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: DividendChange[] = data.map(d => ({
          id: d.id,
          symbol: d.symbol,
          name: d.title.replace(/\s+Dividend.*$/, ''),
          type: (d.details as any)?.change_pct > 0 ? 'increase' : (d.details as any)?.change_pct === -100 ? 'suspended' : 'decrease',
          previousAmount: (d.details as any)?.previous || 0,
          newAmount: (d.details as any)?.current || 0,
          changePercent: (d.details as any)?.change_pct || 0,
          announcedDate: (d.details as any)?.date || d.created_at.split('T')[0],
          effectiveDate: (d.details as any)?.effective_date || d.created_at.split('T')[0],
          analystNote: d.summary || undefined,
          isInPortfolio: monitoredSymbols.includes(d.symbol?.toUpperCase()),
        }));
        setChanges(mapped);
      } else {
        setChanges([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch dividend changes:', err);
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, user, monitoredSymbols.join(',')]);

  useEffect(() => {
    fetchLiveChanges();
  }, [fetchLiveChanges]);

  const [autoChecked, setAutoChecked] = useState(false);
  useEffect(() => {
    if (isDemoMode || autoChecked || loading || !user) return;
    if (changes.length === 0 && monitoredSymbols.length > 0) {
      setAutoChecked(true);
      generateAIChanges();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, changes.length, monitoredSymbols.length, isDemoMode, user, autoChecked]);

  const generateAIChanges = useCallback(async () => {
    if (isDemoMode || !user || monitoredSymbols.length === 0) {
      toast.info('Add holdings to your portfolio to track dividend changes');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-updates', {
        body: { action: 'check_updates', user_id: user!.id, symbols: monitoredSymbols },
      });
      if (error) throw error;
      toast.success(`Dividend change alerts refreshed (${data?.inserted ?? 0} new)`);
      await fetchLiveChanges();
    } catch (err: any) {
      const status = err?.context?.status ? ` (${err.context.status})` : '';
      toast.error(`Failed to generate alerts${status}: ${err.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  }, [isDemoMode, user, monitoredSymbols, fetchLiveChanges]);

  const priceSymbols = React.useMemo(
    () => Array.from(new Set(changes.map(c => c.symbol?.toUpperCase()).filter(Boolean) as string[])),
    [changes.map(c => c.symbol).join(',')]
  );
  const { prices, loading: pricesLoading, error: pricesError, errorDetail: pricesErrorDetail, lastUpdated: pricesLastUpdated, origin: pricesOrigin, refreshNow: refreshPrices } = useStockPrices(priceSymbols, 60000);
  const priceFeedDown = priceSymbols.length > 0 && !pricesLoading && (prices.size === 0 || !!pricesError);
  const priceErrorLabel = pricesErrorDetail
    ? `${pricesErrorDetail.kind === 'timeout' ? 'Timeout' : pricesErrorDetail.kind === 'not_found' ? 'Not found (404)' : pricesErrorDetail.kind === 'empty' ? 'Empty response' : pricesErrorDetail.kind === 'network' ? 'Network error' : 'Error'}: ${pricesErrorDetail.message}`
    : pricesError || 'No data returned';
  const pricesUpdatedLabel = pricesLastUpdated
    ? pricesLastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const filteredChanges = changes.filter(c => {

    if (filter === 'portfolio') return monitoredSymbols.includes(c.symbol?.toUpperCase()) || c.isInPortfolio;
    if (filter === 'increases') return c.type === 'increase' || c.type === 'initiated';
    if (filter === 'cuts') return c.type === 'decrease' || c.type === 'suspended';
    return true;
  });

  const getTypeConfig = (type: DividendChange['type']) => {
    switch (type) {
      case 'increase': return { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Increase' };
      case 'decrease': return { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Cut' };
      case 'suspended': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Suspended' };
      case 'initiated': return { icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'New Dividend' };
    }
  };

  const impactOnPortfolio = changes.filter(c => monitoredSymbols.includes(c.symbol?.toUpperCase()) || c.isInPortfolio).reduce((acc, c) => {
    return acc + ((c.newAmount - c.previousAmount) * 4 * 100);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Dividend Change Alerts
        </h2>
        <div className="flex items-center gap-3">
          {!isDemoMode && (
            <Button variant="outline" size="sm" className="gap-2" onClick={generateAIChanges} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </Button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Alerts</span>
            <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
          </div>
        </div>
      </div>

      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
            Demo mode — showing sample data. Sign in to track real dividend changes for your portfolio.
          </AlertDescription>
        </Alert>
      )}

      {priceFeedDown && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3">
            <span data-testid="price-error">Live prices are unavailable right now — {priceErrorLabel}. Dividend data below is still accurate.</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={refreshPrices}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {priceSymbols.length > 0 && !priceFeedDown && (
        <div className="flex items-center gap-2 flex-wrap">
          {pricesOrigin && (
            <Badge
              variant="outline"
              className={`text-[10px] font-normal ${pricesOrigin === 'cache' ? 'border-amber-400/60 text-amber-600 dark:text-amber-400' : 'border-emerald-400/60 text-emerald-600 dark:text-emerald-400'}`}
              data-testid="prices-origin-badge"
            >
              {pricesOrigin === 'cache' ? 'Cached' : 'Fresh fetch'}{pricesUpdatedLabel ? ` · ${pricesUpdatedLabel}` : ''}
            </Badge>
          )}
          {pricesUpdatedLabel && (
            <p className="text-[11px] text-muted-foreground" data-testid="prices-last-updated">
              Prices last updated {pricesUpdatedLabel}
            </p>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] gap-1"
            onClick={refreshPrices}
            disabled={pricesLoading}
            data-testid="refresh-prices"
          >
            <RefreshCw className={`w-3 h-3 ${pricesLoading ? 'animate-spin' : ''}`} /> Refresh prices
          </Button>
          <PriceCacheControls />
        </div>
      )}


      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Increases</div>
            <div className="text-2xl font-bold text-emerald-500">{changes.filter(c => c.type === 'increase').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Cuts / Suspended</div>
            <div className="text-2xl font-bold text-red-500">{changes.filter(c => c.type === 'decrease' || c.type === 'suspended').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">New Dividends</div>
            <div className="text-2xl font-bold text-blue-500">{changes.filter(c => c.type === 'initiated').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium mb-1">Portfolio Impact</div>
            <div className={`text-2xl font-bold ${impactOnPortfolio >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {impactOnPortfolio >= 0 ? '+' : ''}${Math.abs(impactOnPortfolio).toFixed(0)}/yr
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'portfolio', 'increases', 'cuts'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="text-xs capitalize">
            {f === 'all' ? 'All Changes' : f === 'portfolio' ? 'My Holdings' : f}
          </Button>
        ))}
      </div>

      {/* Changes List */}
      {filteredChanges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {isDemoMode
                ? 'No changes match this filter.'
                : monitoredSymbols.length === 0
                  ? 'No holdings found yet. Add holdings to start monitoring dividend changes.'
                  : 'No dividend changes detected yet. Click "Refresh" to scan your holdings.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredChanges.map(change => {
            const config = getTypeConfig(change.type);
            const isExpanded = expandedId === change.id;

            return (
              <Card key={change.id} className={`${config.border} border transition-all hover:shadow-sm cursor-pointer`} onClick={() => setExpandedId(isExpanded ? null : change.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.bg}`}>
                      <config.icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{change.symbol}</span>
                        <Badge variant="outline" className="text-[10px]">{config.label}</Badge>
                        {change.isInPortfolio && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">In Portfolio</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{change.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${config.color}`}>
                        {change.changePercent >= 0 ? '+' : ''}{change.changePercent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">${change.previousAmount.toFixed(2)} → ${change.newAmount.toFixed(2)}</p>
                      {pricesLoading && !prices.get(change.symbol?.toUpperCase()) ? (
                        <Skeleton className="h-3 w-16 ml-auto mt-1" data-testid="price-skeleton" />
                      ) : prices.get(change.symbol?.toUpperCase()) ? (
                        <p className="text-[10px] text-muted-foreground/80" data-testid={`price-${change.symbol?.toUpperCase()}`}>
                          {`Last: $${prices.get(change.symbol.toUpperCase())!.price.toFixed(2)}`}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); refreshPrices(); }}
                          className="text-[10px] text-muted-foreground/80 underline underline-offset-2 hover:text-foreground inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> Price n/a — retry
                        </button>
                      )}
                    </div>

                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Announced:</span>
                          <span className="ml-1 text-foreground font-medium">{change.announcedDate}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Effective:</span>
                          <span className="ml-1 text-foreground font-medium">{change.effectiveDate}</span>
                        </div>
                        {change.consecutiveYears && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Streak:</span>
                            <span className="ml-1 text-foreground font-medium">{change.consecutiveYears} consecutive years</span>
                          </div>
                        )}
                      </div>
                      {change.analystNote && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                          <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground leading-relaxed">{change.analystNote}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DividendChangeAlerts;
