import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, XCircle, AlertTriangle, Play, Square, RefreshCw,
  ClipboardCheck, ShieldAlert, Download, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useDemoMode } from '@/hooks/useDemoMode';
import { usePortfolio } from '@/context/PortfolioContext';
import { ViewState } from '@/types';

interface ViewDef {
  id: ViewState | string;
  label: string;
  admin?: boolean;
  loader: () => Promise<{ default: React.ComponentType<any> }>;
}

const VIEWS: ViewDef[] = [
  { id: 'dashboard', label: 'Dashboard', loader: () => import('./DashboardView') },
  { id: 'holdings', label: 'Holdings', loader: () => import('./PortfolioView') },
  { id: 'dividends', label: 'Dividends', loader: () => import('./DividendsView').then(m => ({ default: m.DividendsView })) },
  { id: 'dividend-forecast', label: 'Dividend Forecast', loader: () => import('./DividendIncomeForecast') },
  { id: 'dividend-safety', label: 'Dividend Safety', loader: () => import('./DividendSafetyDashboard') },
  { id: 'dividend-changes', label: 'Dividend Changes', loader: () => import('./DividendChangeAlerts') },
  { id: 'analytics', label: 'Analytics', loader: () => import('./AnalyticsView').then(m => ({ default: m.AnalyticsView })) },
  { id: 'performance', label: 'Performance', loader: () => import('./PerformanceComparisonView') },
  { id: 'risk-analysis', label: 'Risk Analysis', loader: () => import('./RiskAnalysisView').then(m => ({ default: m.RiskAnalysisView })) },
  { id: 'networth', label: 'Net Worth', loader: () => import('./NetWorthView') },
  { id: 'watchlist', label: 'Watchlist', loader: () => import('./WatchlistView').then(m => ({ default: m.WatchlistView })) },
  { id: 'transactions', label: 'Transactions', loader: () => import('./TransactionHistoryView').then(m => ({ default: m.TransactionHistoryView })) },
  { id: 'tax-lots', label: 'Tax Lots (incl. Loss Harvesting / Report / Quarterly)', loader: () => import('./TaxLotTracker') },
  { id: 'price-alerts', label: 'Price Alerts', loader: () => import('./PriceAlertsView') },
  { id: 'smart-alerts', label: 'Smart Alerts', loader: () => import('./SmartFundamentalAlerts') },
  { id: 'news', label: 'News Feed', loader: () => import('./NewsFeed').then(m => ({ default: m.NewsFeed })) },
  { id: 'market-overview', label: 'Market Overview', loader: () => import('./GlobalMarketOverview') },
  { id: 'market-intelligence', label: 'Market Intelligence', loader: () => import('./MarketIntelligence') },
  { id: 'screener', label: 'Stock Screener', loader: () => import('./StockScreener') },
  { id: 'discovery-hub', label: 'Discovery Hub', loader: () => import('./DiscoveryHub') },
  { id: 'earnings-calendar', label: 'Earnings Calendar', loader: () => import('./EarningsCalendar') },
  { id: 'ai-chat', label: 'AI Advisor', loader: () => import('./AIPortfolioChat') },
  { id: 'ai-projection', label: 'AI Projection', loader: () => import('./AIStockProjection') },
  { id: 'stock-report', label: 'Stock Report', loader: () => import('./UnifiedStockReport') },
  { id: 'halal-investing', label: 'Halal Investing', loader: () => import('./HalalInvestingView') },
  { id: 'retirement-planner', label: 'Retirement Planner', loader: () => import('./RetirementPlanner') },
  { id: 'market-sync', label: 'Market Sync', loader: () => import('./MarketSyncDashboard').then(m => ({ default: m.MarketSyncDashboard })) },
  { id: 'community', label: 'Community', loader: () => import('./EnhancedCommunityFeed') },
  { id: 'settings', label: 'Settings', loader: () => import('./SettingsView').then(m => ({ default: m.SettingsView })) },
  { id: 'admin', label: 'Admin Panel', admin: true, loader: () => import('./AdminView') },
  { id: 'admin-sync-logs', label: 'Admin Sync Logs', admin: true, loader: () => import('./AdminSyncLogsView') },
];

type Status = 'pending' | 'running' | 'pass' | 'fail' | 'skipped';

interface Result {
  id: string;
  label: string;
  admin: boolean;
  status: Status;
  errors: string[];
  warnings: string[];
  timestamp?: string;
  durationMs?: number;
}

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  mode: 'demo' | 'admin' | 'user';
  results: Result[];
}

const STORAGE_KEY_BY_MODE: Record<string, string> = {
  demo: 'audit_last_run_demo_v1',
  admin: 'audit_last_run_admin_v1',
  user: 'audit_last_run_user_v1',
};

class ErrorBoundary extends React.Component<
  { onError: (err: Error) => void; children?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { this.props.onError(err); }
  render() { return this.state.hasError ? null : this.props.children; }
}

const IGNORE_ERR = /MetaMask|chrome-extension/i;
const IGNORE_WARN = /defaultProps|React Router|MetaMask/i;

const AuditRunnerView: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useUserRole(user?.id);
  const { isDemoModeEnabled, enableDemoMode, disableDemoMode } = useDemoMode();
  const { switchView } = usePortfolio();

  const mode: RunSummary['mode'] = isDemoModeEnabled ? 'demo' : (isAdmin || isSuperAdmin ? 'admin' : 'user');

  const [results, setResults] = useState<Result[]>(() =>
    VIEWS.map(v => ({ id: String(v.id), label: v.label, admin: !!v.admin, status: 'pending', errors: [], warnings: [] }))
  );
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [activeComponent, setActiveComponent] = useState<React.ComponentType<any> | null>(null);
  const [runs, setRuns] = useState<{ demo: RunSummary | null; admin: RunSummary | null; user: RunSummary | null }>({
    demo: null, admin: null, user: null,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const stopRef = useRef(false);
  const mountErrorRef = useRef<Error | null>(null);

  useEffect(() => {
    try {
      const next = { demo: null as RunSummary | null, admin: null as RunSummary | null, user: null as RunSummary | null };
      (Object.keys(STORAGE_KEY_BY_MODE) as Array<keyof typeof next>).forEach(k => {
        const raw = localStorage.getItem(STORAGE_KEY_BY_MODE[k]);
        if (raw) next[k] = JSON.parse(raw);
      });
      setRuns(next);
    } catch { /* ignore */ }
  }, []);

  const runAudit = useCallback(async () => {
    stopRef.current = false;
    setRunning(true);
    const startedAt = new Date().toISOString();
    const fresh: Result[] = VIEWS.map(v => ({
      id: String(v.id), label: v.label, admin: !!v.admin,
      status: 'pending', errors: [], warnings: [],
    }));
    setResults(fresh);

    const originalError = console.error;
    const originalWarn = console.warn;
    let capturedErrors: string[] = [];
    let capturedWarnings: string[] = [];
    console.error = (...args: any[]) => {
      capturedErrors.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(' '));
      originalError(...args);
    };
    console.warn = (...args: any[]) => {
      capturedWarnings.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(' '));
      originalWarn(...args);
    };
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      capturedErrors.push(`UnhandledRejection: ${(e.reason as any)?.message || String(e.reason)}`);
    };
    window.addEventListener('unhandledrejection', rejectionHandler);

    try {
      for (let i = 0; i < VIEWS.length; i++) {
        if (stopRef.current) break;
        const view = VIEWS[i];
        setCurrentIndex(i);

        const isAdminOnly = !!view.admin;
        const canRun = !isAdminOnly || isAdmin || isSuperAdmin;
        if (!canRun) {
          fresh[i] = { ...fresh[i], status: 'skipped', timestamp: new Date().toISOString(), errors: ['Skipped — admin role required'] };
          setResults([...fresh]);
          continue;
        }

        fresh[i] = { ...fresh[i], status: 'running', timestamp: new Date().toISOString() };
        setResults([...fresh]);

        capturedErrors = [];
        capturedWarnings = [];
        mountErrorRef.current = null;
        const start = performance.now();

        let Component: React.ComponentType<any> | null = null;
        try {
          const mod = await view.loader();
          Component = mod.default;
        } catch (err: any) {
          mountErrorRef.current = err;
        }

        if (Component && !mountErrorRef.current) {
          setActiveComponent(() => Component!);
          // Allow render + effects to run
          await new Promise(r => setTimeout(r, 650));
          setActiveComponent(null);
          // Allow unmount/cleanup
          await new Promise(r => setTimeout(r, 50));
        }

        const duration = Math.round(performance.now() - start);
        const errs = [...capturedErrors];
        if (mountErrorRef.current) errs.unshift(mountErrorRef.current.message || String(mountErrorRef.current));

        const filteredErr = errs.filter(e => !IGNORE_ERR.test(e));
        const filteredWarn = capturedWarnings.filter(w => !IGNORE_WARN.test(w));

        fresh[i] = {
          ...fresh[i],
          status: filteredErr.length > 0 ? 'fail' : 'pass',
          errors: filteredErr.slice(0, 5),
          warnings: filteredWarn.slice(0, 3),
          timestamp: new Date().toISOString(),
          durationMs: duration,
        };
        setResults([...fresh]);
      }
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('unhandledrejection', rejectionHandler);
      setCurrentIndex(-1);
      setActiveComponent(null);
      setRunning(false);

      const summary: RunSummary = {
        startedAt,
        finishedAt: new Date().toISOString(),
        mode,
        results: fresh,
      };
      try { localStorage.setItem(STORAGE_KEY_BY_MODE[mode], JSON.stringify(summary)); } catch { /* ignore */ }
      setRuns(prev => ({ ...prev, [mode]: summary }));
    }
  }, [isAdmin, isSuperAdmin, mode]);

  const stop = () => { stopRef.current = true; };

  const exportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      runs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openView = (id: string) => {
    try { switchView(id as ViewState); } catch { /* unknown view */ }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totals = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<Status, number>);

  const completed = (totals.pass || 0) + (totals.fail || 0) + (totals.skipped || 0);
  const pct = Math.round((completed / results.length) * 100);

  // Mount host via portal — keeps React context (Auth/Portfolio) intact
  const hostRef = useRef<HTMLDivElement | null>(null);

  const failedNow = results.filter(r => r.status === 'fail');

  const SummaryCard = ({ label, run }: { label: string; run: RunSummary | null }) => {
    const t = run?.results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1; return acc;
    }, {} as Record<Status, number>);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="uppercase tracking-wide">{label}</span>
            {run && <Badge variant="outline" className="text-[10px]">{new Date(run.finishedAt).toLocaleString()}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {run ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-500 font-semibold">{t?.pass || 0} pass</span>
              <span className="text-destructive font-semibold">{t?.fail || 0} fail</span>
              <span className="text-warning font-semibold">{t?.skipped || 0} skip</span>
              <span className="text-muted-foreground ml-auto">{run.results.length} total</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No run yet for this mode.</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const ActiveComponent = activeComponent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" /> Audit Runner
          </h2>
          <p className="text-muted-foreground text-sm">
            Walks every major view, captures console errors, and reports pass/fail per route.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/30">
            <Switch
              id="audit-demo-mode"
              checked={isDemoModeEnabled}
              onCheckedChange={(v) => v ? enableDemoMode() : disableDemoMode()}
              disabled={running}
            />
            <Label htmlFor="audit-demo-mode" className="text-xs cursor-pointer">Demo data</Label>
          </div>
          <Badge variant="outline" className="gap-1">
            Mode: <span className="font-semibold uppercase">{mode}</span>
          </Badge>
          {running ? (
            <Button variant="destructive" size="sm" onClick={stop} className="gap-1.5">
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={runAudit} className="gap-1.5">
              <Play className="w-3.5 h-3.5" /> Run audit
            </Button>
          )}
          {!running && (runs.demo || runs.admin || runs.user) && (
            <Button size="sm" variant="outline" onClick={exportJSON} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export JSON
            </Button>
          )}
        </div>
      </div>

      {/* Cross-mode summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Demo run" run={runs.demo} />
        <SummaryCard label="Admin run" run={runs.admin} />
        <SummaryCard label="User run" run={runs.user} />
      </div>

      {/* Current-run totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 pb-3 text-center">
          <div className="text-2xl font-bold">{results.length}</div>
          <div className="text-xs text-muted-foreground">Total views</div>
        </CardContent></Card>
        <Card className="border-emerald-500/30"><CardContent className="pt-4 pb-3 text-center">
          <div className="text-2xl font-bold text-emerald-500">{totals.pass || 0}</div>
          <div className="text-xs text-muted-foreground">Passed</div>
        </CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="pt-4 pb-3 text-center">
          <div className="text-2xl font-bold text-destructive">{totals.fail || 0}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </CardContent></Card>
        <Card className="border-warning/30"><CardContent className="pt-4 pb-3 text-center">
          <div className="text-2xl font-bold text-warning">{totals.skipped || 0}</div>
          <div className="text-xs text-muted-foreground">Skipped</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 text-center">
          <div className="text-2xl font-bold">{pct}%</div>
          <div className="text-xs text-muted-foreground">Complete</div>
        </CardContent></Card>
      </div>

      {running && (
        <div>
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground mt-1.5">
            {currentIndex >= 0 ? `Testing: ${results[currentIndex]?.label}…` : 'Preparing…'}
          </p>
        </div>
      )}

      {/* Hidden mount host — portal keeps React context */}
      <div
        ref={hostRef}
        aria-hidden
        style={{ position: 'fixed', left: -99999, top: 0, width: 1280, height: 800, overflow: 'hidden', pointerEvents: 'none', opacity: 0 }}
      />
      {hostRef.current && ActiveComponent && createPortal(
        <ErrorBoundary onError={(e) => { mountErrorRef.current = e; }}>
          <Suspense fallback={null}>
            <ActiveComponent />
          </Suspense>
        </ErrorBoundary>,
        hostRef.current,
      )}

      {/* Quick failures list with deep links */}
      {failedNow.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              Failed views ({failedNow.length})
            </CardTitle>
            <CardDescription>Click a row to open the view, or expand to see captured errors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {failedNow.map(r => (
              <div key={r.id} className="rounded-md border border-destructive/30 bg-destructive/5 overflow-hidden">
                <div className="flex items-center gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => toggleExpand(r.id)}
                    className="p-0.5 hover:bg-destructive/10 rounded"
                    aria-label="Toggle details"
                  >
                    {expanded.has(r.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.label}</span>
                  <code className="text-[10px] text-muted-foreground">{r.id}</code>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => openView(r.id)}>
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </Button>
                </div>
                {expanded.has(r.id) && (
                  <ul className="px-3 pb-2 space-y-0.5">
                    {r.errors.map((e, i) => (
                      <li key={i} className="text-[11px] text-destructive break-all">• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Results</CardTitle>
          <CardDescription>
            {runs[mode]
              ? `Last ${mode} run: ${new Date(runs[mode]!.finishedAt).toLocaleString()}`
              : 'No prior run for this mode. Click "Run audit" to begin.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {results.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-muted/20">
                <div className="mt-0.5">
                  {r.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {r.status === 'fail' && <XCircle className="w-4 h-4 text-destructive" />}
                  {r.status === 'skipped' && <ShieldAlert className="w-4 h-4 text-warning" />}
                  {r.status === 'pending' && <div className="w-4 h-4 rounded-full border border-border" />}
                  {r.status === 'running' && <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openView(r.id)}
                      className="text-sm font-medium hover:underline text-left"
                    >
                      {r.label}
                    </button>
                    <code className="text-[10px] text-muted-foreground">{r.id}</code>
                    {r.admin && <Badge variant="outline" className="h-4 text-[10px] px-1.5 border-warning/40 text-warning">admin</Badge>}
                    {r.durationMs !== undefined && <span className="text-[10px] text-muted-foreground">{r.durationMs}ms</span>}
                    {r.timestamp && <span className="text-[10px] text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString()}</span>}
                  </div>
                  {r.errors.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {r.errors.map((e, i) => (
                        <li key={i} className="text-[11px] text-destructive flex items-start gap-1">
                          <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">{e}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.warnings.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {r.warnings.map((w, i) => (
                        <li key={i} className="text-[11px] text-warning flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">{w}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditRunnerView;
