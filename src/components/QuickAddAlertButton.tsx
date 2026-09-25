import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { usePortfolioAlerts, PortfolioAlert } from '@/hooks/usePortfolioAlerts';
import { Bell, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const ALERT_TYPES = [
  { value: 'price_movement', label: 'Price Movement', icon: TrendingUp },
  { value: 'dividend_cut', label: 'Dividend Cut', icon: TrendingDown },
  { value: 'dividend_increase', label: 'Dividend Increase', icon: DollarSign },
  { value: 'earnings_surprise', label: 'Earnings Surprise', icon: Calendar },
] as const;

interface QuickAddAlertButtonProps {
  symbol: string;
  holdingName?: string;
}

export const QuickAddAlertButton: React.FC<QuickAddAlertButtonProps> = ({ symbol, holdingName }) => {
  const { createAlert, alerts } = usePortfolioAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertType, setAlertType] = useState<PortfolioAlert['alert_type']>('price_movement');
  const [threshold, setThreshold] = useState(5);
  const [notes, setNotes] = useState('');

  // Check if alerts already exist for this symbol
  const existingAlerts = alerts.filter(a => a.symbol === symbol && a.is_active);

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      await createAlert(
        symbol,
        alertType,
        alertType === 'price_movement' ? threshold : undefined,
        notes || undefined
      );
      toast.success(`Alert created for ${symbol}`);
      setIsOpen(false);
      setAlertType('price_movement');
      setThreshold(5);
      setNotes('');
    } catch (err) {
      console.error('Failed to create alert:', err);
      toast.error('Failed to create alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={`Add alert for ${symbol}`}
      >
        <Bell className="w-4 h-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Quick Add Alert for {symbol}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Symbol Display */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="font-semibold">{symbol}</div>
              {holdingName && (
                <div className="text-sm text-muted-foreground">{holdingName}</div>
              )}
            </div>

            {/* Existing Alerts Warning */}
            {existingAlerts.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                <span className="text-amber-600 dark:text-amber-400">
                  You have {existingAlerts.length} active alert(s) for this symbol
                </span>
              </div>
            )}

            {/* Alert Type */}
            <div className="space-y-2">
              <Label>Alert Type</Label>
              <Select
                value={alertType}
                onValueChange={(v: PortfolioAlert['alert_type']) => setAlertType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Threshold for price movement */}
            {alertType === 'price_movement' && (
              <div className="space-y-2">
                <Label>Threshold (%)</Label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  min={1}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when price changes by ±{threshold}%
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
              />
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreate}
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  Create Alert
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickAddAlertButton;
