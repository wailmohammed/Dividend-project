import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar, TrendingUp, DollarSign, Briefcase, Home, Activity, ChevronLeft, ChevronRight, Globe, Bell } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isToday, isTomorrow, addWeeks } from 'date-fns';

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  category: 'employment' | 'inflation' | 'gdp' | 'housing' | 'fed' | 'earnings' | 'other';
  country: string;
  impact: 'high' | 'medium' | 'low';
  previous?: string;
  forecast?: string;
  actual?: string;
}

// Sample economic events (in production, this would come from an API)
const generateEvents = (startDate: Date): EconomicEvent[] => {
  const events: EconomicEvent[] = [];
  const baseEvents = [
    { title: 'Non-Farm Payrolls', category: 'employment' as const, impact: 'high' as const, time: '8:30 AM', country: 'US' },
    { title: 'Unemployment Rate', category: 'employment' as const, impact: 'high' as const, time: '8:30 AM', country: 'US' },
    { title: 'CPI (Inflation)', category: 'inflation' as const, impact: 'high' as const, time: '8:30 AM', country: 'US' },
    { title: 'Core CPI', category: 'inflation' as const, impact: 'high' as const, time: '8:30 AM', country: 'US' },
    { title: 'PPI (Producer Prices)', category: 'inflation' as const, impact: 'medium' as const, time: '8:30 AM', country: 'US' },
    { title: 'FOMC Meeting Minutes', category: 'fed' as const, impact: 'high' as const, time: '2:00 PM', country: 'US' },
    { title: 'Fed Interest Rate Decision', category: 'fed' as const, impact: 'high' as const, time: '2:00 PM', country: 'US' },
    { title: 'GDP Growth Rate', category: 'gdp' as const, impact: 'high' as const, time: '8:30 AM', country: 'US' },
    { title: 'Retail Sales', category: 'gdp' as const, impact: 'medium' as const, time: '8:30 AM', country: 'US' },
    { title: 'Housing Starts', category: 'housing' as const, impact: 'medium' as const, time: '8:30 AM', country: 'US' },
    { title: 'Existing Home Sales', category: 'housing' as const, impact: 'medium' as const, time: '10:00 AM', country: 'US' },
    { title: 'Consumer Confidence', category: 'other' as const, impact: 'medium' as const, time: '10:00 AM', country: 'US' },
    { title: 'ISM Manufacturing PMI', category: 'other' as const, impact: 'medium' as const, time: '10:00 AM', country: 'US' },
    { title: 'Jobless Claims', category: 'employment' as const, impact: 'medium' as const, time: '8:30 AM', country: 'US' },
    { title: 'ECB Interest Rate', category: 'fed' as const, impact: 'high' as const, time: '8:15 AM', country: 'EU' },
    { title: 'UK Inflation Rate', category: 'inflation' as const, impact: 'medium' as const, time: '7:00 AM', country: 'UK' },
  ];

  // Distribute events across the next 4 weeks
  for (let week = 0; week < 4; week++) {
    baseEvents.forEach((event, idx) => {
      const dayOffset = (idx % 5) + (week * 7); // Spread across weekdays
      const eventDate = addDays(startDate, dayOffset);
      
      // Skip weekends
      if (eventDate.getDay() === 0 || eventDate.getDay() === 6) return;

      events.push({
        id: `${week}-${idx}`,
        date: format(eventDate, 'yyyy-MM-dd'),
        ...event,
        previous: `${(Math.random() * 5 - 1).toFixed(1)}%`,
        forecast: `${(Math.random() * 5 - 0.5).toFixed(1)}%`,
      });
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'employment': return <Briefcase className="w-4 h-4" />;
    case 'inflation': return <TrendingUp className="w-4 h-4" />;
    case 'gdp': return <DollarSign className="w-4 h-4" />;
    case 'housing': return <Home className="w-4 h-4" />;
    case 'fed': return <Activity className="w-4 h-4" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'employment': return 'bg-blue-500';
    case 'inflation': return 'bg-red-500';
    case 'gdp': return 'bg-green-500';
    case 'housing': return 'bg-yellow-500';
    case 'fed': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
};

const getImpactBadge = (impact: string) => {
  switch (impact) {
    case 'high': return <Badge variant="destructive">High Impact</Badge>;
    case 'medium': return <Badge variant="secondary">Medium</Badge>;
    default: return <Badge variant="outline">Low</Badge>;
  }
};

export const EconomicEventsCalendar = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterImpact, setFilterImpact] = useState<string>('all');

  const currentWeekStart = useMemo(() => {
    return startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return eachDayOfInterval({
      start: currentWeekStart,
      end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
    }).filter(day => day.getDay() !== 0 && day.getDay() !== 6); // Exclude weekends
  }, [currentWeekStart]);

  const events = useMemo(() => generateEvents(new Date()), []);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filterCategory !== 'all' && event.category !== filterCategory) return false;
      if (filterImpact !== 'all' && event.impact !== filterImpact) return false;
      return true;
    });
  }, [events, filterCategory, filterImpact]);

  const getEventsForDay = (date: Date) => {
    return filteredEvents.filter(event => isSameDay(parseISO(event.date), date));
  };

  const upcomingHighImpact = filteredEvents
    .filter(e => e.impact === 'high' && new Date(e.date) >= new Date())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Economic Events Calendar
          </h2>
          <p className="text-sm text-muted-foreground">Track market-moving economic releases and Fed announcements</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="employment">Employment</SelectItem>
              <SelectItem value="inflation">Inflation</SelectItem>
              <SelectItem value="gdp">GDP/Growth</SelectItem>
              <SelectItem value="housing">Housing</SelectItem>
              <SelectItem value="fed">Fed/Central Bank</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterImpact} onValueChange={setFilterImpact}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upcoming High-Impact Events */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Upcoming High-Impact Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {upcomingHighImpact.map(event => (
              <div key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-background border">
                <div className={`w-2 h-2 rounded-full ${getCategoryColor(event.category)}`} />
                <div>
                  <span className="font-medium text-sm">{event.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {format(parseISO(event.date), 'MMM dd')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <div className="text-center">
          <h3 className="font-semibold">
            {format(currentWeekStart, 'MMMM d')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMMM d, yyyy')}
          </h3>
          {weekOffset === 0 && <Badge variant="secondary" className="mt-1">This Week</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekOffset(w => w + 1)}>
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Week Calendar View */}
      <div className="grid grid-cols-5 gap-4">
        {weekDays.map(day => {
          const dayEvents = getEventsForDay(day);
          const isCurrentDay = isToday(day);
          
          return (
            <Card key={day.toISOString()} className={`${isCurrentDay ? 'border-primary ring-2 ring-primary/20' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${isCurrentDay ? 'text-primary' : ''}`}>
                  {format(day, 'EEE')}
                  <span className={`block text-2xl ${isCurrentDay ? 'font-bold' : 'font-normal'}`}>
                    {format(day, 'd')}
                  </span>
                  {isCurrentDay && <Badge className="mt-1">Today</Badge>}
                  {isTomorrow(day) && <Badge variant="outline" className="mt-1">Tomorrow</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayEvents.length > 0 ? (
                  dayEvents.slice(0, 4).map(event => (
                    <div 
                      key={event.id}
                      className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-1.5 h-full min-h-[40px] rounded-full ${getCategoryColor(event.category)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{event.title}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-muted-foreground">{event.time}</span>
                            {event.impact === 'high' && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">!</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No events</p>
                )}
                {dayEvents.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{dayEvents.length - 4} more
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Event List View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            All Events This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weekDays.flatMap(day => {
              const dayEvents = getEventsForDay(day);
              if (dayEvents.length === 0) return [];
              
              return dayEvents.map(event => (
                <div 
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getCategoryColor(event.category)} text-white`}>
                      {getCategoryIcon(event.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.title}</span>
                        {getImpactBadge(event.impact)}
                        <Badge variant="outline">{event.country}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(event.date), 'EEEE, MMM d')} at {event.time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {event.previous && (
                      <div>
                        <span className="text-muted-foreground">Prev: </span>
                        <span className="font-medium">{event.previous}</span>
                      </div>
                    )}
                    {event.forecast && (
                      <div>
                        <span className="text-muted-foreground">Fcst: </span>
                        <span className="font-medium text-primary">{event.forecast}</span>
                      </div>
                    )}
                  </div>
                </div>
              ));
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
