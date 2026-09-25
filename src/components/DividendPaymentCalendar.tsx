import { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDividends } from '@/hooks/useDividends';
import { Calendar, DollarSign, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DividendEvent {
  symbol: string;
  amount: number;
  date: Date;
  type: 'ex_date' | 'pay_date';
  isEstimated: boolean;
}

export const DividendPaymentCalendar = () => {
  const { activePortfolio } = usePortfolio();
  const { dividends } = useDividends(activePortfolio?.id);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Generate dividend events from holdings and dividends table
  const dividendEvents = useMemo(() => {
    const events: DividendEvent[] = [];
    const holdings = activePortfolio?.holdings || [];
    
    // Add events from dividends table
    dividends.forEach(div => {
      if (div.ex_date) {
        events.push({
          symbol: div.symbol,
          amount: Number(div.amount),
          date: new Date(div.ex_date),
          type: 'ex_date',
          isEstimated: div.is_estimated || false
        });
      }
      if (div.pay_date) {
        events.push({
          symbol: div.symbol,
          amount: Number(div.amount),
          date: new Date(div.pay_date),
          type: 'pay_date',
          isEstimated: div.is_estimated || false
        });
      }
    });

    // Generate projected dividends for holdings with dividend yields
    holdings.forEach(holding => {
      const dividendYield = holding.dividendYield || 0;
      if (dividendYield <= 0) return;

      const shares = holding.shares || 0;
      const currentPrice = holding.currentPrice || holding.avgPrice || 0;
      const annualDividend = (dividendYield / 100) * currentPrice;
      const quarterlyDividend = annualDividend / 4;
      const totalQuarterlyAmount = quarterlyDividend * shares;

      // Project quarterly payments for the next 12 months
      for (let i = 0; i < 4; i++) {
        const payDate = addMonths(new Date(), i * 3 + 1);
        
        // Check if we already have a dividend event for this symbol/month
        const existing = events.find(e => 
          e.symbol === holding.symbol && 
          isSameMonth(e.date, payDate)
        );
        
        if (!existing && totalQuarterlyAmount > 0) {
          events.push({
            symbol: holding.symbol,
            amount: totalQuarterlyAmount,
            date: payDate,
            type: 'pay_date',
            isEstimated: true
          });
        }
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [dividends, activePortfolio?.holdings]);

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDay = getDay(monthStart);
    
    // Get all days of the month
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding for start of month
    const paddingDays = Array(startDay).fill(null);
    
    return [...paddingDays, ...days];
  }, [currentMonth]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return dividendEvents.filter(event => isSameDay(event.date, day));
  };

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    
    for (let i = 0; i < 12; i++) {
      const month = addMonths(new Date(), i);
      const monthKey = format(month, 'MMM yyyy');
      
      totals[monthKey] = dividendEvents
        .filter(e => isSameMonth(e.date, month) && e.type === 'pay_date')
        .reduce((sum, e) => sum + e.amount, 0);
    }
    
    return Object.entries(totals).map(([month, amount]) => ({ month, amount }));
  }, [dividendEvents]);

  const totalProjectedAnnual = monthlyTotals.reduce((sum, m) => sum + m.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Dividend Payment Calendar
            </CardTitle>
            <CardDescription>Expected dividend payments based on your holdings</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">12-Month Projection</p>
            <p className="text-2xl font-bold text-emerald-500">${totalProjectedAnnual.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="h-20" />;
            }
            
            const events = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const totalAmount = events.reduce((sum, e) => sum + e.amount, 0);
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "h-20 border rounded-lg p-1 overflow-hidden transition-colors",
                  isToday && "border-primary bg-primary/5",
                  events.length > 0 && "bg-emerald-500/5 border-emerald-500/20"
                )}
              >
                <div className={cn(
                  "text-xs font-medium mb-1",
                  isToday && "text-primary"
                )}>
                  {format(day, 'd')}
                </div>
                {events.length > 0 && (
                  <div className="space-y-0.5">
                    {events.slice(0, 2).map((event, i) => (
                      <div
                        key={`${event.symbol}-${i}`}
                        className={cn(
                          "text-[10px] px-1 py-0.5 rounded truncate",
                          event.type === 'pay_date' 
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                          event.isEstimated && "opacity-70"
                        )}
                      >
                        {event.symbol}: ${event.amount.toFixed(2)}
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{events.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Monthly Summary */}
        <div className="mt-6">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Monthly Breakdown
          </h4>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {monthlyTotals.map(({ month, amount }) => (
              <div
                key={month}
                className={cn(
                  "p-2 rounded-lg text-center",
                  amount > 0 ? "bg-emerald-500/10" : "bg-muted/50"
                )}
              >
                <p className="text-xs text-muted-foreground">{month.split(' ')[0]}</p>
                <p className={cn(
                  "font-semibold",
                  amount > 0 ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  ${amount.toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Payments List */}
        {dividendEvents.filter(e => e.date >= new Date()).length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Upcoming Payments
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {dividendEvents
                .filter(e => e.date >= new Date() && e.type === 'pay_date')
                .slice(0, 10)
                .map((event, index) => (
                  <div
                    key={`${event.symbol}-${index}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {event.symbol}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(event.date, 'MMM d, yyyy')}
                      </span>
                      {event.isEstimated && (
                        <Badge variant="secondary" className="text-xs">Est.</Badge>
                      )}
                    </div>
                    <span className="font-semibold text-emerald-500">
                      ${event.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {dividendEvents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No dividend data available</p>
            <p className="text-sm">Enrich your holdings to see projected payments</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
