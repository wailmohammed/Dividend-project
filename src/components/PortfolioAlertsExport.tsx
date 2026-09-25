import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { PortfolioAlert } from '@/hooks/usePortfolioAlerts';
import { Download, Share2, Copy, FileJson, FileSpreadsheet, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PortfolioAlertsExportProps {
  alerts: PortfolioAlert[];
}

export const PortfolioAlertsExport: React.FC<PortfolioAlertsExportProps> = ({ alerts }) => {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportToJSON = () => {
    const exportData = alerts.map(alert => ({
      symbol: alert.symbol,
      alert_type: alert.alert_type,
      threshold_percent: alert.threshold_percent,
      is_active: alert.is_active,
      notes: alert.notes,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-alerts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Alerts exported as JSON');
  };

  const exportToCSV = () => {
    const headers = ['Symbol', 'Alert Type', 'Threshold %', 'Active', 'Notes', 'Triggered At'];
    const rows = alerts.map(alert => [
      alert.symbol,
      alert.alert_type,
      alert.threshold_percent?.toString() || '',
      alert.is_active ? 'Yes' : 'No',
      alert.notes || '',
      alert.triggered_at || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-alerts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Alerts exported as CSV');
  };

  const getShareableConfig = () => {
    const config = alerts.map(alert => ({
      symbol: alert.symbol,
      type: alert.alert_type,
      threshold: alert.threshold_percent,
      notes: alert.notes,
    }));
    return JSON.stringify(config, null, 2);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getShareableConfig());
      setCopied(true);
      toast.success('Configuration copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportToJSON}>
            <FileJson className="w-4 h-4 mr-2" />
            Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportToCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export as CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Alert Configuration</DialogTitle>
            <DialogDescription>
              Copy this configuration to share with others or import into another account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Configuration ({alerts.length} alerts)</Label>
              <Textarea
                value={getShareableConfig()}
                readOnly
                className="font-mono text-xs h-48"
              />
            </div>
            <Button onClick={copyToClipboard} className="w-full">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioAlertsExport;
