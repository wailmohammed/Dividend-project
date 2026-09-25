import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Database, ChevronLeft, ChevronRight, Download, CalendarIcon, X, Radio } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SyncLog {
  id: string;
  sync_type: string;
  symbols_count: number;
  success_count: number;
  error_count: number;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const formatSyncError = (message: string | null) => {
  if (!message) return '-';

  try {
    const parsed = JSON.parse(message);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: any) => `${item.symbol || 'Unknown'}: ${item.error || item.message || 'Unknown error'}`)
        .join(' • ');
    }
  } catch {
    // Keep older plain-text log messages readable.
  }

  return message;
};

const AdminSyncLogsView = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [syncTypeFilter, setSyncTypeFilter] = useState<string>('all');
  const [syncTypes, setSyncTypes] = useState<string[]>([]);
  const [isLive, setIsLive] = useState(true);

  // Fetch distinct sync types
  const fetchSyncTypes = useCallback(async () => {
    const { data } = await supabase
      .from('market_sync_logs')
      .select('sync_type')
      .order('sync_type');
    
    if (data) {
      const types = [...new Set(data.map(d => d.sync_type))];
      setSyncTypes(types);
    }
  }, []);

  const fetchLogs = useCallback(async (pageNum: number = 0, fromDate?: Date, toDate?: Date, typeFilter?: string) => {
    try {
      // Build query with date and type filters
      let countQuery = supabase
        .from('market_sync_logs')
        .select('*', { count: 'exact', head: true });

      let dataQuery = supabase
        .from('market_sync_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (fromDate) {
        const start = startOfDay(fromDate).toISOString();
        countQuery = countQuery.gte('created_at', start);
        dataQuery = dataQuery.gte('created_at', start);
      }

      if (toDate) {
        const end = endOfDay(toDate).toISOString();
        countQuery = countQuery.lte('created_at', end);
        dataQuery = dataQuery.lte('created_at', end);
      }

      if (typeFilter && typeFilter !== 'all') {
        countQuery = countQuery.eq('sync_type', typeFilter);
        dataQuery = dataQuery.eq('sync_type', typeFilter);
      }

      // Get total count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch paginated data
      const { data, error } = await dataQuery
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching sync logs:', err);
      toast.error('Failed to load sync logs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and fetch sync types
  useEffect(() => {
    fetchSyncTypes();
  }, [fetchSyncTypes]);

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs(page, startDate, endDate, syncTypeFilter);
  }, [page, startDate, endDate, syncTypeFilter, fetchLogs]);

  // Real-time subscription
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel('market-sync-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'market_sync_logs'
        },
        (payload) => {
          const newLog = payload.new as SyncLog;
          
          // Check if it matches current filters
          const matchesDateFilter = (!startDate || new Date(newLog.created_at) >= startOfDay(startDate)) &&
                                    (!endDate || new Date(newLog.created_at) <= endOfDay(endDate));
          const matchesTypeFilter = syncTypeFilter === 'all' || newLog.sync_type === syncTypeFilter;
          
          if (matchesDateFilter && matchesTypeFilter && page === 0) {
            setLogs(prev => [newLog, ...prev.slice(0, PAGE_SIZE - 1)]);
            setTotalCount(prev => prev + 1);
            
            // Add new sync type if it's new
            if (!syncTypes.includes(newLog.sync_type)) {
              setSyncTypes(prev => [...prev, newLog.sync_type].sort());
            }
            
            toast.info(`New sync: ${newLog.sync_type}`, {
              description: `${newLog.success_count} succeeded, ${newLog.error_count} failed`
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, startDate, endDate, syncTypeFilter, page, syncTypes]);

  const handleQuickFilter = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(start);
    setEndDate(end);
    setPage(0);
  };

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(0);
  };

  const handleRunRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('scheduled-market-refresh', {
        body: { trigger: 'manual_admin' }
      });

      if (error) throw error;
      toast.success('Market refresh triggered successfully');
      
      // Real-time will handle refresh if enabled, otherwise manually refetch
      if (!isLive) {
        setTimeout(() => {
          setPage(0);
          fetchLogs(0, startDate, endDate, syncTypeFilter);
        }, 2000);
      }
    } catch (err) {
      console.error('Error triggering refresh:', err);
      toast.error('Failed to trigger market refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      // Fetch logs with current filters for export
      let query = supabase
        .from('market_sync_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('No logs to export');
        return;
      }

      // Create CSV content
      const headers = ['ID', 'Sync Type', 'Symbols Count', 'Success Count', 'Error Count', 'Duration (ms)', 'Error Message', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...data.map(log => [
          log.id,
          `"${log.sync_type}"`,
          log.symbols_count,
          log.success_count,
          log.error_count,
          log.duration_ms || '',
          `"${(log.error_message || '').replace(/"/g, '""')}"`,
          log.created_at
        ].join(','))
      ];
      const csvContent = csvRows.join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sync_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${data.length} log entries`);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      toast.error('Failed to export logs');
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem = page * PAGE_SIZE + 1;
  const endItem = Math.min((page + 1) * PAGE_SIZE, totalCount);

  const getStatusBadge = (log: SyncLog) => {
    if (log.error_count > 0 && log.success_count === 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Failed</Badge>;
    }
    if (log.error_count > 0) {
      return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="w-3 h-3" /> Partial</Badge>;
    }
    return <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle className="w-3 h-3" /> Success</Badge>;
  };

  const stats = {
    total: logs.length,
    failed: logs.filter(l => l.error_count > 0 && l.success_count === 0).length,
    partial: logs.filter(l => l.error_count > 0 && l.success_count > 0).length,
    success: logs.filter(l => l.error_count === 0).length
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Market Sync Logs
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalCount > 0 ? `Showing ${startItem}-${endItem} of ${totalCount} sync operations` : 'No sync operations'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button onClick={handleRunRefresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Running...' : 'Run Refresh Now'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Quick Date Filters */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter(1)}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter(7)}>Last 7 days</Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter(30)}>Last 30 days</Button>
            </div>
            
            {/* Date Range Pickers */}
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => { setStartDate(date); setPage(0); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => { setEndDate(date); setPage(0); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 px-2">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* Sync Type Filter */}
            <div className="space-y-1">
              <Label className="text-xs">Sync Type</Label>
              <Select value={syncTypeFilter} onValueChange={(val) => { setSyncTypeFilter(val); setPage(0); }}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {syncTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Real-time Toggle */}
            <div className="flex items-center gap-2">
              <Button 
                variant={isLive ? "default" : "outline"} 
                size="sm" 
                onClick={() => setIsLive(!isLive)}
                className="gap-1"
              >
                <Radio className={`w-3 h-3 ${isLive ? 'animate-pulse' : ''}`} />
                {isLive ? 'Live' : 'Paused'}
              </Button>
            </div>

            {/* Active Filters Badge */}
            {(startDate || endDate || syncTypeFilter !== 'all') && (
              <Badge variant="secondary" className="text-xs">
                {startDate || endDate ? `${startDate ? format(startDate, 'MMM d') : 'All'} - ${endDate ? format(endDate, 'MMM d') : 'Now'}` : ''}
                {syncTypeFilter !== 'all' && ` • ${syncTypeFilter}`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Syncs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.success}</div>
            <div className="text-xs text-muted-foreground">Successful</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.partial}</div>
            <div className="text-xs text-muted-foreground">Partial Failures</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Sync History</CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Symbols</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No sync logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className={log.error_count > 0 && log.success_count === 0 ? 'bg-destructive/5' : ''}>
                      <TableCell>{getStatusBadge(log)}</TableCell>
                      <TableCell className="font-mono text-xs">{log.sync_type}</TableCell>
                      <TableCell className="text-right">{log.symbols_count}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{log.success_count}</TableCell>
                      <TableCell className="text-right text-destructive">{log.error_count}</TableCell>
                      <TableCell className="text-right">
                        {log.duration_ms ? (
                          <span className="flex items-center justify-end gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {(log.duration_ms / 1000).toFixed(1)}s
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-destructive" title={formatSyncError(log.error_message)}>
                        {formatSyncError(log.error_message)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <span className="text-sm text-muted-foreground">
                Showing {startItem}-{endItem} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(0)}
                  disabled={page === 0}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages - 1)}
                  disabled={page >= totalPages - 1}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSyncLogsView;
