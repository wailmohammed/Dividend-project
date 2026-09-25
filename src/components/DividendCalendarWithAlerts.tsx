import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, DollarSign, ChevronsLeft, ChevronsRight, Clock, Bell, BellOff, BellRing, Send } from 'lucide-react';
import { Holding } from '../types';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export interface CalendarDividend extends Holding {
  amount: string;
  payDay: number;
  payDayStr: string;
  payoutRatio: number;
  paymentMonths: number[];
  exDate?: number; // Day of month for ex-date
}

interface DividendCalendarWithAlertsProps {
  dividends: CalendarDividend[];
}

interface ScheduledAlert {
  id: string;
  symbol: string;
  type: 'ex-date' | 'pay-date';
  date: Date;
  amount: string;
  enabled: boolean;
}

const DividendCalendarWithAlerts: React.FC<DividendCalendarWithAlertsProps> = ({ dividends }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDateInfo, setSelectedDateInfo] = useState<{day: number, payments: CalendarDividend[], isExDate?: boolean} | null>(null);
  const [scheduledAlerts, setScheduledAlerts] = useState<ScheduledAlert[]>([]);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [alertDaysBefore, setAlertDaysBefore] = useState<number>(1);

  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    subscribe, 
    showNotification,
    isLoading 
  } = usePushNotifications();

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Navigation
  const prevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));
  const prevYear = () => setViewDate(new Date(currentYear - 1, currentMonth, 1));
  const nextYear = () => setViewDate(new Date(currentYear + 1, currentMonth, 1));
  const resetToToday = () => setViewDate(new Date());

  // Filter dividends with ex-dates
  const monthlyDividends = dividends.filter(d => d.paymentMonths.includes(currentMonth));
  const totalMonthlyIncome = monthlyDividends.reduce((acc, d) => acc + parseFloat(d.amount), 0);

  // Generate ex-dates (usually 2-4 weeks before pay date)
  const getDividendsWithExDates = (divs: CalendarDividend[]) => {
    return divs.map(d => ({
      ...d,
      exDate: d.exDate || Math.max(1, d.payDay - 14)
    }));
  };

  const dividendsWithExDates = getDividendsWithExDates(monthlyDividends);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(firstDayOfMonth).fill(null);

  days.forEach(day => {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)]);

  // Initialize scheduled alerts from dividends
  useEffect(() => {
    const alerts: ScheduledAlert[] = [];
    dividendsWithExDates.forEach(d => {
      if (d.exDate) {
        alerts.push({
          id: `${d.id}-ex`,
          symbol: d.symbol,
          type: 'ex-date',
          date: new Date(currentYear, currentMonth, d.exDate),
          amount: d.amount,
          enabled: true
        });
      }
      alerts.push({
        id: `${d.id}-pay`,
        symbol: d.symbol,
        type: 'pay-date',
        date: new Date(currentYear, currentMonth, d.payDay),
        amount: d.amount,
        enabled: true
      });
    });
    setScheduledAlerts(alerts);
  }, [dividendsWithExDates.length, currentMonth, currentYear]);

  const handleEnablePushNotifications = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Push notifications enabled for dividend alerts');
    }
  };

  const toggleAlert = (alertId: string) => {
    setScheduledAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, enabled: !alert.enabled } : alert
      )
    );
    toast.success('Alert preference updated');
  };

  const sendTestNotification = async () => {
    await showNotification('Dividend Reminder', {
      body: `AAPL ex-dividend date is tomorrow! You own 100 shares worth $98.00 in dividends.`,
      tag: 'test-dividend',
      requireInteraction: true
    });
    toast.success('Test notification sent!');
  };

  const handleDayClick = (day: number, payments: CalendarDividend[], isExDate: boolean = false) => {
    if (payments.length > 0) {
      setSelectedDateInfo({ day, payments, isExDate });
    }
  };

  const getUpcomingAlerts = () => {
    const today = new Date();
    const upcoming = scheduledAlerts
      .filter(alert => {
        const daysUntil = Math.ceil((alert.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil >= 0 && daysUntil <= 7 && alert.enabled;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcoming;
  };

  const upcomingAlerts = getUpcomingAlerts();

  return (
    <div className="animate-fade-in relative space-y-6">
      {/* Notification Settings Banner */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <BellRing className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Dividend Notifications</h3>
              <p className="text-sm text-muted-foreground">
                {isSubscribed 
                  ? 'You will receive push notifications for ex-dates and payment dates'
                  : 'Enable push notifications to never miss a dividend date'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  <Bell className="w-3 h-3 mr-1" /> Enabled
                </Badge>
                <Button variant="outline" size="sm" onClick={sendTestNotification}>
                  <Send className="w-4 h-4 mr-2" /> Test
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAlertSettings(!showAlertSettings)}>
                  Settings
                </Button>
              </>
            ) : (
              <Button onClick={handleEnablePushNotifications} disabled={isLoading || !isSupported}>
                <Bell className="w-4 h-4 mr-2" /> Enable Notifications
              </Button>
            )}
          </div>
        </div>

        {/* Alert Settings Panel */}
        {showAlertSettings && isSubscribed && (
          <div className="mt-4 pt-4 border-t border-primary/20 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Alert Timing</Label>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map(days => (
                  <Button
                    key={days}
                    variant={alertDaysBefore === days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAlertDaysBefore(days)}
                  >
                    {days === 0 ? 'Same day' : `${days} day${days > 1 ? 's' : ''} before`}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Alert Types</Label>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch id="ex-date-alerts" defaultChecked />
                  <Label htmlFor="ex-date-alerts" className="text-sm">Ex-Date Alerts</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="pay-date-alerts" defaultChecked />
                  <Label htmlFor="pay-date-alerts" className="text-sm">Payment Alerts</Label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Alerts Preview */}
      {upcomingAlerts.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Upcoming Alerts (Next 7 Days)
          </h4>
          <div className="flex flex-wrap gap-2">
            {upcomingAlerts.slice(0, 5).map(alert => {
              const daysUntil = Math.ceil((alert.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              return (
                <Badge 
                  key={alert.id}
                  variant={alert.type === 'ex-date' ? 'secondary' : 'default'}
                  className="flex items-center gap-1.5 py-1.5"
                >
                  <span className="font-bold">{alert.symbol}</span>
                  <span className="opacity-70">
                    {alert.type === 'ex-date' ? 'Ex-Date' : 'Payment'}
                  </span>
                  <span className="text-xs">
                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil}d`}
                  </span>
                </Badge>
              );
            })}
            {upcomingAlerts.length > 5 && (
              <Badge variant="outline">+{upcomingAlerts.length - 5} more</Badge>
            )}
          </div>
        </div>
      )}

      {/* Calendar Header */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="bg-primary/10 p-3 rounded-xl border border-primary/20 hidden sm:block">
            <CalendarIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              {monthNames[currentMonth]} {currentYear}
              {currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear() && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Current</span>
              )}
            </h2>
            <div className="text-sm text-muted-foreground">
              Estimated Income: <span className="text-emerald-500 font-bold">${totalMonthlyIncome.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <button onClick={resetToToday} className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors mr-2">
            Today
          </button>
          <div className="flex items-center bg-card rounded-lg border p-0.5">
            <button onClick={prevYear} className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors border-r">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors border-r">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={nextYear} className="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-lg">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="p-4 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="divide-y">
          {weeks.map((weekArray, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 divide-x">
              {weekArray.map((day, dIdx) => {
                const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();
                const dayPayments = day ? dividendsWithExDates.filter(d => d.payDay === day) : [];
                const exDatePayments = day ? dividendsWithExDates.filter(d => d.exDate === day) : [];
                const dailyTotal = dayPayments.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
                const hasExDate = exDatePayments.length > 0;
                const hasPayDate = dayPayments.length > 0;

                return (
                  <div
                    key={dIdx}
                    className={`min-h-[120px] md:min-h-[140px] p-2 relative group transition-colors ${
                      !day ? 'bg-muted/30 pointer-events-none' :
                      hasPayDate || hasExDate ? 'hover:bg-muted/50 cursor-pointer' : ''
                    }`}
                  >
                    {day && (
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                            isToday ? 'bg-primary text-primary-foreground shadow-lg scale-110' : 'text-muted-foreground'
                          }`}>
                            {day}
                          </span>
                          <div className="flex gap-1">
                            {hasExDate && (
                              <span 
                                className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20 cursor-pointer"
                                onClick={() => handleDayClick(day, exDatePayments, true)}
                              >
                                Ex
                              </span>
                            )}
                            {dailyTotal > 0 && (
                              <span 
                                className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 cursor-pointer"
                                onClick={() => handleDayClick(day, dayPayments)}
                              >
                                ${Math.round(dailyTotal)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {dayPayments.slice(0, 3).map(p => (
                            <div 
                              key={p.id} 
                              className="flex items-center justify-between bg-muted/50 border rounded px-2 py-1.5 hover:border-primary/50 transition-colors"
                              onClick={() => handleDayClick(day, [p])}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                <span className="text-[10px] font-bold text-foreground truncate max-w-[50px]">{p.symbol}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">${Math.round(parseFloat(p.amount))}</span>
                            </div>
                          ))}
                          {dayPayments.length > 3 && (
                            <div className="text-[10px] text-center text-muted-foreground font-medium py-1">
                              +{dayPayments.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 text-xs text-muted-foreground justify-end flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary shadow-sm"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-400/20 border border-amber-400/40"></div>
          <span>Ex-Dividend Date</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
          <span>Payment Date</span>
        </div>
      </div>

      {/* Modal */}
      {selectedDateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md m-4 overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-muted/50">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {selectedDateInfo.isExDate ? (
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">Ex-Dividend</Badge>
                  ) : (
                    <CalendarIcon className="w-5 h-5 text-primary" />
                  )}
                  {monthNames[currentMonth]} {selectedDateInfo.day}, {currentYear}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Total: <span className="text-emerald-500 font-bold">
                    ${selectedDateInfo.payments.reduce((a,b) => a + parseFloat(b.amount), 0).toFixed(2)}
                  </span>
                </p>
              </div>
              <button onClick={() => setSelectedDateInfo(null)} className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {selectedDateInfo.payments.map(payment => {
                const exDateDay = payment.exDate || Math.max(1, payment.payDay - 14);
                const alertForPayment = scheduledAlerts.find(a => a.id === `${payment.id}-${selectedDateInfo.isExDate ? 'ex' : 'pay'}`);
                
                return (
                  <div key={payment.id} className="p-4 hover:bg-muted/50 rounded-xl transition-colors border-b last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center font-bold text-foreground border">
                          {payment.symbol[0]}
                        </div>
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {payment.symbol} 
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{payment.assetType}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{payment.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-500 flex items-center justify-end gap-1 text-lg">
                          <DollarSign className="w-4 h-4" />{payment.amount}
                        </div>
                        {!selectedDateInfo.isExDate && (
                          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" /> Ex-Date: {monthNames[currentMonth].substring(0,3)} {exDateDay}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSubscribed && alertForPayment && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground">
                          {alertForPayment.enabled ? 'Notification enabled' : 'Notification disabled'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAlert(alertForPayment.id)}
                        >
                          {alertForPayment.enabled ? (
                            <Bell className="w-4 h-4 text-primary" />
                          ) : (
                            <BellOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-4 bg-muted/30 border-t text-center">
              <button onClick={() => setSelectedDateInfo(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DividendCalendarWithAlerts;
