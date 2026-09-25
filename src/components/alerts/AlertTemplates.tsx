import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { TrendingDown, DollarSign, TrendingUp, Zap, Activity, BarChart3, GitBranch } from 'lucide-react';
import { PortfolioAlert, AlertType } from '@/hooks/usePortfolioAlerts';
import { toast } from 'sonner';

const TEMPLATES = [
  { id: 'price_drop_10', label: 'Price Drop 10%', type: 'price_movement' as AlertType, threshold: 10, notes: 'Alert on 10% price drop', icon: TrendingDown, color: 'text-destructive' },
  { id: 'price_drop_5', label: 'Price Drop 5%', type: 'price_movement' as AlertType, threshold: 5, notes: 'Alert on 5% price drop', icon: TrendingDown, color: 'text-warning' },
  { id: 'price_rise_10', label: 'Price Rise 10%', type: 'price_movement' as AlertType, threshold: -10, notes: 'Alert on 10% price increase', icon: TrendingUp, color: 'text-primary' },
  { id: 'dividend_cut', label: 'Dividend Cut', type: 'dividend_cut' as AlertType, threshold: null, notes: 'Monitor for dividend reductions', icon: DollarSign, color: 'text-warning' },
  { id: 'dividend_increase', label: 'Dividend Increase', type: 'dividend_increase' as AlertType, threshold: null, notes: 'Track dividend growth', icon: TrendingUp, color: 'text-primary' },
  { id: 'volume_spike', label: 'Volume Spike 200%', type: 'volume_spike' as AlertType, threshold: 200, notes: 'Alert when volume exceeds 2x average', icon: BarChart3, color: 'text-amber-500' },
  { id: 'rsi_overbought', label: 'RSI Overbought (70)', type: 'rsi_threshold' as AlertType, threshold: 70, notes: 'Alert when RSI crosses above 70', icon: Activity, color: 'text-destructive' },
  { id: 'rsi_oversold', label: 'RSI Oversold (30)', type: 'rsi_threshold' as AlertType, threshold: 30, notes: 'Alert when RSI crosses below 30', icon: Activity, color: 'text-emerald-500' },
  { id: 'ma_crossover', label: 'MA Crossover', type: 'ma_crossover' as AlertType, threshold: null, notes: '50/200 day moving average crossover', icon: GitBranch, color: 'text-primary' },
  { id: 'earnings_beat', label: 'Earnings Beat', type: 'earnings_surprise' as AlertType, threshold: 5, notes: 'Alert on 5%+ earnings surprise', icon: BarChart3, color: 'text-primary' },
  { id: 'earnings_miss', label: 'Earnings Miss', type: 'earnings_surprise' as AlertType, threshold: -5, notes: 'Alert on earnings miss > 5%', icon: BarChart3, color: 'text-destructive' },
];

interface AlertTemplatesProps {
  holdings: { id: string; symbol: string; name: string }[];
  onCreateAlert: (symbol: string, type: PortfolioAlert['alert_type'], threshold?: number, notes?: string) => Promise<any>;
}

export const AlertTemplates: React.FC<AlertTemplatesProps> = ({ holdings, onCreateAlert }) => {
  const [selectedSymbol, setSelectedSymbol] = React.useState('');

  const applyTemplate = async (template: typeof TEMPLATES[0]) => {
    if (!selectedSymbol) {
      toast.error('Please select a symbol first');
      return;
    }
    await onCreateAlert(selectedSymbol, template.type, template.threshold || undefined, template.notes);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Quick Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select symbol" />
            </SelectTrigger>
            <SelectContent>
              {holdings.map(h => (
                <SelectItem key={h.id} value={h.symbol}>{h.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {TEMPLATES.map(template => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              onClick={() => applyTemplate(template)}
              disabled={!selectedSymbol}
              className="gap-1"
            >
              <template.icon className={`w-3 h-3 ${template.color}`} />
              {template.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
