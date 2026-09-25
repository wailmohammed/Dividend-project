import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert as UIAlert, AlertDescription as UIAlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Zap, TrendingUp, TrendingDown, DollarSign, Star, Search, X, Trash2, ChevronDown, ChevronUp,
  RefreshCw, CheckCheck, FlaskConical, Newspaper, Filter, ArrowUpCircle, ArrowDownCircle, Target, AlertTriangle,
  Building2, User, Calendar, BarChart3, Info, Download
} from 'lucide-react';
import { toast } from 'sonner';

interface PortfolioUpdate {
  id: string;
  user_id: string;
  symbol: string;
  update_type: string;
  title: string;
  summary: string | null;
  details: Record<string, any>;
  significance: string;
  is_read: boolean;
  created_at: string;
}

type FilterType = 'all' | 'earnings_surprise' | 'dividend_change' | 'rating_upgrade' | 'rating_downgrade' | 'price_target_change';

const DEMO_UPDATES: PortfolioUpdate[] = [
  { id: '1', user_id: 'demo', symbol: 'AAPL', update_type: 'earnings_surprise', title: 'AAPL Beat Earnings by 12.3%', summary: 'Actual EPS: $2.18 vs Est: $1.94 (2026-01-30)', details: { surprise_pct: 12.3, actual: 2.18, estimated: 1.94, date: '2026-01-30' }, significance: 'high', is_read: false, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: '2', user_id: 'demo', symbol: 'MSFT', update_type: 'rating_upgrade', title: 'MSFT Upgraded by Goldman Sachs', summary: 'Hold → Buy (2026-02-10)', details: { company: 'Goldman Sachs', from: 'Hold', to: 'Buy', date: '2026-02-10' }, significance: 'high', is_read: false, created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: '3', user_id: 'demo', symbol: 'JNJ', update_type: 'dividend_change', title: 'JNJ Dividend Increased by 5.2%', summary: '$1.19 → $1.25 per share', details: { change_pct: 5.2, previous: 1.19, current: 1.25, date: '2026-02-08' }, significance: 'medium', is_read: true, created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: '4', user_id: 'demo', symbol: 'GOOGL', update_type: 'earnings_surprise', title: 'GOOGL Missed Earnings by -6.1%', summary: 'Actual EPS: $1.85 vs Est: $1.97 (2026-02-04)', details: { surprise_pct: -6.1, actual: 1.85, estimated: 1.97, date: '2026-02-04' }, significance: 'medium', is_read: true, created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
  { id: '5', user_id: 'demo', symbol: 'T', update_type: 'rating_downgrade', title: 'T Downgraded by Morgan Stanley', summary: 'Overweight → Equal Weight (2026-02-12)', details: { company: 'Morgan Stanley', from: 'Overweight', to: 'Equal Weight', date: '2026-02-12' }, significance: 'high', is_read: false, created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: '6', user_id: 'demo', symbol: 'KO', update_type: 'dividend_change', title: 'KO Dividend Increased by 3.8%', summary: '$0.46 → $0.48 per share', details: { change_pct: 3.8, previous: 0.46, current: 0.48, date: '2026-02-01' }, significance: 'medium', is_read: true, created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: '7', user_id: 'demo', symbol: 'NVDA', update_type: 'price_target_change', title: 'NVDA Price Target Set to $185 by Morgan Stanley', summary: 'Morgan Stanley — Target: $185 (2026-02-15)', details: { analyst: 'John Smith', company: 'Morgan Stanley', price_target: 185, adj_price_target: 160, published_date: '2026-02-15' }, significance: 'medium', is_read: false, created_at: new Date(Date.now() - 1.5 * 86400000).toISOString() },
];

const UpdateDetailPanel = ({ update }: { update: PortfolioUpdate }) => {
  const d = update.details || {};

  const renderEarningsDetail = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Actual EPS</p>
        <p className="text-sm font-semibold text-foreground">${d.actual?.toFixed(2) ?? '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Estimated EPS</p>
        <p className="text-sm font-semibold text-foreground">${d.estimated?.toFixed(2) ?? '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Surprise</p>
        <p className={`text-sm font-semibold ${(d.surprise_pct || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {(d.surprise_pct || 0) >= 0 ? '+' : ''}{d.surprise_pct?.toFixed(1)}%
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Report Date</p>
        <p className="text-sm text-foreground">{d.date || '—'}</p>
      </div>
    </div>
  );

  const renderRatingDetail = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Analyst Firm</p>
        <p className="text-sm font-semibold text-foreground">{d.company || '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</p>
        <p className="text-sm text-foreground">{d.date || '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Previous Rating</p>
        <Badge variant="outline" className="text-xs">{d.from || '—'}</Badge>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">New Rating</p>
        <Badge variant={update.update_type === 'rating_upgrade' ? 'default' : 'destructive'} className="text-xs">{d.to || '—'}</Badge>
      </div>
    </div>
  );

  const renderDividendDetail = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Previous Dividend</p>
        <p className="text-sm font-semibold text-foreground">${d.previous?.toFixed(4) ?? '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">New Dividend</p>
        <p className="text-sm font-semibold text-foreground">${d.current?.toFixed(4) ?? '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Change</p>
        <p className={`text-sm font-semibold ${(d.change_pct || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {(d.change_pct || 0) >= 0 ? '+' : ''}{d.change_pct?.toFixed(1)}%
        </p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Ex-Date</p>
        <p className="text-sm text-foreground">{d.date || '—'}</p>
      </div>
    </div>
  );

  const renderPriceTargetDetail = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Analyst</p>
        <p className="text-sm font-semibold text-foreground">{d.analyst || '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Firm</p>
        <p className="text-sm font-semibold text-foreground">{d.company || '—'}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Price Target</p>
        <p className="text-sm font-semibold text-foreground">${d.price_target ?? '—'}</p>
      </div>
      {d.adj_price_target && d.adj_price_target !== d.price_target && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Previous Target</p>
          <p className="text-sm text-muted-foreground">${d.adj_price_target}</p>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Published</p>
        <p className="text-sm text-foreground">{d.published_date || '—'}</p>
      </div>
    </div>
  );

  return (
    <div className="px-4 pb-4 pt-0 ml-12 mr-12">
      <Separator className="mb-3" />
      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Info className="w-3 h-3" />
          Event Details
        </div>
        {update.update_type === 'earnings_surprise' && renderEarningsDetail()}
        {(update.update_type === 'rating_upgrade' || update.update_type === 'rating_downgrade') && renderRatingDetail()}
        {update.update_type === 'dividend_change' && renderDividendDetail()}
        {update.update_type === 'price_target_change' && renderPriceTargetDetail()}
      </div>
    </div>
  );
};

const PortfolioUpdatesView = () => {
  const { user } = useAuth();
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [updates, setUpdates] = useState<PortfolioUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchUpdates = useCallback(async () => {
    if (isDemoMode) {
      setUpdates(DEMO_UPDATES);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('portfolio-updates', {
        body: { action: 'get_updates', user_id: user!.id },
      });
      if (error) throw error;
      setUpdates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch updates:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isDemoMode]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  // Auto-trigger a first check when the feed is empty and there are holdings
  const [autoChecked, setAutoChecked] = useState(false);
  useEffect(() => {
    if (autoChecked || loading || isDemoMode || !user) return;
    if (updates.length > 0) { setAutoChecked(true); return; }
    if (!holdings.length) return;
    setAutoChecked(true);
    (async () => {
      try {
        const symbols = [...new Set(holdings.map(h => h.symbol).filter(Boolean))];
        if (!symbols.length) return;
        setRefreshing(true);
        await supabase.functions.invoke('portfolio-updates', {
          body: { action: 'check_updates', user_id: user.id, symbols },
        });
        await fetchUpdates();
      } catch (err) {
        console.error('Auto portfolio-updates check failed:', err);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [autoChecked, loading, isDemoMode, user, updates.length, holdings, fetchUpdates]);


  // Realtime subscription
  useEffect(() => {
    if (!user || isDemoMode) return;
    const channel = supabase
      .channel('portfolio-updates-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portfolio_updates', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setUpdates(prev => [payload.new as PortfolioUpdate, ...prev]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isDemoMode]);

  const handleRefresh = async () => {
    if (isDemoMode) { toast.info('Demo mode — showing sample updates'); return; }
    setRefreshing(true);
    try {
      // Get symbols from active portfolio holdings first
      let symbols = holdings.map(h => h.symbol).filter(Boolean);
      
      // If no holdings in active portfolio, fetch from all user portfolios
      if (!symbols.length && user) {
        const { data: portfolios } = await supabase
          .from('portfolios')
          .select('id')
          .eq('user_id', user.id);
        if (portfolios?.length) {
          const portfolioIds = portfolios.map(p => p.id);
          const { data: allHoldings } = await supabase
            .from('holdings')
            .select('symbol')
            .in('portfolio_id', portfolioIds);
          if (allHoldings?.length) {
            symbols = [...new Set(allHoldings.map(h => h.symbol.toUpperCase()))];
          }
        }
      }
      
      if (!symbols.length) { toast.info('No holdings to check. Add stocks to your portfolio first.'); setRefreshing(false); return; }
      
      const { data, error } = await supabase.functions.invoke('portfolio-updates', {
        body: { action: 'check_updates', user_id: user!.id, symbols },
      });
      if (error) throw error;
      toast.success(`Found ${data?.total_found || 0} events, ${data?.inserted || 0} new`);
      await fetchUpdates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to check updates');
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    if (isDemoMode) { setUpdates(prev => prev.map(u => u.id === id ? { ...u, is_read: true } : u)); return; }
    await supabase.from('portfolio_updates').update({ is_read: true }).eq('id', id);
    setUpdates(prev => prev.map(u => u.id === id ? { ...u, is_read: true } : u));
  };

  const markAllRead = async () => {
    if (isDemoMode) { setUpdates(prev => prev.map(u => ({ ...u, is_read: true }))); return; }
    await supabase.from('portfolio_updates').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    setUpdates(prev => prev.map(u => ({ ...u, is_read: true })));
  };

  const clearAllRead = async () => {
    const readUpdates = updates.filter(u => u.is_read);
    if (!readUpdates.length) { toast.info('No read updates to clear'); return; }
    if (isDemoMode) { setUpdates(prev => prev.filter(u => !u.is_read)); toast.success(`Cleared ${readUpdates.length} read updates`); return; }
    const { error } = await supabase.from('portfolio_updates').delete().eq('user_id', user!.id).eq('is_read', true);
    if (error) { toast.error('Failed to clear updates'); return; }
    setUpdates(prev => prev.filter(u => !u.is_read));
    toast.success(`Cleared ${readUpdates.length} read updates`);
  };

  const dismissUpdate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (isDemoMode) { setUpdates(prev => prev.filter(u => u.id !== id)); toast.success('Update dismissed'); return; }
    const { error } = await supabase.from('portfolio_updates').delete().eq('id', id);
    if (error) { toast.error('Failed to dismiss'); return; }
    setUpdates(prev => prev.filter(u => u.id !== id));
    toast.success('Update dismissed');
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const filtered = useMemo(() => {
    let list = updates;
    if (filter !== 'all') list = list.filter(u => u.update_type === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u => u.symbol.toLowerCase().includes(q) || u.title.toLowerCase().includes(q) || u.summary?.toLowerCase().includes(q));
    }
    return list;
  }, [updates, filter, searchQuery]);

  const unreadCount = updates.filter(u => !u.is_read).length;
  const readCount = updates.filter(u => u.is_read).length;

  const categoryCounts = useMemo(() => {
    const counts = {
      earnings_surprise: 0,
      dividend_change: 0,
      rating_upgrade: 0,
      rating_downgrade: 0,
      price_target_change: 0,
      high_impact: 0,
    };
    for (const u of updates) {
      if (u.update_type in counts) counts[u.update_type as keyof typeof counts]++;
      if (u.significance === 'high') counts.high_impact++;
    }
    return counts;
  }, [updates]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'earnings_surprise': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'dividend_change': return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'rating_upgrade': return <ArrowUpCircle className="w-4 h-4 text-emerald-500" />;
      case 'rating_downgrade': return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
      case 'price_target_change': return <Target className="w-4 h-4 text-blue-500" />;
      default: return <Newspaper className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'earnings_surprise': return 'Earnings';
      case 'dividend_change': return 'Dividend';
      case 'rating_upgrade': return 'Upgrade';
      case 'rating_downgrade': return 'Downgrade';
      case 'price_target_change': return 'Price Target';
      default: return 'Update';
    }
  };

  const getSignificanceBadge = (sig: string) => {
    switch (sig) {
      case 'high': return <Badge variant="destructive" className="text-[10px]">High Impact</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-[10px]">Medium</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Low</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <UIAlert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <UIAlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample portfolio updates.
          </UIAlertDescription>
        </UIAlert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" />
            Portfolio Updates
          </h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} new update${unreadCount > 1 ? 's' : ''}` : 'No new updates'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {readCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" /> Clear Read
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all read updates?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {readCount} read update{readCount > 1 ? 's' : ''} from your feed. Unread updates will not be affected. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllRead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear {readCount} update{readCount > 1 ? 's' : ''}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </Button>
          )}
          {updates.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              const rows = [
                ['Symbol', 'Type', 'Title', 'Summary', 'Significance', 'Read', 'Date'],
                ...updates.map(u => [
                  u.symbol,
                  u.update_type,
                  `"${u.title.replace(/"/g, '""')}"`,
                  `"${(u.summary || '').replace(/"/g, '""')}"`,
                  u.significance,
                  u.is_read ? 'Yes' : 'No',
                  format(new Date(u.created_at), 'yyyy-MM-dd HH:mm'),
                ])
              ];
              const csv = rows.map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `portfolio-updates-${format(new Date(), 'yyyy-MM-dd')}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Updates exported to CSV');
            }} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          )}
          <Button variant="default" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking...' : 'Check Now'}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Earnings', count: categoryCounts.earnings_surprise, icon: <Zap className="w-4 h-4 text-amber-500" />, color: 'bg-amber-500/10' },
          { label: 'Dividends', count: categoryCounts.dividend_change, icon: <DollarSign className="w-4 h-4 text-green-500" />, color: 'bg-green-500/10' },
          { label: 'Upgrades', count: categoryCounts.rating_upgrade, icon: <ArrowUpCircle className="w-4 h-4 text-emerald-500" />, color: 'bg-emerald-500/10' },
          { label: 'Downgrades', count: categoryCounts.rating_downgrade, icon: <ArrowDownCircle className="w-4 h-4 text-red-500" />, color: 'bg-red-500/10' },
          { label: 'Targets', count: categoryCounts.price_target_change, icon: <Target className="w-4 h-4 text-blue-500" />, color: 'bg-blue-500/10' },
          { label: 'High Impact', count: categoryCounts.high_impact, icon: <AlertTriangle className="w-4 h-4 text-destructive" />, color: 'bg-destructive/10' },
        ].map(stat => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${stat.color}`}>{stat.icon}</div>
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{stat.count}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
        <TabsList className="grid w-full grid-cols-6 max-w-2xl">
          <TabsTrigger value="all" className="gap-1"><Filter className="w-3 h-3" /> All</TabsTrigger>
          <TabsTrigger value="earnings_surprise" className="gap-1"><Zap className="w-3 h-3" /> Earnings</TabsTrigger>
          <TabsTrigger value="dividend_change" className="gap-1"><DollarSign className="w-3 h-3" /> Dividends</TabsTrigger>
          <TabsTrigger value="rating_upgrade" className="gap-1"><ArrowUpCircle className="w-3 h-3" /> Upgrades</TabsTrigger>
          <TabsTrigger value="rating_downgrade" className="gap-1"><ArrowDownCircle className="w-3 h-3" /> Downgrades</TabsTrigger>
          <TabsTrigger value="price_target_change" className="gap-1"><Target className="w-3 h-3" /> Targets</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search updates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-10" />
        {searchQuery && (
          <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0" onClick={() => setSearchQuery('')}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Updates Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Updates Feed</span>
            <span className="text-sm font-normal text-muted-foreground">{filtered.length} items</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Newspaper className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">{searchQuery ? `No updates matching "${searchQuery}"` : 'No updates yet'}</p>
              <p className="text-xs mt-1">Click "Check Now" to scan your holdings for updates</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((update) => (
                <div key={update.id}>
                  <div
                    className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer ${!update.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      if (!update.is_read) markAsRead(update.id);
                      toggleExpand(update.id);
                    }}
                  >
                    <div className="mt-1 p-2 rounded-lg bg-muted/50 shrink-0">
                      {getIcon(update.update_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] font-mono">{update.symbol}</Badge>
                        <span className="text-xs font-medium text-muted-foreground">{getTypeLabel(update.update_type)}</span>
                        {getSignificanceBadge(update.significance)}
                        {!update.is_read && <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>}
                      </div>
                      <p className="text-sm font-medium text-foreground">{update.title}</p>
                      {update.summary && <p className="text-xs text-muted-foreground mt-0.5">{update.summary}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                        <span className="mx-1">•</span>
                        {format(new Date(update.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(update.id); }}
                        title="View details"
                      >
                        {expandedId === update.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => dismissUpdate(e, update.id)}
                        title="Dismiss update"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === update.id && <UpdateDetailPanel update={update} />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioUpdatesView;
