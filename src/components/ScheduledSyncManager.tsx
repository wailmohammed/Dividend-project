import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Clock, RefreshCw, Copy, Check, ExternalLink, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const ScheduledSyncManager: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingAlerts, setIsCheckingAlerts] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  const syncEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scheduled-sync`;
  const alertEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alert-check`;

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('scheduled-sync', {
        body: {},
      });

      if (error) throw error;
      setLastSyncResult(data);
      toast.success(`Synced ${data.successCount} symbols successfully`);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync market data');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckAlerts = async () => {
    setIsCheckingAlerts(true);
    try {
      const { data, error } = await supabase.functions.invoke('alert-check', {
        body: {},
      });

      if (error) throw error;
      
      if (data.triggered > 0) {
        toast.success(`${data.triggered} alert(s) triggered! Emails sent: ${data.emailsSent}`);
      } else {
        toast.info('No alerts triggered');
      }
    } catch (error) {
      console.error('Alert check failed:', error);
      toast.error('Failed to check alerts');
    } finally {
      setIsCheckingAlerts(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Manual Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Market Data Sync
          </CardTitle>
          <CardDescription>
            Manually trigger a market data sync or set up automated scheduling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleManualSync} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleCheckAlerts} disabled={isCheckingAlerts}>
              {isCheckingAlerts ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Check Alerts
                </>
              )}
            </Button>
          </div>

          {lastSyncResult && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Symbols:</span>
                  <span className="ml-2 font-medium">{lastSyncResult.symbolsProcessed}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Success:</span>
                  <span className="ml-2 font-medium text-green-500">{lastSyncResult.successCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="ml-2 font-medium text-destructive">{lastSyncResult.errorCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-2 font-medium">{(lastSyncResult.durationMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* External Scheduler Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            External Scheduler Setup
          </CardTitle>
          <CardDescription>
            Use an external scheduler (cron-job.org, EasyCron, Zapier) to call these endpoints every 6 hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Market Data Sync Endpoint */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Badge variant="outline">POST</Badge>
              Market Data Sync Endpoint
            </Label>
            <div className="flex gap-2">
              <Input value={syncEndpoint} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(syncEndpoint, 'sync')}
              >
                {copied === 'sync' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Syncs market data for all holdings and watchlist items, updates cache, and checks portfolio alerts.
            </p>
          </div>

          {/* Alert Check Endpoint */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Badge variant="outline">POST</Badge>
              Alert Check Endpoint
            </Label>
            <div className="flex gap-2">
              <Input value={alertEndpoint} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(alertEndpoint, 'alert')}
              >
                {copied === 'alert' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Checks portfolio alerts against cached prices and sends email notifications for triggered alerts.
            </p>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <h4 className="font-medium">Setup Instructions</h4>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Sign up for a free cron scheduler (e.g., cron-job.org, EasyCron)</li>
              <li>Create a new cron job with the endpoint URL above</li>
              <li>Set schedule to <code className="bg-muted px-1 rounded">0 */6 * * *</code> (every 6 hours)</li>
              <li>Set HTTP method to <code className="bg-muted px-1 rounded">POST</code></li>
              <li>Add header: <code className="bg-muted px-1 rounded">Content-Type: application/json</code></li>
              <li>Request body: <code className="bg-muted px-1 rounded">{'{}'}</code></li>
            </ol>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  cron-job.org
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.easycron.com" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  EasyCron
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduledSyncManager;
