import { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { useDividends } from '@/hooks/useDividends';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Bell, BellOff, DollarSign, Calendar, CheckCircle, Clock, Mail, Smartphone, AlertCircle } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, addDays, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from './ui/alert';

interface DividendAlert {
  id: string;
  symbol: string;
  amount: number;
  exDate: string;
  payDate: string | null;
  status: 'upcoming' | 'ex-date-passed' | 'paid';
  daysUntil: number;
}

export const DividendIncomeAlerts = () => {
  const { user } = useAuth();
  const { activePortfolio } = usePortfolio();
  const { dividends } = useDividends();
  const { preferences, updatePreference, loading: prefsLoading } = useNotificationPreferences();
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [sendingAlert, setSendingAlert] = useState<string | null>(null);

  useEffect(() => {
    if (preferences) {
      setEmailAlerts(preferences.email_dividend_alerts);
    }
  }, [preferences]);

  // Generate dividend alerts from holdings and actual dividend records
  const alerts = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const today = new Date();
    const alertList: DividendAlert[] = [];

    // Add alerts from actual dividend records
    dividends.forEach(div => {
      const exDate = parseISO(div.ex_date);
      const payDate = div.pay_date ? parseISO(div.pay_date) : null;
      const daysUntilEx = differenceInDays(exDate, today);
      const daysUntilPay = payDate ? differenceInDays(payDate, today) : null;

      let status: 'upcoming' | 'ex-date-passed' | 'paid' = 'upcoming';
      if (payDate && isBefore(payDate, today)) {
        status = 'paid';
      } else if (isBefore(exDate, today)) {
        status = 'ex-date-passed';
      }

      alertList.push({
        id: div.id,
        symbol: div.symbol,
        amount: Number(div.amount),
        exDate: div.ex_date,
        payDate: div.pay_date,
        status,
        daysUntil: status === 'upcoming' ? daysUntilEx : (daysUntilPay || 0),
      });
    });

    // Generate estimated alerts for holdings with dividend yield (for next quarter)
    holdings.forEach(holding => {
      if (holding.dividendYield && holding.dividendYield > 0) {
        // Check if we already have a dividend record for this symbol
        const hasExisting = alertList.some(a => a.symbol === holding.symbol && a.status !== 'paid');
        
        if (!hasExisting) {
          // Estimate next dividend date based on common payment schedules
          // Try current month first, then upcoming months
          const currentMonth = today.getMonth();
          const currentDay = today.getDate();
          
          // Generate candidate ex-dates: 10th of each upcoming month for the next 3 months
          let estimatedExDate: Date | null = null;
          for (let i = 0; i < 3; i++) {
            const candidateMonth = (currentMonth + i) % 12;
            const candidateYear = today.getFullYear() + (currentMonth + i >= 12 ? 1 : 0);
            const candidate = new Date(candidateYear, candidateMonth, 10);
            if (isAfter(candidate, today)) {
              estimatedExDate = candidate;
              break;
            }
          }
          
          if (!estimatedExDate) {
            estimatedExDate = new Date(today.getFullYear(), currentMonth + 1, 10);
          }
          
          const estimatedPayDate = addDays(estimatedExDate, 14);
          const quarterlyAmount = (holding.shares * holding.currentPrice * (holding.dividendYield / 100)) / 4;

          if (isAfter(estimatedExDate, today)) {
            alertList.push({
              id: `est-${holding.id}`,
              symbol: holding.symbol,
              amount: quarterlyAmount,
              exDate: format(estimatedExDate, 'yyyy-MM-dd'),
              payDate: format(estimatedPayDate, 'yyyy-MM-dd'),
              status: 'upcoming',
              daysUntil: differenceInDays(estimatedExDate, today),
            });
          }
        }
      }
    });

    // Sort by upcoming dates first
    return alertList.sort((a, b) => {
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      if (a.status !== 'paid' && b.status === 'paid') return -1;
      return a.daysUntil - b.daysUntil;
    });
  }, [activePortfolio, dividends]);

  // Upcoming alerts (within 30 days)
  const upcomingAlerts = alerts.filter(a => a.status === 'upcoming' && a.daysUntil <= 30);
  const recentPayments = alerts.filter(a => a.status === 'paid').slice(0, 5);

  // Total expected income this month
  const monthlyExpected = useMemo(() => {
    return upcomingAlerts
      .filter(a => a.daysUntil <= 30)
      .reduce((sum, a) => sum + a.amount, 0);
  }, [upcomingAlerts]);

  const handleToggleEmailAlerts = async (enabled: boolean) => {
    setEmailAlerts(enabled);
    await updatePreference('email_dividend_alerts', enabled);
  };

  const handleSendTestAlert = async (alert: DividendAlert) => {
    if (!user?.id) return;
    
    setSendingAlert(alert.id);
    try {
      const { error } = await supabase.functions.invoke('notifications', {
        body: {
          action: 'send_dividend_alert_email',
          symbol: alert.symbol,
          amount: alert.amount,
          exDate: alert.exDate,
          payDate: alert.payDate,
        },
      });

      if (error) throw error;
      toast.success(`Alert sent for ${alert.symbol} dividend`);
    } catch (err: any) {
      console.error('Failed to send alert:', err);
      toast.error('Failed to send alert notification');
    } finally {
      setSendingAlert(null);
    }
  };

  const getStatusBadge = (status: string, daysUntil: number) => {
    switch (status) {
      case 'paid':
        return <Badge variant="secondary" className="bg-green-500/20 text-green-500">Paid</Badge>;
      case 'ex-date-passed':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">Pending Payment</Badge>;
      default:
        if (daysUntil === 0) return <Badge variant="secondary" className="bg-primary/20 text-primary">Today</Badge>;
        if (daysUntil === 1) return <Badge variant="secondary" className="bg-primary/20 text-primary">Tomorrow</Badge>;
        if (daysUntil <= 7) return <Badge variant="secondary" className="bg-orange-500/20 text-orange-500">This Week</Badge>;
        return <Badge variant="outline">In {daysUntil} days</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Dividend Alerts
          </h2>
          <p className="text-sm text-muted-foreground">Get notified when dividends are paid into your account</p>
        </div>
      </div>

      {/* Alert Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Settings</CardTitle>
          <CardDescription>Configure how you receive dividend alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Email Alerts</p>
                <p className="text-sm text-muted-foreground">Receive email when dividends are paid</p>
              </div>
            </div>
            <Switch 
              checked={emailAlerts} 
              onCheckedChange={handleToggleEmailAlerts}
              disabled={prefsLoading}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">Browser push notifications</p>
              </div>
            </div>
            <Switch 
              checked={alertsEnabled} 
              onCheckedChange={setAlertsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Expected Income Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expected This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${monthlyExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Upcoming Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAlerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Dividend Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activePortfolio?.holdings?.filter(h => (h.dividendYield || 0) > 0).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Dividends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Upcoming Dividends
          </CardTitle>
          <CardDescription>Dividends expected in the next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingAlerts.length > 0 ? (
            <div className="space-y-3">
              {upcomingAlerts.map(alert => (
                <div 
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{alert.symbol}</span>
                        {getStatusBadge(alert.status, alert.daysUntil)}
                        {alert.id.startsWith('est-') && (
                          <Badge variant="outline" className="text-xs">Estimated</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Ex: {format(parseISO(alert.exDate), 'MMM dd')}
                        </span>
                        {alert.payDate && (
                          <span>Pay: {format(parseISO(alert.payDate), 'MMM dd')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="font-bold text-green-500">
                        +${alert.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    {emailAlerts && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleSendTestAlert(alert)}
                        disabled={sendingAlert === alert.id}
                      >
                        <Bell className={`w-4 h-4 ${sendingAlert === alert.id ? 'animate-pulse' : ''}`} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming dividends in the next 30 days</p>
              <p className="text-sm mt-1">Add dividend-paying stocks to your portfolio</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments */}
      {recentPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPayments.map(alert => (
                <div 
                  key={alert.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{alert.symbol}</span>
                    <span className="text-sm text-muted-foreground">
                      {alert.payDate && format(parseISO(alert.payDate), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <span className="font-bold text-green-500">
                    +${alert.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Dividend dates and amounts are estimated based on historical data. Actual payments may vary. 
          Enable email alerts to receive notifications when dividends are credited to your account.
        </AlertDescription>
      </Alert>
    </div>
  );
};
