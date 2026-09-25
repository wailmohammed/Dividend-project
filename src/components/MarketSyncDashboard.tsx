import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  Database,
  Zap,
  BarChart3,
  FlaskConical
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

interface SyncLog {
  id: string;
  sync_type: string;
  symbols_count: number;
  success_count: number;
  error_count: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface SymbolError {
  symbol: string;
  error: string;
  timestamp: string;
}

interface MarketDataCacheRow {
  symbol: string;
  price: number | null;
  source: string | null;
  updated_at: string;
}

interface SyncStats {
  totalSyncs: number;
  successRate: number;
  avgDuration: number;
  lastSync: SyncLog | null;
  totalSymbolsProcessed: number;
  totalErrors: number;
  recentErrors: SymbolError[];
}

const parseSymbolErrors = (log: SyncLog): SymbolError[] => {
  if (!log.error_message) return [];

  try {
    const parsed = JSON.parse(log.error_message);
    if (Array.isArray(parsed)) {
      return parsed.map((err: any) => ({
        symbol: err.symbol || 'Unknown',
        error: err.error || err.message || 'Unknown error',
        timestamp: log.created_at,
      }));
    }
  } catch {
    // Fall through to single-message display.
  }

  return [{ symbol: 'Multiple', error: log.error_message, timestamp: log.created_at }];
};

export const MarketSyncDashboard = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [checkingDividends, setCheckingDividends] = useState(false);
  const [cacheRows, setCacheRows] = useState<MarketDataCacheRow[]>([]);

  const fetchLogs = async () => {
    try {
      const [{ data, error }, { data: marketCache, error: cacheError }] = await Promise.all([
        supabase
          .from('market_sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('market_data_cache')
          .select('symbol, price, source, updated_at')
          .order('updated_at', { ascending: true })
          .limit(200),
      ]);

      if (error) throw error;
      if (cacheError) throw cacheError;

      setLogs(data || []);
      setCacheRows(marketCache || []);

      // Calculate stats
      if (data && data.length > 0) {
        const totalSuccesses = data.reduce((sum, log) => sum + log.success_count, 0);
        const totalProcessed = data.reduce((sum, log) => sum + log.symbols_count, 0);
        const successRate = totalProcessed > 0 ? (totalSuccesses / totalProcessed) * 100 : 0;
        const avgDuration = data.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / data.length;
        const totalErrors = data.reduce((sum, log) => sum + log.error_count, 0);

        // Parse symbol-level errors from error_message field
        const recentErrors: SymbolError[] = [];
        data.forEach(log => {
          recentErrors.push(...parseSymbolErrors(log));
        });

        setStats({
          totalSyncs: data.length,
          successRate,
          avgDuration,
          lastSync: data[0],
          totalSymbolsProcessed: totalProcessed,
          totalErrors,
          recentErrors: recentErrors.slice(0, 10) // Keep last 10 errors
        });
      }
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
      toast.error('Failed to load sync history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-sync');
      
      if (error) throw error;
      
      toast.success(`Sync complete: ${data.successCount} symbols updated`);
      await fetchLogs();
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      toast.error('Sync failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckAlerts = async () => {
    setCheckingAlerts(true);
    try {
      const { data, error } = await supabase.functions.invoke('alert-check');
      
      if (error) throw error;
      
      toast.success(`Alerts checked: ${data.alertsTriggered || 0} triggered`);
    } catch (err: any) {
      console.error('Alert check failed:', err);
      toast.error('Alert check failed: ' + (err.message || 'Unknown error'));
    } finally {
      setCheckingAlerts(false);
    }
  };

  const handleCheckDividends = async () => {
    setCheckingDividends(true);
    try {
      const { data, error } = await supabase.functions.invoke('dividend-reminders');
      
      if (error) throw error;
      
      toast.success(`Dividend reminders: ${data.emailsSent || 0} emails sent`);
    } catch (err: any) {
      console.error('Dividend reminder check failed:', err);
      toast.error('Dividend check failed: ' + (err.message || 'Unknown error'));
    } finally {
      setCheckingDividends(false);
    }
  };

  // Prepare chart data for success rate over time
  const chartData = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    
    return logs
      .slice(0, 20)
      .reverse()
      .map((log, index) => {
        const successRate = log.symbols_count > 0 
          ? ((log.success_count / log.symbols_count) * 100)
          : 100;
        return {
          name: format(parseISO(log.created_at), 'MMM dd HH:mm'),
          successRate: Math.round(successRate * 10) / 10,
          errors: log.error_count,
          success: log.success_count,
          total: log.symbols_count,
        };
      });
  }, [logs]);

  const dataCoverage = useMemo(() => {
    const now = Date.now();
    const staleRows = cacheRows.filter(row => now - new Date(row.updated_at).getTime() > 12 * 60 * 60 * 1000);
    const providerCounts = cacheRows.reduce<Record<string, number>>((acc, row) => {
      const source = row.source || 'unknown';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    return {
      total: cacheRows.length,
      staleRows: staleRows.slice(0, 6),
      staleCount: staleRows.length,
      providerCounts,
      latestUpdate: cacheRows.length
        ? cacheRows.reduce((latest, row) => new Date(row.updated_at) > new Date(latest.updated_at) ? row : latest, cacheRows[0])
        : null,
    };
  }, [cacheRows]);

  const getSyncStatusBadge = (log: SyncLog) => {
    if (log.error_count > 0 && log.success_count === 0) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
    }
    if (log.error_count > 0 && log.success_count > 0) {
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 gap-1"><AlertTriangle className="w-3 h-3" /> Partial</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/20 text-green-500 gap-1"><CheckCircle className="w-3 h-3" /> Success</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample sync data. Sign in to manage real market data synchronization.
          </AlertDescription>
        </Alert>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Market Data Sync Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Monitor and manage market data synchronization</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCheckDividends}
            disabled={checkingDividends}
          >
            {checkingDividends ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Check Dividends
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCheckAlerts}
            disabled={checkingAlerts}
          >
            {checkingAlerts ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4 mr-2" />
            )}
            Check Alerts
          </Button>
          <Button 
            onClick={handleManualSync}
            disabled={syncing}
          >
            {syncing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Total Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalSyncs || 0}</div>
            <p className="text-sm text-muted-foreground">Last 50 operations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">
              {stats?.successRate.toFixed(1) || 0}%
            </div>
            <p className="text-sm text-muted-foreground">
              {stats?.totalSymbolsProcessed || 0} symbols processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.avgDuration ? (stats.avgDuration / 1000).toFixed(1) : 0}s
            </div>
            <p className="text-sm text-muted-foreground">Per sync operation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {stats?.totalErrors || 0}
            </div>
            <p className="text-sm text-muted-foreground">Failed symbol updates</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Market Data Coverage
          </CardTitle>
          <CardDescription>Provider mix, stale quotes, and symbols that need attention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-2xl font-bold text-foreground">{dataCoverage.total}</div>
              <div className="text-xs text-muted-foreground">Cached symbols tracked</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-2xl font-bold text-foreground">
                {dataCoverage.latestUpdate
                  ? formatDistanceToNow(new Date(dataCoverage.latestUpdate.updated_at), { addSuffix: true })
                  : 'Never'}
              </div>
              <div className="text-xs text-muted-foreground">Latest quote update</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-2xl font-bold text-foreground">{dataCoverage.staleCount}</div>
              <div className="text-xs text-muted-foreground">Quotes older than 12 hours</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(dataCoverage.providerCounts).map(([source, count]) => (
              <Badge key={source} variant="outline" className="capitalize">
                {source}: {count}
              </Badge>
            ))}
          </div>

          {dataCoverage.staleRows.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="mb-2 text-sm font-medium text-destructive">Oldest quote updates</div>
              <div className="flex flex-wrap gap-2">
                {dataCoverage.staleRows.map(row => (
                  <Badge key={row.symbol} variant="outline" className="gap-1 font-mono">
                    {row.symbol}
                    <span className="font-sans text-muted-foreground">
                      {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Rate Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Sync Success Rate Over Time
            </CardTitle>
            <CardDescription>Historical success rate for the last 20 syncs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                            <p className="text-sm font-medium mb-1">{label}</p>
                            <p className="text-sm text-green-500">
                              Success Rate: {payload[0].value}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payload[0].payload.success} / {payload[0].payload.total} symbols
                            </p>
                            {payload[0].payload.errors > 0 && (
                              <p className="text-xs text-red-500">
                                {payload[0].payload.errors} errors
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="successRate" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#successGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Sync Info */}
      {stats?.lastSync && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-lg font-bold">
                  {formatDistanceToNow(new Date(stats.lastSync.created_at), { addSuffix: true })}
                </span>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(stats.lastSync.created_at), 'MMM dd, yyyy HH:mm:ss')}
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-lg font-bold text-green-500">{stats.lastSync.success_count}</span>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div>
                <span className="text-lg font-bold text-red-500">{stats.lastSync.error_count}</span>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
              <div>
                <span className="text-lg font-bold">{stats.lastSync.symbols_count}</span>
                <p className="text-xs text-muted-foreground">Total Symbols</p>
              </div>
              {stats.lastSync.duration_ms && (
                <div>
                  <span className="text-lg font-bold">{(stats.lastSync.duration_ms / 1000).toFixed(1)}s</span>
                  <p className="text-xs text-muted-foreground">Duration</p>
                </div>
              )}
              {getSyncStatusBadge(stats.lastSync)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent market data synchronization operations</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map(log => (
                <div 
                  key={log.id}
                  className={`p-4 rounded-lg border ${
                    log.error_message 
                      ? 'bg-red-500/5 border-red-500/20' 
                      : log.error_count > 0 
                        ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {getSyncStatusBadge(log)}
                      <span className="text-sm font-medium capitalize">{log.sync_type}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-500">{log.success_count} ✓</span>
                      <span className="text-red-500">{log.error_count} ✗</span>
                      <span className="text-muted-foreground">{log.symbols_count} total</span>
                      {log.duration_ms && (
                        <span className="text-muted-foreground">{(log.duration_ms / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                  {log.error_message && (
                    <div className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                      {parseSymbolErrors(log).map((err) => (
                        <div key={`${log.id}-${err.symbol}`} className="font-mono">
                          {err.symbol}: {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No sync history available</p>
              <p className="text-sm mt-1">Click "Sync Now" to start syncing market data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Symbol-Level Errors */}
      {stats?.recentErrors && stats.recentErrors.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="w-5 h-5" />
              Recent Symbol Errors
            </CardTitle>
            <CardDescription>Symbols that failed to update in recent syncs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentErrors.map((err, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">{err.symbol}</Badge>
                    <span className="text-sm text-muted-foreground">{err.error}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(err.timestamp), 'MMM dd, HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};