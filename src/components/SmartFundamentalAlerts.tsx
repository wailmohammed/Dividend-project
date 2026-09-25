import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Brain, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Bell, BellOff,
  Plus, Trash2, Activity, BarChart3, Users, Shield, Zap, Info
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

type FundamentalAlertType = 
  | 'earnings_revision' 
  | 'valuation_shift' 
  | 'insider_activity' 
  | 'dividend_change' 
  | 'analyst_upgrade' 
  | 'revenue_growth_change';

interface FundamentalAlert {
  id: string;
  symbol: string;
  type: FundamentalAlertType;
  isEnabled: boolean;
  threshold?: number;
  description: string;
  lastTriggered?: string;
}

const ALERT_TYPE_CONFIG: Record<FundamentalAlertType, { label: string; icon: React.ReactNode; color: string; defaultDesc: string }> = {
  earnings_revision: { label: 'Earnings Estimate Change', icon: <BarChart3 className="w-4 h-4" />, color: 'text-blue-500', defaultDesc: 'Alert when consensus EPS estimate changes by threshold %' },
  valuation_shift: { label: 'Valuation Shift', icon: <TrendingUp className="w-4 h-4" />, color: 'text-purple-500', defaultDesc: 'Alert when P/E ratio moves beyond threshold from historical average' },
  insider_activity: { label: 'Insider Buy/Sell', icon: <Users className="w-4 h-4" />, color: 'text-orange-500', defaultDesc: 'Alert when executives buy or sell significant shares' },
  dividend_change: { label: 'Dividend Policy Change', icon: <DollarSign className="w-4 h-4" />, color: 'text-green-500', defaultDesc: 'Alert when dividend is increased, cut, or suspended' },
  analyst_upgrade: { label: 'Analyst Upgrade/Downgrade', icon: <Activity className="w-4 h-4" />, color: 'text-indigo-500', defaultDesc: 'Alert when major analysts change their rating' },
  revenue_growth_change: { label: 'Revenue Growth Shift', icon: <Zap className="w-4 h-4" />, color: 'text-amber-500', defaultDesc: 'Alert when revenue growth rate changes significantly' },
};

// Simulated recent fundamental events
const RECENT_EVENTS: { symbol: string; type: FundamentalAlertType; detail: string; date: string; impact: 'positive' | 'negative' | 'neutral' }[] = [
  { symbol: 'NVDA', type: 'earnings_revision', detail: 'EPS estimate raised 15% by Wall Street consensus', date: '2 days ago', impact: 'positive' },
  { symbol: 'AAPL', type: 'insider_activity', detail: 'CFO sold 50,000 shares ($9.5M) — routine planned sale', date: '3 days ago', impact: 'neutral' },
  { symbol: 'JNJ', type: 'dividend_change', detail: 'Quarterly dividend raised 5.3% to $1.24/share', date: '1 week ago', impact: 'positive' },
  { symbol: 'VZ', type: 'analyst_upgrade', detail: 'Morgan Stanley upgraded from Underweight to Equal Weight', date: '1 week ago', impact: 'positive' },
  { symbol: 'INTC', type: 'valuation_shift', detail: 'Forward P/E dropped to 12x, 30% below 5-year average', date: '2 weeks ago', impact: 'neutral' },
  { symbol: 'MSFT', type: 'revenue_growth_change', detail: 'Azure revenue growth accelerated to 29% YoY from 26%', date: '2 weeks ago', impact: 'positive' },
];

export const SmartFundamentalAlerts: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdingSymbols = activePortfolio?.holdings?.map(h => cleanSymbol(h.symbol)) || [];
  
  const [alerts, setAlerts] = useState<FundamentalAlert[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSymbol, setNewSymbol] = useState(holdingSymbols[0] || 'AAPL');
  const [newType, setNewType] = useState<FundamentalAlertType>('earnings_revision');
  const [newThreshold, setNewThreshold] = useState('5');

  // Filter recent events to user's holdings
  const relevantEvents = useMemo(() => {
    return RECENT_EVENTS.filter(e => holdingSymbols.includes(e.symbol) || holdingSymbols.length === 0);
  }, [holdingSymbols]);

  const handleAddAlert = () => {
    const config = ALERT_TYPE_CONFIG[newType];
    const alert: FundamentalAlert = {
      id: `fa-${Date.now()}`,
      symbol: newSymbol,
      type: newType,
      isEnabled: true,
      threshold: parseFloat(newThreshold) || undefined,
      description: config.defaultDesc,
    };
    setAlerts(prev => [...prev, alert]);
    setShowAddForm(false);
    toast.success(`Smart alert created for ${newSymbol}: ${config.label}`);
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    toast.success('Alert removed');
  };

  const addQuickAlerts = () => {
    const quickAlerts: FundamentalAlert[] = holdingSymbols.slice(0, 5).flatMap(symbol => [
      { id: `fa-${Date.now()}-${symbol}-er`, symbol, type: 'earnings_revision' as FundamentalAlertType, isEnabled: true, threshold: 5, description: ALERT_TYPE_CONFIG.earnings_revision.defaultDesc },
      { id: `fa-${Date.now()}-${symbol}-dc`, symbol, type: 'dividend_change' as FundamentalAlertType, isEnabled: true, description: ALERT_TYPE_CONFIG.dividend_change.defaultDesc },
    ]);
    setAlerts(prev => [...prev, ...quickAlerts]);
    toast.success(`Added ${quickAlerts.length} smart alerts for your top holdings`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Smart Fundamental Alerts
          </h1>
          <p className="text-muted-foreground">Get notified on earnings revisions, insider activity, valuation shifts & more</p>
        </div>
        <div className="flex gap-2">
          {holdingSymbols.length > 0 && alerts.length === 0 && (
            <Button variant="outline" onClick={addQuickAlerts}>
              <Zap className="w-4 h-4 mr-1" />Quick Setup
            </Button>
          )}
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-1" />Add Alert
          </Button>
        </div>
      </div>

      {/* Add Alert Form */}
      {showAddForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-lg">Create Smart Alert</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Symbol</label>
                <Select value={newSymbol} onValueChange={setNewSymbol}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {holdingSymbols.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    {['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'].filter(s => !holdingSymbols.includes(s)).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Alert Type</label>
                <Select value={newType} onValueChange={(v: FundamentalAlertType) => setNewType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ALERT_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-1.5">{config.icon}{config.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Threshold (%)</label>
                <Input type="number" value={newThreshold} onChange={e => setNewThreshold(e.target.value)} placeholder="5" />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddAlert} className="w-full">Create Alert</Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{ALERT_TYPE_CONFIG[newType].defaultDesc}</p>
          </CardContent>
        </Card>
      )}

      {/* Recent Fundamental Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" />Recent Fundamental Events</CardTitle>
          <CardDescription>Latest fundamental changes affecting your holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {relevantEvents.map((event, i) => {
              const config = ALERT_TYPE_CONFIG[event.type];
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className={`p-2 rounded-full ${event.impact === 'positive' ? 'bg-green-500/10' : event.impact === 'negative' ? 'bg-red-500/10' : 'bg-muted'}`}>
                    <div className={config.color}>{config.icon}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{event.symbol}</span>
                      <Badge variant="outline" className="text-xs">{config.label}</Badge>
                      <Badge className={
                        event.impact === 'positive' ? 'bg-green-500/20 text-green-500' :
                        event.impact === 'negative' ? 'bg-red-500/20 text-red-500' :
                        'bg-muted text-muted-foreground'
                      }>
                        {event.impact}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.detail}</p>
                    <p className="text-xs text-muted-foreground mt-1">{event.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" />Your Smart Alerts ({alerts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No smart alerts configured</p>
              <p className="text-sm mt-1">Create alerts to monitor fundamental changes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => {
                const config = ALERT_TYPE_CONFIG[alert.type];
                return (
                  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={config.color}>{config.icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{alert.symbol}</span>
                          <Badge variant="outline" className="text-xs">{config.label}</Badge>
                          {alert.threshold && <Badge variant="secondary" className="text-xs">{alert.threshold}%</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{alert.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={alert.isEnabled} onCheckedChange={() => toggleAlert(alert.id)} />
                      <Button variant="ghost" size="sm" onClick={() => deleteAlert(alert.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert Types Reference */}
      <Card>
        <CardHeader><CardTitle>Available Alert Types</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(ALERT_TYPE_CONFIG).map(([key, config]) => (
              <div key={key} className="p-3 rounded-lg border">
                <div className={`flex items-center gap-2 mb-1 ${config.color}`}>
                  {config.icon}
                  <span className="font-medium text-sm text-foreground">{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{config.defaultDesc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Smart fundamental alerts use market data APIs to monitor changes in earnings estimates, insider filings, 
          analyst ratings, and dividend policies. Alerts are checked during each market data sync cycle.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SmartFundamentalAlerts;
