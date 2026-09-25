import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown, Mail, Loader2, Smartphone, AlertCircle, FlaskConical } from 'lucide-react';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cleanSymbol } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

const PriceAlertsView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { alerts, loading, createAlert, deleteAlert, toggleAlert, sendAlertNotification, sendingNotification } = usePriceAlerts();
  const { activePortfolio } = usePortfolio();
  const { isSupported, isSubscribed, subscribe, showNotification, permission } = usePushNotifications();
  const [newSymbol, setNewSymbol] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [alertType, setAlertType] = useState<'above' | 'below'>('above');
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);

  // Get symbols from alerts for price checking
  const alertSymbols = alerts.map(a => cleanSymbol(a.symbol));
  const { prices, refreshNow } = useStockPrices(alertSymbols, 30000); // Check every 30 seconds

  // Get unique symbols from holdings
  const holdingSymbols = activePortfolio?.holdings?.map(h => cleanSymbol(h.symbol)) || [];
  const uniqueSymbols = [...new Set(holdingSymbols)];

  const getCurrentPrice = (symbol: string) => {
    return prices.get(cleanSymbol(symbol))?.price;
  };

  const isTriggered = (alert: typeof alerts[0]) => {
    const currentPrice = getCurrentPrice(alert.symbol);
    if (!currentPrice) return false;
    if (alert.alert_type === 'above') return currentPrice >= alert.target_price;
    return currentPrice <= alert.target_price;
  };

  // Auto-check alerts and send push notifications
  const checkAndNotify = useCallback(async () => {
    if (!autoCheckEnabled) return;
    
    for (const alert of alerts) {
      if (!alert.is_active || alert.triggered_at) continue;
      
      const currentPrice = getCurrentPrice(alert.symbol);
      if (!currentPrice) continue;
      
      const triggered = alert.alert_type === 'above' 
        ? currentPrice >= alert.target_price 
        : currentPrice <= alert.target_price;
      
      if (triggered) {
        // Show push notification if enabled
        const direction = alert.alert_type === 'above' ? 'above' : 'below';
        await showNotification(
          `🔔 ${alert.symbol} Price Alert!`,
          {
            body: `${alert.symbol} is now $${currentPrice.toFixed(2)}, ${direction} your target of $${alert.target_price.toFixed(2)}`,
            tag: `price-alert-${alert.id}`,
            requireInteraction: true,
          }
        );
        
        // Also send email notification
        await sendAlertNotification(alert, currentPrice);
      }
    }
  }, [alerts, autoCheckEnabled, getCurrentPrice, showNotification, sendAlertNotification]);

  // Run auto-check when prices update
  useEffect(() => {
    if (prices.size > 0 && autoCheckEnabled) {
      checkAndNotify();
    }
  }, [prices, autoCheckEnabled, checkAndNotify]);

  const handleCreate = async () => {
    if (!newSymbol || !newPrice) return;
    try {
      await createAlert(newSymbol, parseFloat(newPrice), alertType);
      setNewSymbol('');
      setNewPrice('');
      toast.success(`Alert created! You'll be notified when ${newSymbol} goes ${alertType} $${newPrice}`);
    } catch {
      // Error handled in hook
    }
  };

  const handleEnablePush = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Push notifications enabled! You\'ll receive alerts even when the browser is closed.');
    }
  };

  const handleSendNotification = (alert: typeof alerts[0]) => {
    const currentPrice = getCurrentPrice(alert.symbol);
    if (currentPrice) {
      sendAlertNotification(alert, currentPrice);
    }
  };

  const handleTestNotification = async () => {
    await showNotification('🔔 Test Alert', {
      body: 'This is a test notification. Your alerts are working!',
    });
    toast.success('Test notification sent!');
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample price alerts and notification settings.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <h1 className="text-3xl font-bold text-foreground">Price Alerts</h1>
        <p className="text-muted-foreground mt-1">Get real-time notifications when stocks reach target prices</p>
      </div>

      {/* Push Notification Setup */}
      {isSupported && !isSubscribed && (
        <Alert className="border-primary/30 bg-primary/5">
          <Smartphone className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Enable push notifications to receive alerts even when the browser is closed.</span>
            <Button size="sm" onClick={handleEnablePush} className="ml-4">
              Enable Push Notifications
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isSubscribed && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <Bell className="h-4 w-4 text-green-500" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-green-600">Push notifications are enabled! You'll receive alerts in real-time.</span>
            <Button size="sm" variant="outline" onClick={handleTestNotification}>
              Test Notification
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-Check Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${autoCheckEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                <AlertCircle className={`w-5 h-5 ${autoCheckEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <div className="font-medium">Automatic Price Monitoring</div>
                <div className="text-sm text-muted-foreground">
                  Prices checked every 30 seconds. Notifications sent automatically when targets are hit.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={refreshNow}>
                Check Now
              </Button>
              <Switch checked={autoCheckEnabled} onCheckedChange={setAutoCheckEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Alert
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select value={newSymbol} onValueChange={setNewSymbol}>
                <SelectTrigger>
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueSymbols.length === 0 ? (
                    <SelectItem value="__no_holdings" disabled>No holdings in portfolio</SelectItem>
                  ) : (
                    uniqueSymbols.map(symbol => (
                      <SelectItem key={symbol} value={symbol}>
                        {symbol}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="100.00"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alert When</Label>
              <Select value={alertType} onValueChange={(v: 'above' | 'below') => setAlertType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Price Above
                    </span>
                  </SelectItem>
                  <SelectItem value="below">
                    <span className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-500" />
                      Price Below
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleCreate} 
                className="w-full" 
                disabled={!newSymbol || !newPrice || uniqueSymbols.length === 0}
              >
                <Bell className="w-4 h-4 mr-2" />
                Create Alert
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts ({alerts.filter(a => a.is_active).length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No price alerts yet. Create one above!
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => {
                const currentPrice = getCurrentPrice(alert.symbol);
                const triggered = isTriggered(alert);
                const displaySymbol = cleanSymbol(alert.symbol);
                const isSending = sendingNotification === alert.id;
                
                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      triggered ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        alert.alert_type === 'above' 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        {alert.alert_type === 'above' ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : (
                          <TrendingDown className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{displaySymbol}</span>
                          {triggered && (
                            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-600">
                              Triggered!
                            </Badge>
                          )}
                          {alert.triggered_at && (
                            <Badge variant="secondary" className="text-xs">
                              Notified
                            </Badge>
                          )}
                          {!alert.is_active && !alert.triggered_at && (
                            <Badge variant="secondary">Paused</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Alert when price {alert.alert_type === 'above' ? '≥' : '≤'} ${alert.target_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Current Price</div>
                        <div className="font-semibold">
                          {currentPrice ? `$${currentPrice.toFixed(2)}` : '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {triggered && alert.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendNotification(alert)}
                            disabled={isSending}
                            className="text-yellow-600 border-yellow-500/50 hover:bg-yellow-500/10"
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Mail className="w-4 h-4" />
                            )}
                            <span className="ml-2 hidden sm:inline">Notify</span>
                          </Button>
                        )}
                        <Switch
                          checked={alert.is_active}
                          onCheckedChange={(checked) => toggleAlert(alert.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAlert(alert.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PriceAlertsView;
