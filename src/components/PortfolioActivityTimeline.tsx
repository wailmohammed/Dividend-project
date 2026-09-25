import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { useDemoMode } from '@/hooks/useDemoMode';
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, DollarSign, TrendingUp, Bell, ShoppingCart, Banknote, AlertTriangle, Filter, Clock } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL' | 'ALERT' | 'MILESTONE';
  symbol: string;
  title: string;
  description: string;
  value: number;
  date: string;
  icon: React.ElementType;
  color: string;
}

const demoEvents: TimelineEvent[] = [
  { id: '1', type: 'BUY', symbol: 'NVDA', title: 'Bought NVDA', description: '10 shares @ $875.50', value: 8755, date: '2026-04-07T10:30:00', icon: ShoppingCart, color: 'text-green-500 bg-green-500/10' },
  { id: '2', type: 'DIVIDEND', symbol: 'AAPL', title: 'Dividend Received', description: 'Apple quarterly dividend', value: 24.50, date: '2026-04-06T09:00:00', icon: DollarSign, color: 'text-primary bg-primary/10' },
  { id: '3', type: 'SELL', symbol: 'META', title: 'Sold META', description: '5 shares @ $520.00 (+$310 gain)', value: 2600, date: '2026-04-05T14:15:00', icon: ArrowDownRight, color: 'text-orange-500 bg-orange-500/10' },
  { id: '4', type: 'MILESTONE', symbol: 'Portfolio', title: 'Portfolio Milestone', description: 'Portfolio crossed $100,000!', value: 100000, date: '2026-04-04T16:00:00', icon: TrendingUp, color: 'text-yellow-500 bg-yellow-500/10' },
  { id: '5', type: 'DIVIDEND', symbol: 'SCHD', title: 'Dividend Received', description: 'Schwab dividend ETF payout', value: 85.20, date: '2026-04-03T09:00:00', icon: DollarSign, color: 'text-primary bg-primary/10' },
  { id: '6', type: 'BUY', symbol: 'MSFT', title: 'Bought MSFT', description: '8 shares @ $420.25', value: 3362, date: '2026-04-02T11:45:00', icon: ShoppingCart, color: 'text-green-500 bg-green-500/10' },
  { id: '7', type: 'ALERT', symbol: 'TSLA', title: 'Price Alert Triggered', description: 'TSLA dropped below $180 target', value: 178.50, date: '2026-04-01T15:30:00', icon: Bell, color: 'text-red-500 bg-red-500/10' },
  { id: '8', type: 'DEPOSIT', symbol: 'Cash', title: 'Cash Deposited', description: 'Monthly contribution', value: 2000, date: '2026-03-31T08:00:00', icon: Banknote, color: 'text-blue-500 bg-blue-500/10' },
  { id: '9', type: 'BUY', symbol: 'VTI', title: 'Bought VTI', description: '15 shares @ $253.40', value: 3801, date: '2026-03-28T10:00:00', icon: ShoppingCart, color: 'text-green-500 bg-green-500/10' },
  { id: '10', type: 'DIVIDEND', symbol: 'JNJ', title: 'Dividend Received', description: 'Johnson & Johnson quarterly', value: 48.00, date: '2026-03-25T09:00:00', icon: DollarSign, color: 'text-primary bg-primary/10' },
  { id: '11', type: 'SELL', symbol: 'INTC', title: 'Sold INTC', description: '20 shares @ $32.10 (-$180 loss)', value: 642, date: '2026-03-22T13:00:00', icon: ArrowDownRight, color: 'text-orange-500 bg-orange-500/10' },
  { id: '12', type: 'MILESTONE', symbol: 'Portfolio', title: 'Dividend Milestone', description: 'Monthly dividend income exceeded $500!', value: 512, date: '2026-03-20T09:00:00', icon: TrendingUp, color: 'text-yellow-500 bg-yellow-500/10' },
];

const PortfolioActivityTimeline: React.FC = () => {
  const { transactions } = usePortfolioData();
  const { isDemoModeEnabled } = useDemoMode();
  const [filter, setFilter] = useState<string>('all');
  const [showCount, setShowCount] = useState(10);

  const events = useMemo((): TimelineEvent[] => {
    if (isDemoModeEnabled || !transactions?.length) return demoEvents;

    return transactions.slice(0, 50).map(t => {
      const iconMap: Record<string, React.ElementType> = { BUY: ShoppingCart, SELL: ArrowDownRight, DIVIDEND: DollarSign, DEPOSIT: Banknote, WITHDRAWAL: ArrowUpRight };
      const colorMap: Record<string, string> = {
        BUY: 'text-green-500 bg-green-500/10',
        SELL: 'text-orange-500 bg-orange-500/10',
        DIVIDEND: 'text-primary bg-primary/10',
        DEPOSIT: 'text-blue-500 bg-blue-500/10',
        WITHDRAWAL: 'text-red-500 bg-red-500/10',
      };
      return {
        id: t.id,
        type: t.type as TimelineEvent['type'],
        symbol: t.symbol,
        title: `${t.type === 'BUY' ? 'Bought' : t.type === 'SELL' ? 'Sold' : t.type === 'DIVIDEND' ? 'Dividend from' : t.type} ${t.symbol}`,
        description: t.shares ? `${t.shares} shares @ $${t.price.toFixed(2)}` : `$${t.total_value.toFixed(2)}`,
        value: t.total_value,
        date: t.transaction_date,
        icon: iconMap[t.type] || Bell,
        color: colorMap[t.type] || 'text-muted-foreground bg-muted',
      };
    });
  }, [transactions, isDemoModeEnabled]);

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);
  const displayed = filtered.slice(0, showCount);

  const getDateLabel = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (isToday(d)) return 'Today';
      if (isYesterday(d)) return 'Yesterday';
      if (isThisWeek(d)) return format(d, 'EEEE');
      if (isThisMonth(d)) return format(d, 'MMM d');
      return format(d, 'MMM d, yyyy');
    } catch { return dateStr; }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'BUY', label: 'Buys' },
    { id: 'SELL', label: 'Sells' },
    { id: 'DIVIDEND', label: 'Dividends' },
    { id: 'DEPOSIT', label: 'Deposits' },
  ];

  // Group events by date
  const grouped = displayed.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const label = getDateLabel(e.date);
    (acc[label] = acc[label] || []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Portfolio Activity</h2>
        <p className="text-muted-foreground text-sm">A chronological feed of all portfolio events — buys, sells, dividends, deposits, and milestones.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: events.length, icon: Clock },
          { label: 'Buys', value: events.filter(e => e.type === 'BUY').length, icon: ShoppingCart },
          { label: 'Sells', value: events.filter(e => e.type === 'SELL').length, icon: ArrowDownRight },
          { label: 'Dividends', value: events.filter(e => e.type === 'DIVIDEND').length, icon: DollarSign },
        ].map((stat, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map(f => (
          <Button key={f.id} variant={filter === f.id ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f.id)} className="text-xs">
            {f.label}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        {Object.entries(grouped).map(([dateLabel, items]) => (
          <div key={dateLabel} className="mb-6">
            <div className="flex items-center gap-3 mb-3 ml-2">
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center z-10">
                <Clock className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-foreground">{dateLabel}</span>
            </div>
            {items.map(event => (
              <div key={event.id} className="flex items-start gap-4 ml-2 mb-3 group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${event.color}`}>
                  <event.icon className="w-4 h-4" />
                </div>
                <Card className="flex-1 bg-card border-border group-hover:border-primary/20 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{event.title}</span>
                          <Badge variant="outline" className="text-[10px]">{event.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">{formatCurrency(event.value)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {(() => { try { return format(parseISO(event.date), 'h:mm a'); } catch { return ''; } })()}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ))}
      </div>

      {filtered.length > showCount && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setShowCount(c => c + 10)}>Load More Events</Button>
        </div>
      )}

      {filtered.length === 0 && (
        <Card className="bg-card"><CardContent className="p-8 text-center text-muted-foreground">No activity to show. Start by adding transactions to your portfolio.</CardContent></Card>
      )}
    </div>
  );
};

export default PortfolioActivityTimeline;
