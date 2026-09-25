import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { AlarmClockOff } from 'lucide-react';

interface AlertSnoozeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  alertType: string;
  onSnooze: (durationMinutes: number, reason: string) => void;
}

const SNOOZE_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '1 day', minutes: 1440 },
  { label: '1 week', minutes: 10080 },
];

export const AlertSnoozeDialog: React.FC<AlertSnoozeDialogProps> = ({
  open, onOpenChange, symbol, alertType, onSnooze,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [reason, setReason] = useState('');

  const handleSnooze = () => {
    onSnooze(selectedMinutes, reason);
    setReason('');
    setSelectedMinutes(60);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClockOff className="w-5 h-5 text-amber-500" />
            Snooze Alert
          </DialogTitle>
          <DialogDescription>
            Mute <span className="font-semibold text-foreground">{symbol}</span>{' '}
            <span className="text-muted-foreground">({alertType.replace(/_/g, ' ')})</span> for a set duration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Duration</label>
            <div className="flex flex-wrap gap-2">
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes}
                  onClick={() => setSelectedMinutes(opt.minutes)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selectedMinutes === opt.minutes
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Reason (optional)</label>
            <Textarea
              placeholder="e.g. Expected volatility due to earnings..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSnooze} className="gap-1.5">
            <AlarmClockOff className="w-4 h-4" />
            Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
