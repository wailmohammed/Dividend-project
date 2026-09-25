import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, Activity, GitBranch } from 'lucide-react';
import { PortfolioAlert, AlertType } from '@/hooks/usePortfolioAlerts';

const ALERT_TYPES = [
  { value: 'price_movement', label: 'Price Movement', icon: TrendingUp, description: 'Alert when price changes by threshold %', hasThreshold: true },
  { value: 'dividend_cut', label: 'Dividend Cut', icon: TrendingDown, description: 'Alert when dividend is reduced', hasThreshold: false },
  { value: 'dividend_increase', label: 'Dividend Increase', icon: DollarSign, description: 'Alert when dividend is increased', hasThreshold: false },
  { value: 'earnings_surprise', label: 'Earnings Surprise', icon: Calendar, description: 'Alert on unexpected earnings results', hasThreshold: true },
  { value: 'volume_spike', label: 'Volume Spike', icon: BarChart3, description: 'Alert when trading volume exceeds threshold % of average', hasThreshold: true },
  { value: 'rsi_threshold', label: 'RSI Threshold', icon: Activity, description: 'Alert when RSI crosses overbought/oversold levels', hasThreshold: true },
  { value: 'ma_crossover', label: 'MA Crossover', icon: GitBranch, description: 'Alert on moving average crossovers (50/200 day)', hasThreshold: false },
];
 
 interface AddAlertDialogProps {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
   holdings: { id: string; symbol: string; name: string }[];
   onCreateAlert: (symbol: string, type: PortfolioAlert['alert_type'], threshold?: number, notes?: string) => Promise<any>;
 }
 
 export const AddAlertDialog: React.FC<AddAlertDialogProps> = ({
   isOpen,
   onOpenChange,
   holdings,
   onCreateAlert,
 }) => {
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    alertType: 'price_movement' as AlertType,
    thresholdPercent: 5,
    notes: '',
  });

  const handleCreateAlert = async () => {
    if (!newAlert.symbol) return;
    const typeInfo = ALERT_TYPES.find(t => t.value === newAlert.alertType);
    await onCreateAlert(
      newAlert.symbol,
      newAlert.alertType,
      typeInfo?.hasThreshold ? newAlert.thresholdPercent : undefined,
      newAlert.notes || undefined
    );
    setNewAlert({ symbol: '', alertType: 'price_movement', thresholdPercent: 5, notes: '' });
    onOpenChange(false);
  };
 
   const getAlertTypeInfo = (type: string) => ALERT_TYPES.find(t => t.value === type) || ALERT_TYPES[0];
 
   return (
     <Dialog open={isOpen} onOpenChange={onOpenChange}>
       <DialogTrigger asChild>
         <Button>
           <Plus className="w-4 h-4 mr-2" />
           Add Alert
         </Button>
       </DialogTrigger>
       <DialogContent>
         <DialogHeader>
           <DialogTitle>Create New Alert</DialogTitle>
         </DialogHeader>
         <div className="space-y-4 pt-4">
           <div className="space-y-2">
             <Label>Symbol</Label>
             <Select value={newAlert.symbol} onValueChange={(v) => setNewAlert(p => ({ ...p, symbol: v }))}>
               <SelectTrigger>
                 <SelectValue placeholder="Select a holding" />
               </SelectTrigger>
               <SelectContent>
                 {holdings.map(h => (
                   <SelectItem key={h.id} value={h.symbol}>
                     {h.symbol} - {h.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
          <div className="space-y-2">
            <Label>Alert Type</Label>
            <Select value={newAlert.alertType} onValueChange={(v: AlertType) => setNewAlert(p => ({ ...p, alertType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
             <p className="text-xs text-muted-foreground">{getAlertTypeInfo(newAlert.alertType).description}</p>
           </div>
          {getAlertTypeInfo(newAlert.alertType).hasThreshold && (
            <div className="space-y-2">
              <Label>
                {newAlert.alertType === 'rsi_threshold' ? 'RSI Level' : 
                 newAlert.alertType === 'volume_spike' ? 'Volume Threshold (% of avg)' :
                 'Threshold (%)'}
              </Label>
              <Input 
                type="number" 
                value={newAlert.thresholdPercent} 
                onChange={(e) => setNewAlert(p => ({ ...p, thresholdPercent: Number(e.target.value) }))} 
                min={newAlert.alertType === 'rsi_threshold' ? 1 : 1} 
                max={newAlert.alertType === 'rsi_threshold' ? 100 : 1000} 
              />
              <p className="text-xs text-muted-foreground">
                {newAlert.alertType === 'price_movement' && `Alert when price changes by ±${newAlert.thresholdPercent}%`}
                {newAlert.alertType === 'earnings_surprise' && `Alert on earnings surprise ≥${newAlert.thresholdPercent}%`}
                {newAlert.alertType === 'volume_spike' && `Alert when volume exceeds ${newAlert.thresholdPercent}% of average`}
                {newAlert.alertType === 'rsi_threshold' && `Alert when RSI crosses ${newAlert.thresholdPercent}`}
              </p>
            </div>
          )}
           <div className="space-y-2">
             <Label>Notes (optional)</Label>
             <Input value={newAlert.notes} onChange={(e) => setNewAlert(p => ({ ...p, notes: e.target.value }))} placeholder="Add any notes..." />
           </div>
           <Button onClick={handleCreateAlert} className="w-full" disabled={!newAlert.symbol}>Create Alert</Button>
         </div>
       </DialogContent>
     </Dialog>
   );
 };