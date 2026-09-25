import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { usePortfolio } from '@/context/PortfolioContext';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Clock, ChevronLeft, ChevronRight, Target, BarChart3 } from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, isSameDay, isAfter, isBefore, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface EarningsEvent {
  symbol: string;
  name: string;
  date: Date;
  time: 'BMO' | 'AMC' | 'TBD';
  estimatedEPS: number;
  actualEPS?: number;
  estimatedRevenue: number;
  actualRevenue?: number;
  previousEPS: number;
  previousRevenue: number;
  surprise?: number;
}

const EARNINGS_PATTERNS: Record<string, { dayOffset: number; time: 'BMO' | 'AMC' }> = {
  'AAPL': { dayOffset: 15, time: 'AMC' },
  'MSFT': { dayOffset: 20, time: 'AMC' },
  'GOOGL': { dayOffset: 22, time: 'AMC' },
  'AMZN': { dayOffset: 25, time: 'AMC' },
  'NVDA': { dayOffset: 18, time: 'AMC' },
  'META': { dayOffset: 24, time: 'AMC' },
  'TSLA': { dayOffset: 19, time: 'AMC' },
  'JPM': { dayOffset: 12, time: 'BMO' },
  'JNJ': { dayOffset: 16, time: 'BMO' },
  'KO': { dayOffset: 14, time: 'BMO' },
  'PG': { dayOffset: 17, time: 'BMO' },
  'VZ': { dayOffset: 21, time: 'BMO' },
  'HD': { dayOffset: 13, time: 'BMO' },
  'ABBV': { dayOffset: 26, time: 'BMO' },
  'PEP': { dayOffset: 10, time: 'BMO' },
  'MRK': { dayOffset: 28, time: 'BMO' },
  'AVGO': { dayOffset: 30, time: 'AMC' },
  'CVX': { dayOffset: 27, time: 'BMO' },
  'XOM': { dayOffset: 29, time: 'BMO' },
};

const generateEarningsData = (holdings: any[]): EarningsEvent[] => {
  const today = new Date();
  return holdings.map(holding => {
    const symbol = holding.symbol?.replace('.US', '').toUpperCase();
    const pattern = EARNINGS_PATTERNS[symbol] || {
      dayOffset: Math.floor(Math.random() * 30) + 5,
      time: Math.random() > 0.5 ? 'BMO' : 'AMC' as 'BMO' | 'AMC'
    };
    const basePrice = holding.currentPrice || 100;
    const estimatedEPS = Number((basePrice * (0.02 + Math.random() * 0.03)).toFixed(2));
    const previousEPS = Number((estimatedEPS * (0.85 + Math.random() * 0.3)).toFixed(2));
    const estimatedRevenue = Math.floor(basePrice * (50 + Math.random() * 100));
    const previousRevenue = Math.floor(estimatedRevenue * (0.9 + Math.random() * 0.2));

    return {
      symbol,
      name: holding.name || symbol,
      date: addDays(today, pattern.dayOffset),
      time: pattern.time,
      estimatedEPS,
      previousEPS,
      estimatedRevenue,
      previousRevenue,
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
};

const formatRevenue = (revenue: number) => {
  if (revenue >= 1000) return `$${(revenue / 1000).toFixed(1)}B`;
  return `$${revenue}M`;
};

const EarningsEventCard = ({ event }: { event: EarningsEvent }) => {
  const epsGrowth = ((event.estimatedEPS - event.previousEPS) / event.previousEPS) * 100;
  const revenueGrowth = ((event.estimatedRevenue - event.previousRevenue) / event.previousRevenue) * 100;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-lg">{event.symbol}</span>
              <Badge variant={event.time === 'BMO' ? 'secondary' : 'outline'} className="text-xs">
                {event.time === 'BMO' ? 'Before Open' : event.time === 'AMC' ? 'After Close' : 'TBD'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{event.name}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Target className="w-3 h-3" />
                  <span>Est. EPS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">${event.estimatedEPS}</span>
                  <span className={`text-xs flex items-center ${epsGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {epsGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(epsGrowth).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">vs ${event.previousEPS} prev</p>
              </div>

              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <BarChart3 className="w-3 h-3" />
                  <span>Est. Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatRevenue(event.estimatedRevenue)}</span>
                  <span className={`text-xs flex items-center ${revenueGrowth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {revenueGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(revenueGrowth).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">vs {formatRevenue(event.previousRevenue)} prev</p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-1 text-primary mb-1">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">{format(event.date, 'MMM d')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{format(event.date, 'EEEE')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const EarningsCalendar = () => {
  const { activePortfolio } = usePortfolio();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  const holdings = activePortfolio?.holdings || [];
  const earningsEvents = useMemo(() => generateEarningsData(holdings), [holdings]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => earningsEvents.filter(e => isSameDay(e.date, day));

  const upcomingEvents = earningsEvents.filter(e => isAfter(e.date, new Date()) || isSameDay(e.date, new Date()));
  const thisWeekEvents = upcomingEvents.filter(e => isBefore(e.date, addDays(new Date(), 7)));
  const nextWeekEvents = upcomingEvents.filter(e =>
    isAfter(e.date, addDays(new Date(), 6)) && isBefore(e.date, addDays(new Date(), 14))
  );

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Holdings Found</h3>
          <p className="text-muted-foreground">Add holdings to see their upcoming earnings dates</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            Earnings Calendar
          </h2>
          <p className="text-muted-foreground">Track upcoming earnings for your holdings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold text-primary">{thisWeekEvents.length}</p>
              </div>
              <Clock className="w-8 h-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Week</p>
                <p className="text-2xl font-bold">{nextWeekEvents.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Upcoming</p>
                <p className="text-2xl font-bold">{upcomingEvents.length}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {thisWeekEvents.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                This Week
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {thisWeekEvents.map(e => <EarningsEventCard key={`${e.symbol}-${e.date.toISOString()}`} event={e} />)}
              </div>
            </div>
          )}

          {nextWeekEvents.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Next Week
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {nextWeekEvents.map(e => <EarningsEventCard key={`${e.symbol}-${e.date.toISOString()}`} event={e} />)}
              </div>
            </div>
          )}

          {upcomingEvents.length > nextWeekEvents.length + thisWeekEvents.length && (
            <div>
              <h3 className="font-semibold mb-3">Later</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {upcomingEvents.slice(thisWeekEvents.length + nextWeekEvents.length).map(e => (
                  <EarningsEventCard key={`${e.symbol}-${e.date.toISOString()}`} event={e} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>{format(currentDate, 'MMMM yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2" />
                ))}
                {daysInMonth.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 min-h-[80px] rounded-lg border ${
                        isToday ? 'border-primary bg-primary/5' : 'border-border'
                      } ${dayEvents.length > 0 ? 'bg-muted/30' : ''}`}
                    >
                      <div className={`text-sm mb-1 ${isToday ? 'font-bold text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      {dayEvents.slice(0, 2).map(event => (
                        <div
                          key={event.symbol}
                          className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 mb-0.5 truncate"
                          title={`${event.symbol} - ${event.time}`}
                        >
                          {event.symbol}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EarningsCalendar;
