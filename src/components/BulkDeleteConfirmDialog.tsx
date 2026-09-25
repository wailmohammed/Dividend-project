import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface HoldingItem {
  id: string;
  symbol: string;
  name?: string;
  shares: number;
  value: number;
}

interface BulkDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdings: HoldingItem[];
  onConfirm: () => void;
  isDeleting: boolean;
}

export const BulkDeleteConfirmDialog = ({
  open,
  onOpenChange,
  holdings,
  onConfirm,
  isDeleting
}: BulkDeleteConfirmDialogProps) => {
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const soldCount = holdings.filter(h => h.shares < 0.0001).length;
  const activeCount = holdings.length - soldCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Confirm Bulk Delete
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete {holdings.length} holding(s). This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total holdings to delete:</span>
            <span className="font-semibold">{holdings.length}</span>
          </div>
          {soldCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sold positions (0 shares):</span>
              <span className="text-amber-500">{soldCount}</span>
            </div>
          )}
          {activeCount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active positions:</span>
              <span className="text-destructive">{activeCount}</span>
            </div>
          )}
          {totalValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total value being removed:</span>
              <span className="font-semibold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <ScrollArea className="max-h-[200px] border rounded-lg p-2">
          <div className="space-y-1">
            {holdings.map((h) => (
              <div 
                key={h.id} 
                className={`flex items-center justify-between py-1 px-2 rounded text-sm ${h.shares < 0.0001 ? 'bg-muted/50 text-muted-foreground' : 'bg-destructive/10'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{h.symbol}</span>
                  {h.shares < 0.0001 && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Sold</span>
                  )}
                </div>
                <div className="text-right text-xs">
                  <span>{h.shares.toFixed(h.shares < 1 ? 4 : 2)} shares</span>
                  {h.value > 0 && (
                    <span className="ml-2 text-muted-foreground">${h.value.toFixed(2)}</span>
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
            {isDeleting ? 'Deleting...' : `Delete ${holdings.length} Holding(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
