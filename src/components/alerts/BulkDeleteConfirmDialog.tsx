import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { PortfolioAlert } from '@/hooks/usePortfolioAlerts';

interface BulkDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: PortfolioAlert[];
  onConfirm: () => void;
  isDeleting: boolean;
}

export const BulkDeleteConfirmDialog: React.FC<BulkDeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  alerts,
  onConfirm,
  isDeleting
}) => {
  const activeCount = alerts.filter(a => a.is_active).length;
  const triggeredCount = alerts.filter(a => a.triggered_at).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Confirm Bulk Delete
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete {alerts.length} alert(s). This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total alerts to delete:</span>
            <span className="font-semibold">{alerts.length}</span>
          </div>
          {activeCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active alerts:</span>
              <span className="text-primary">{activeCount}</span>
            </div>
          )}
          {triggeredCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Previously triggered:</span>
              <span className="text-warning">{triggeredCount}</span>
            </div>
          )}
        </div>

        <ScrollArea className="max-h-[200px] border rounded-lg p-2">
          <div className="space-y-1">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`flex items-center justify-between py-1 px-2 rounded text-sm ${!alert.is_active ? 'bg-muted/50 text-muted-foreground' : 'bg-destructive/10'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{alert.symbol}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {alert.alert_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right text-xs">
                  {alert.threshold_percent && (
                    <span>{alert.threshold_percent}%</span>
                  )}
                  {!alert.is_active && (
                    <span className="ml-2 bg-muted px-1.5 py-0.5 rounded">Inactive</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? 'Deleting...' : `Delete ${alerts.length} Alert(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
