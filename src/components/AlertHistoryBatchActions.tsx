import React, { useState } from 'react';
import { Button } from './ui/button';
import { AlertSnoozeDialog } from './AlertSnoozeDialog';
import { Check, AlarmClockOff, X, CheckCircle2 } from 'lucide-react';

interface AlertHistoryBatchActionsProps {
  selectedCount: number;
  onAcknowledgeAll: () => void;
  onUnacknowledgeAll: () => void;
  onSnoozeAll: (minutes: number, reason: string) => void;
  onUnsnoozeAll: () => void;
  onClearSelection: () => void;
}

export const AlertHistoryBatchActions: React.FC<AlertHistoryBatchActionsProps> = ({
  selectedCount,
  onAcknowledgeAll,
  onUnacknowledgeAll,
  onSnoozeAll,
  onUnsnoozeAll,
  onClearSelection,
}) => {
  const [showSnooze, setShowSnooze] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl mb-3 flex-wrap">
        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground">
          {selectedCount} selected
        </span>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onAcknowledgeAll}>
            <Check className="w-3 h-3" /> Acknowledge
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onUnacknowledgeAll}>
            Unacknowledge
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowSnooze(true)}>
            <AlarmClockOff className="w-3 h-3" /> Snooze
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onUnsnoozeAll}>
            Unsnooze
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={onClearSelection}>
            <X className="w-3 h-3" /> Clear
          </Button>
        </div>
      </div>

      {showSnooze && (
        <AlertSnoozeDialog
          open={showSnooze}
          onOpenChange={setShowSnooze}
          symbol={`${selectedCount} alerts`}
          alertType="batch"
          onSnooze={(minutes, reason) => {
            onSnoozeAll(minutes, reason);
            setShowSnooze(false);
          }}
        />
      )}
    </>
  );
};
