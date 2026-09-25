import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Copy, AlertTriangle } from 'lucide-react';
import { PortfolioAlert } from '@/hooks/usePortfolioAlerts';
import { Badge } from '../ui/badge';

interface Holding {
  symbol: string;
  name: string;
}

interface BatchCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: PortfolioAlert[];
  holdings: Holding[];
  onClone: (
    symbol: string,
    alertType: PortfolioAlert['alert_type'],
    thresholdPercent?: number,
    notes?: string
  ) => Promise<any>;
}

export const BatchCloneDialog: React.FC<BatchCloneDialogProps> = ({
  open,
  onOpenChange,
  alerts,
  holdings,
  onClone,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleClone = async () => {
    const symbol = selectedSymbol === '__custom__' ? customSymbol.toUpperCase().trim() : selectedSymbol;
    if (!symbol || alerts.length === 0) return;

    setIsCloning(true);
    setProgress({ current: 0, total: alerts.length });

    try {
      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        await onClone(
          symbol,
          alert.alert_type,
          alert.threshold_percent || undefined,
          alert.notes || undefined
        );
        setProgress({ current: i + 1, total: alerts.length });
      }
      onOpenChange(false);
    } finally {
      setIsCloning(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  // Get unique alert types being cloned
  const alertTypeSummary = alerts.reduce((acc, alert) => {
    acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get symbols that already have alerts from the selected alerts
  const existingSymbols = new Set(alerts.map(a => a.symbol));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Batch Clone Alerts
          </DialogTitle>
          <DialogDescription>
            Clone {alerts.length} selected alert{alerts.length !== 1 ? 's' : ''} to a new symbol
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Alerts Summary */}
          <div className="space-y-2">
            <Label>Alerts to Clone</Label>
            <div className="p-3 rounded-lg bg-muted/50 border max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {Object.entries(alertTypeSummary).map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {type.replace('_', ' ')} ({count})
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                From symbols: {Array.from(existingSymbols).join(', ')}
              </div>
            </div>
          </div>

          {/* Target Symbol Selection */}
          <div className="space-y-2">
            <Label>Target Symbol</Label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Select a symbol" />
              </SelectTrigger>
              <SelectContent>
                {holdings
                  .filter(h => !existingSymbols.has(h.symbol))
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

          {/* Warning about duplicates */}
          {existingSymbols.has(selectedSymbol) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <p className="text-sm text-warning">
                This symbol already has alerts in your selection
              </p>
            </div>
          )}

          {/* Progress */}
          {isCloning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cloning alerts...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCloning}>
            Cancel
          </Button>
          <Button
            onClick={handleClone}
            disabled={isCloning || !selectedSymbol || (selectedSymbol === '__custom__' && !customSymbol.trim())}
          >
            {isCloning ? `Cloning ${progress.current}/${progress.total}...` : `Clone ${alerts.length} Alert${alerts.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
