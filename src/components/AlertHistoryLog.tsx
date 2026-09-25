import React, { useState, useCallback } from 'react';
import { useAlertHistory } from '@/hooks/useAlertHistory';
import { useAlertActions } from '@/hooks/useAlertActions';
import { AlertHistoryCSVExport } from './AlertHistoryCSVExport';
import { AlertHistoryBatchActions } from './AlertHistoryBatchActions';
import { AlertSnoozeDialog } from './AlertSnoozeDialog';
import { AlertSeverityBadge, getAlertSeverity } from './AlertSeverityBadge';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  AlertTriangle, TrendingUp, BarChart3, Activity, Clock, Mail,
  Bell, MessageSquare, Smartphone, Search, Filter, CheckCircle2, XCircle,
  AlarmClockOff, Check, Eye, EyeOff, Trash2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from './ui/alert-dialog';
import { format, formatDistanceToNow } from 'date-fns';
import type { AlertHistoryEntry } from '@/hooks/useAlertHistory';


const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  ma_crossover: { label: 'MA Crossover', icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  volume_spike: { label: 'Volume Spike', icon: <BarChart3 className="w-4 h-4" />, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  rsi_threshold: { label: 'RSI Threshold', icon: <Activity className="w-4 h-4" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  price_movement: { label: 'Price Movement', icon: <TrendingUp className="w-4 h-4" />, color: 'text-primary', bgColor: 'bg-primary/10' },
  dividend_cut: { label: 'Dividend Cut', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  dividend_increase: { label: 'Dividend Increase', icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  earnings_surprise: { label: 'Earnings Surprise', icon: <Activity className="w-4 h-4" />, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
};

const NotificationBadge: React.FC<{ sent: boolean; icon: React.ReactNode; label: string }> = ({ sent, icon, label }) => (
  <div
    className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${sent ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}
    title={`${label}: ${sent ? 'Sent' : 'Not sent'}`}
  >
    {icon}
    {sent ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
  </div>
);

export const AlertHistoryLog: React.FC = () => {
  const { history, loading, refetch } = useAlertHistory(100);
  const {
    acknowledgeAlert, unacknowledgeAlert, snoozeAlert, unsnoozeAlert,
    batchAcknowledge, batchUnacknowledge, batchSnooze, batchUnsnooze,
    deleteAlert, batchDelete,
  } = useAlertActions(refetch);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [snoozeTarget, setSnoozeTarget] = useState<AlertHistoryEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = history.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.trigger_details?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || entry.alert_type === typeFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'acknowledged' && entry.is_acknowledged) ||
      (statusFilter === 'snoozed' && entry.is_snoozed) ||
      (statusFilter === 'active' && !entry.is_acknowledged && !entry.is_snoozed);
    return matchesSearch && matchesType && matchesStatus;
  });

  const filteredIds = new Set(filtered.map((e) => e.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id))
    );
  }, [filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const selectedArray = Array.from(selectedIds).filter((id) => filteredIds.has(id));

  const getConfig = (type: string) =>
    ALERT_TYPE_CONFIG[type] || {
      label: type.replace(/_/g, ' '),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    };

  const isSnoozedActive = (entry: AlertHistoryEntry) =>
    entry.is_snoozed && entry.snoozed_until && new Date(entry.snoozed_until) > new Date();

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Alert History Log
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {filtered.length} entries
            </Badge>
            <AlertHistoryCSVExport data={filtered} />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by symbol or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="ma_crossover">MA Crossover</SelectItem>
              <SelectItem value="volume_spike">Volume Spike</SelectItem>
              <SelectItem value="rsi_threshold">RSI Threshold</SelectItem>
              <SelectItem value="price_movement">Price Movement</SelectItem>
              <SelectItem value="dividend_cut">Dividend Cut</SelectItem>
              <SelectItem value="dividend_increase">Dividend Increase</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <Eye className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="snoozed">Snoozed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Batch Actions */}
        <AlertHistoryBatchActions
          selectedCount={selectedArray.length}
          onAcknowledgeAll={() => { batchAcknowledge(selectedArray); clearSelection(); }}
          onUnacknowledgeAll={() => { batchUnacknowledge(selectedArray); clearSelection(); }}
          onSnoozeAll={(m, r) => { batchSnooze(selectedArray, m, r); clearSelection(); }}
          onUnsnoozeAll={() => { batchUnsnooze(selectedArray); clearSelection(); }}
          onClearSelection={clearSelection}
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="w-10 h-10 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-2 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No alert history found.</p>
            <p className="text-xs mt-1">Triggered alerts and their notification status will appear here.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="h-4 w-4"
                />
                <span className="text-xs text-muted-foreground">Select all ({filtered.length})</span>
              </div>
              {selectedArray.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete ({selectedArray.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selectedArray.length} alert{selectedArray.length > 1 ? 's' : ''}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the selected entries from your alert history. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => { batchDelete(selectedArray); clearSelection(); }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((entry) => {
              const config = getConfig(entry.alert_type);
              const snoozed = isSnoozedActive(entry);
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    entry.is_acknowledged
                      ? 'bg-muted/30 border-border opacity-70'
                      : snoozed
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-muted/50 border-border hover:border-primary/30'
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(entry.id)}
                    onCheckedChange={() => toggleSelect(entry.id)}
                    className="h-4 w-4 mt-1 shrink-0"
                  />
                  <div className={`p-2 rounded-lg ${config.bgColor} ${config.color} shrink-0 mt-0.5`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-foreground text-sm">{entry.symbol}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {config.label}
                      </Badge>
                      <AlertSeverityBadge severity={getAlertSeverity(entry.alert_type)} />
                      {entry.is_acknowledged && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          <Check className="w-2.5 h-2.5 mr-0.5" /> Reviewed
                        </Badge>
                      )}
                      {snoozed && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20">
                          <AlarmClockOff className="w-2.5 h-2.5 mr-0.5" /> Snoozed
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {entry.trigger_details || `Trigger value: ${entry.trigger_value ?? 'N/A'}`}
                    </p>
                    {snoozed && entry.snoozed_until && (
                      <p className="text-[10px] text-amber-500 mt-0.5">
                        Snoozed until {format(new Date(entry.snoozed_until), 'MMM d, h:mm a')}
                        {entry.snooze_reason && ` — ${entry.snooze_reason}`}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(entry.triggered_at), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div className="flex items-center gap-1">
                        <NotificationBadge sent={entry.notification_email_sent} icon={<Mail className="w-2.5 h-2.5" />} label="Email" />
                        <NotificationBadge sent={entry.notification_webhook_sent} icon={<Bell className="w-2.5 h-2.5" />} label="Webhook" />
                        <NotificationBadge sent={entry.notification_push_sent} icon={<Smartphone className="w-2.5 h-2.5" />} label="Push" />
                        <NotificationBadge sent={entry.notification_sms_sent} icon={<MessageSquare className="w-2.5 h-2.5" />} label="SMS" />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0 mt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            entry.is_acknowledged
                              ? unacknowledgeAlert(entry.id)
                              : acknowledgeAlert(entry.id)
                          }
                        >
                          {entry.is_acknowledged ? (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {entry.is_acknowledged ? 'Mark as unreviewed' : 'Mark as reviewed'}
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            snoozed ? unsnoozeAlert(entry.id) : setSnoozeTarget(entry)
                          }
                        >
                          <AlarmClockOff className={`w-3.5 h-3.5 ${snoozed ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {snoozed ? 'Unsnooze alert' : 'Snooze alert'}
                      </TooltipContent>
                    </Tooltip>

                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Delete alert</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the entry from your alert history. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteAlert(entry.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                </div>
              );
            })}
            </div>
          </>
        )}

        {/* Snooze Dialog */}
        {snoozeTarget && (
          <AlertSnoozeDialog
            open={!!snoozeTarget}
            onOpenChange={(open) => !open && setSnoozeTarget(null)}
            symbol={snoozeTarget.symbol}
            alertType={snoozeTarget.alert_type}
            onSnooze={(minutes, reason) => {
              snoozeAlert(snoozeTarget.id, minutes, reason);
              setSnoozeTarget(null);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
