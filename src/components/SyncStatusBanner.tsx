import React from 'react';
import { useBrokerConnections } from '@/hooks/useBrokerConnections';
import { useBrokerSync } from '@/hooks/useBrokerSync';
import { usePortfolio } from '@/context/PortfolioContext';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SyncStatusBanner: React.FC = () => {
  const { connections } = useBrokerConnections();
  const { syncing, syncAllBrokers } = useBrokerSync();
  const { activePortfolio } = usePortfolio();

  if (!connections || connections.length === 0) return null;

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const hasErrors = connections.some(c => c.sync_error);
  const lastSync = connections
    .filter(c => c.last_sync)
    .sort((a, b) => new Date(b.last_sync!).getTime() - new Date(a.last_sync!).getTime())[0]?.last_sync;

  const StatusIcon = hasErrors ? AlertCircle : connectedCount > 0 ? CheckCircle : Clock;
  const statusColor = hasErrors ? 'text-destructive' : connectedCount > 0 ? 'text-emerald-500' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card/50 border-b border-border text-sm">
      <Wifi className={`w-4 h-4 ${statusColor}`} />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
        <span className="text-foreground font-medium">
          {connectedCount} broker{connectedCount !== 1 ? 's' : ''} connected
        </span>
        {lastSync && (
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Synced {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
          </span>
        )}
        {hasErrors && (
          <span className="text-destructive text-xs">• Sync issues detected</span>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden sm:block">Next sync: ~midnight UTC</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => activePortfolio?.id && syncAllBrokers(activePortfolio.id)}
        disabled={syncing}
        className="h-7 text-xs gap-1.5"
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Sync Now'}
      </Button>
    </div>
  );
};

export default SyncStatusBanner;
