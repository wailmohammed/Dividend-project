import React, { useState, useMemo } from 'react';
import { useAlertHistory } from '@/hooks/useAlertHistory';
import { AlertSeverityBadge, getAlertSeverity } from './AlertSeverityBadge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  CheckCircle2, XCircle, Clock, Mail, Smartphone, Bell, MessageSquare,
  Search, Filter, History, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const ChannelStatus: React.FC<{ sent: boolean; label: string }> = ({ sent, label }) => (
  <div
    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
      sent ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
    }`}
    title={`${label}: ${sent ? 'Delivered' : 'Not sent'}`}
  >
    {sent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    <span className="hidden sm:inline">{label}</span>
  </div>
);

export const NotificationHistoryView: React.FC = () => {
  const { history, loading } = useAlertHistory(200);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const filtered = useMemo(() => {
    let items = history;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (e) =>
          e.symbol.toLowerCase().includes(q) ||
          e.alert_type.toLowerCase().includes(q) ||
          e.trigger_details?.toLowerCase().includes(q)
      );
    }

    if (channelFilter !== 'all') {
      items = items.filter((e) => {
        switch (channelFilter) {
          case 'email': return e.notification_email_sent;
          case 'sms': return e.notification_sms_sent;
          case 'push': return e.notification_push_sent;
          case 'webhook': return e.notification_webhook_sent;
          case 'none':
            return !e.notification_email_sent && !e.notification_sms_sent &&
              !e.notification_push_sent && !e.notification_webhook_sent;
          default: return true;
        }
      });
    }

    items = [...items].sort((a, b) => {
      const ta = new Date(a.triggered_at).getTime();
      const tb = new Date(b.triggered_at).getTime();
      return sortDir === 'desc' ? tb - ta : ta - tb;
    });

    return items;
  }, [history, search, channelFilter, sortDir]);

  const channelSummary = useMemo(() => {
    const total = history.length;
    return {
      email: history.filter((e) => e.notification_email_sent).length,
      sms: history.filter((e) => e.notification_sms_sent).length,
      push: history.filter((e) => e.notification_push_sent).length,
      webhook: history.filter((e) => e.notification_webhook_sent).length,
      total,
    };
  }, [history]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Alerts', value: channelSummary.total, icon: <History className="w-4 h-4" />, color: 'text-primary' },
          { label: 'Email', value: channelSummary.email, icon: <Mail className="w-4 h-4" />, color: 'text-blue-500' },
          { label: 'SMS', value: channelSummary.sms, icon: <Smartphone className="w-4 h-4" />, color: 'text-emerald-500' },
          { label: 'Push', value: channelSummary.push, icon: <Bell className="w-4 h-4" />, color: 'text-amber-500' },
          { label: 'Webhook', value: channelSummary.webhook, icon: <MessageSquare className="w-4 h-4" />, color: 'text-purple-500' },
        ].map((stat) => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={stat.color}>{stat.icon}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol, type, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email Sent</SelectItem>
            <SelectItem value="sms">SMS Sent</SelectItem>
            <SelectItem value="push">Push Sent</SelectItem>
            <SelectItem value="webhook">Webhook Sent</SelectItem>
            <SelectItem value="none">No Delivery</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          className="gap-1.5 shrink-0"
        >
          {sortDir === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          {sortDir === 'desc' ? 'Newest' : 'Oldest'}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Delivery History
            <Badge variant="outline" className="ml-auto text-xs">{filtered.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">No notification history found</p>
              <p className="text-xs mt-1">Alert delivery records will appear here when alerts trigger.</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden md:table-cell">Severity</TableHead>
                    <TableHead className="hidden lg:table-cell">Details</TableHead>
                    <TableHead>Channels</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-bold text-foreground">{entry.symbol}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {entry.alert_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <AlertSeverityBadge severity={getAlertSeverity(entry.alert_type)} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px]">
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.trigger_details || `Value: ${entry.trigger_value ?? 'N/A'}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <ChannelStatus sent={entry.notification_email_sent} label="Email" />
                          <ChannelStatus sent={entry.notification_sms_sent} label="SMS" />
                          <ChannelStatus sent={entry.notification_push_sent} label="Push" />
                          <ChannelStatus sent={entry.notification_webhook_sent} label="Webhook" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        <div>{formatDistanceToNow(new Date(entry.triggered_at), { addSuffix: true })}</div>
                        <div className="text-[10px]">{format(new Date(entry.triggered_at), 'MMM d, HH:mm')}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
