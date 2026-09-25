import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Copy } from 'lucide-react';
import { PortfolioAlert, AlertType } from '@/hooks/usePortfolioAlerts';

interface Holding {
  symbol: string;
  name: string;
}

interface CloneAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: PortfolioAlert;
  holdings: Holding[];
  onClone: (
    symbol: string,
    alertType: AlertType,
    thresholdPercent?: number,
    notes?: string
  ) => Promise<any>;
}

export const CloneAlertDialog: React.FC<CloneAlertDialogProps> = ({
  open,
  onOpenChange,
  alert,
  holdings,
  onClone,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(alert.symbol);
  const [customSymbol, setCustomSymbol] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  const handleClone = async () => {
    const symbol = selectedSymbol === '__custom__' ? customSymbol.toUpperCase().trim() : selectedSymbol;
    if (!symbol) return;

    setIsCloning(true);
    try {
      await onClone(
        symbol,
        alert.alert_type,
        alert.threshold_percent || undefined,
        alert.notes || undefined
      );
      onOpenChange(false);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Clone Alert
          </DialogTitle>
          <DialogDescription>
            Create a copy of this alert for a different symbol
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Original Alert</Label>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2">
                <span className="font-bold">{alert.symbol}</span>
                <span className="text-sm text-muted-foreground">
                  {alert.alert_type.replace('_', ' ')}
                </span>
              </div>
              {alert.threshold_percent && (
                <div className="text-sm text-muted-foreground mt-1">
                  Threshold: ±{alert.threshold_percent}%
                </div>
              )}
              {alert.notes && (
                <div className="text-sm text-muted-foreground mt-1">
                  Notes: {alert.notes}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Symbol</Label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Select a symbol" />
              </SelectTrigger>
              <SelectContent>
                {holdings
                  .filter(h => h.symbol !== alert.symbol)
                  .map((holding) => (
                    <SelectItem key={holding.symbol} value={holding.symbol}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{holding.symbol}</span>
                        <span className="text-muted-foreground text-sm truncate max-w-[150px]">
                          {holding.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                <SelectItem value="__custom__">
                  <span className="text-muted-foreground">Enter custom symbol...</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedSymbol === '__custom__' && (
            <div className="space-y-2">
              <Label>Custom Symbol</Label>
              <Input
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                placeholder="e.g., AAPL"
                maxLength={10}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={isCloning || (!selectedSymbol || (selectedSymbol === '__custom__' && !customSymbol.trim()))}
          >
            {isCloning ? 'Cloning...' : 'Clone Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
