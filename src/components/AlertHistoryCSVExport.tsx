import React from 'react';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { AlertHistoryEntry } from '@/hooks/useAlertHistory';
import { format } from 'date-fns';

interface AlertHistoryCSVExportProps {
  data: AlertHistoryEntry[];
}

const escapeCSV = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const AlertHistoryCSVExport: React.FC<AlertHistoryCSVExportProps> = ({ data }) => {
  const handleExport = () => {
    if (data.length === 0) {
      toast.error('No alert history to export');
      return;
    }

    const headers = [
      'Symbol',
      'Alert Type',
      'Threshold %',
      'Trigger Value',
      'Trigger Details',
      'Triggered At',
      'Email Sent',
      'Webhook Sent',
      'Push Sent',
      'SMS Sent',
      'Acknowledged',
      'Snoozed',
      'Snoozed Until',
      'Snooze Reason',
    ];

    const rows = data.map((entry) => [
      escapeCSV(entry.symbol),
      escapeCSV(entry.alert_type.replace(/_/g, ' ')),
      escapeCSV(entry.threshold_percent),
      escapeCSV(entry.trigger_value),
      escapeCSV(entry.trigger_details),
      escapeCSV(format(new Date(entry.triggered_at), 'yyyy-MM-dd HH:mm:ss')),
      entry.notification_email_sent ? 'Yes' : 'No',
      entry.notification_webhook_sent ? 'Yes' : 'No',
      entry.notification_push_sent ? 'Yes' : 'No',
      entry.notification_sms_sent ? 'Yes' : 'No',
      entry.is_acknowledged ? 'Yes' : 'No',
      entry.is_snoozed ? 'Yes' : 'No',
      entry.snoozed_until ? escapeCSV(format(new Date(entry.snoozed_until), 'yyyy-MM-dd HH:mm:ss')) : '',
      escapeCSV(entry.snooze_reason),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alert-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.length} alert records`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-1.5 text-xs"
      disabled={data.length === 0}
    >
      <Download className="w-3.5 h-3.5" />
      Export CSV
    </Button>
  );
};
