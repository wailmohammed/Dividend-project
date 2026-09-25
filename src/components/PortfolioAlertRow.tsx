import React, { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { PortfolioAlert, AlertType } from '@/hooks/usePortfolioAlerts';
import { Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, Check, X, Pencil, Copy, BarChart3, Activity, GitBranch } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CloneAlertDialog } from './alerts/CloneAlertDialog';

const ALERT_TYPES = [
  { value: 'price_movement', label: 'Price Movement', icon: TrendingUp, hasThreshold: true },
  { value: 'dividend_cut', label: 'Dividend Cut', icon: TrendingDown, hasThreshold: false },
  { value: 'dividend_increase', label: 'Dividend Increase', icon: DollarSign, hasThreshold: false },
  { value: 'earnings_surprise', label: 'Earnings Surprise', icon: Calendar, hasThreshold: true },
  { value: 'volume_spike', label: 'Volume Spike', icon: BarChart3, hasThreshold: true },
  { value: 'rsi_threshold', label: 'RSI Threshold', icon: Activity, hasThreshold: true },
  { value: 'ma_crossover', label: 'MA Crossover', icon: GitBranch, hasThreshold: false },
];

interface Holding {
  symbol: string;
  name: string;
}

interface PortfolioAlertRowProps {
  alert: PortfolioAlert;
  onUpdate: (alertId: string, updates: Partial<Pick<PortfolioAlert, 'threshold_percent' | 'is_active' | 'notes'>>) => Promise<void>;
  onDelete: (alertId: string) => Promise<void>;
  onClone?: (
    symbol: string,
    alertType: PortfolioAlert['alert_type'],
    thresholdPercent?: number,
    notes?: string
  ) => Promise<any>;
  holdings?: Holding[];
}

export const PortfolioAlertRow: React.FC<PortfolioAlertRowProps> = ({
  alert,
  onUpdate,
  onDelete,
  onClone,
  holdings = [],
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [editValues, setEditValues] = useState({
    threshold_percent: alert.threshold_percent || 5,
    notes: alert.notes || '',
  });

  const typeInfo = ALERT_TYPES.find(t => t.value === alert.alert_type) || ALERT_TYPES[0];
  const IconComponent = typeInfo.icon;

  const handleSave = async () => {
    await onUpdate(alert.id, {
      threshold_percent: alert.alert_type === 'price_movement' ? editValues.threshold_percent : null,
      notes: editValues.notes || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValues({
      threshold_percent: alert.threshold_percent || 5,
      notes: alert.notes || '',
    });
    setIsEditing(false);
  };

  return (
    <div 
      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
        alert.triggered_at ? 'bg-amber-500/10 border-amber-500/30' : 
        alert.is_active ? 'bg-muted/30 border-border' : 'bg-muted/10 border-border opacity-60'
      }`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          alert.triggered_at ? 'bg-amber-500/20' : 'bg-primary/10'
        }`}>
          <IconComponent className={`w-5 h-5 ${
            alert.triggered_at ? 'text-amber-500' : 'text-primary'
          }`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">{alert.symbol}</span>
            <Badge variant={alert.is_active ? 'default' : 'secondary'}>
              {typeInfo.label}
            </Badge>
            {alert.triggered_at && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-500">
                Triggered
              </Badge>
            )}
          </div>
          
          {isEditing ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2">
              {typeInfo.hasThreshold && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {alert.alert_type === 'rsi_threshold' ? 'RSI:' : 
                     alert.alert_type === 'volume_spike' ? 'Volume:' : 'Threshold:'}
                  </span>
                  <Input
                    type="number"
                    value={editValues.threshold_percent}
                    onChange={(e) => setEditValues(prev => ({ ...prev, threshold_percent: Number(e.target.value) }))}
                    className="w-16 h-7 text-xs"
                    min={1}
                    max={alert.alert_type === 'rsi_threshold' ? 100 : 1000}
                  />
                  <span className="text-xs text-muted-foreground">
                    {alert.alert_type === 'rsi_threshold' ? '' : '%'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">Notes:</span>
                <Input
                  value={editValues.notes}
                  onChange={(e) => setEditValues(prev => ({ ...prev, notes: e.target.value }))}
                  className="flex-1 h-7 text-xs"
                  placeholder="Add notes..."
                />
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                {typeInfo.hasThreshold && alert.threshold_percent && (
                  <span>
                    {alert.alert_type === 'rsi_threshold' && `RSI: ${alert.threshold_percent}`}
                    {alert.alert_type === 'volume_spike' && `Volume: ${alert.threshold_percent}%`}
                    {alert.alert_type === 'price_movement' && `Threshold: ±${alert.threshold_percent}%`}
                    {alert.alert_type === 'earnings_surprise' && `Surprise: ${alert.threshold_percent}%`}
                  </span>
                )}
                {alert.notes && <span className="ml-2">• {alert.notes}</span>}
              </div>
              {alert.triggered_at && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Triggered {format(parseISO(alert.triggered_at), 'MMM dd, yyyy HH:mm')}
                  {alert.trigger_value && ` at $${alert.trigger_value.toFixed(2)}`}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8"
              title="Edit alert"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            {onClone && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCloneDialogOpen(true)}
                className="h-8 w-8"
                title="Clone alert to another symbol"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
            <Switch
              checked={alert.is_active}
              onCheckedChange={(checked) => onUpdate(alert.id, { is_active: checked })}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(alert.id)}
              className="h-8 w-8 text-destructive hover:text-destructive"
              title="Delete alert"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {onClone && (
        <CloneAlertDialog
          open={isCloneDialogOpen}
          onOpenChange={setIsCloneDialogOpen}
          alert={alert}
          holdings={holdings}
          onClone={onClone}
        />
      )}
    </div>
  );
};
