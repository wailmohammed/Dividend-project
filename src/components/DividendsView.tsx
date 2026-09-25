import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Calendar, TrendingUp, DollarSign, Clock, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, AlertCircle, Loader2, FlaskConical } from 'lucide-react';
import { format, addMonths, eachMonthOfInterval, startOfMonth, endOfMonth, getDay, getDaysInMonth, isSameDay, parseISO, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useDividends } from '@/hooks/useDividends';
import { useEnrichHoldings } from '@/hooks/useEnrichHoldings';
import { DRIPCalculator } from './DRIPCalculator';
import { DividendTaxCalculator } from './DividendTaxCalculator';
import { DividendCaptureStrategy } from './DividendCaptureStrategy';
import { DividendIncomeAlerts } from './DividendIncomeAlerts';
import { DividendGrowthTracker } from './DividendGrowthTracker';
import { DividendSafetyScore } from './DividendSafetyScore';
import DividendCalendarWithAlerts from './DividendCalendarWithAlerts';
import { Alert, AlertDescription } from './ui/alert';
import { cleanSymbol } from '@/lib/utils';
import { toast } from 'sonner';
import { Progress } from './ui/progress';
import { DividendHoldingsTable } from './DividendHoldingsTable';
import { DividendScenarioPlanner } from './DividendScenarioPlanner';
import { DividendPaymentCalendar } from './DividendPaymentCalendar';
import { DividendIncomeGoalTracker, GoalData } from './DividendIncomeGoalTracker';
import { DividendIncomeProgressChart } from './DividendIncomeProgressChart';
import { YieldOnCostChart } from './YieldOnCostChart';
import { DRIPImpactChart } from './DRIPImpactChart';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { useDividendIncomeSnapshots } from '@/hooks/useDividendIncomeSnapshots';
import { useDripTransactions } from '@/hooks/useDripTransactions';
import { DividendIncomeInsights } from './DividendIncomeInsights';
import { CurrencyIncomeSplit } from './CurrencyIncomeSplit';

export const DividendsView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { portfolios, activePortfolio, activePortfolioId, switchPortfolio, refetchPortfolio } = usePortfolio();
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>(() => activePortfolioId || 'all');
  const [viewDate, setViewDate] = useState(new Date());
  const [activeGoal, setActiveGoal] = useState<GoalData | null>(null);
  const { snapshots, recordSnapshot } = useDividendIncomeSnapshots();
  const { transactions: dripTransactions } = useDripTransactions(selectedPortfolio !== 'all' ? selectedPortfolio : undefined);

  useEffect(() => {
    if (activePortfolioId && selectedPortfolio === 'all') {
      setSelectedPortfolio(activePortfolioId);
    }
  }, [activePortfolioId, selectedPortfolio]);

  const handlePortfolioChange = (value: string) => {
    setSelectedPortfolio(value);
    if (value !== 'all') {
      switchPortfolio(value);
    }
  };

  const { dividends, loading: dividendsLoading } = useDividends(selectedPortfolio !== 'all' ? selectedPortfolio : undefined);
  const { enrichHoldings, loading: enrichLoading } = useEnrichHoldings();
  
  // Batch fetch progress state
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentSymbol: string } | null>(null);
  const [singleFetchLoading, setSingleFetchLoading] = useState<string | null>(null);
  const [autoFetchDone, setAutoFetchDone] = useState(false);

  // Auto-fetch missing dividend data on mount
  useEffect(() => {
    if (autoFetchDone || enrichLoading || batchProgress !== null || isDemoMode) return;
    const holdings = activePortfolio?.holdings || [];
    const missing = holdings.filter(h => !(h.dividendYield) || h.dividendYield === 0);
    if (missing.length === 0) { setAutoFetchDone(true); return; }
    
    const symbols = missing.map(h => cleanSymbol(h.symbol));
    setAutoFetchDone(true);
    
    (async () => {
      const total = symbols.length;
      setBatchProgress({ current: 0, total, currentSymbol: '' });
      try {
        for (let i = 0; i < symbols.length; i++) {
          setBatchProgress({ current: i + 1, total, currentSymbol: symbols[i] });
          if (i > 0) await new Promise(resolve => setTimeout(resolve, 500));
          await enrichHoldings(undefined, [symbols[i]]);
        }
        await refetchPortfolio();
        toast.success(`Auto-fetched dividend data for ${total} holdings`);
      } catch (err) {
        toast.error('Auto-fetch failed');
      } finally {
        setBatchProgress(null);
      }
    })();
  }, [activePortfolio?.holdings, autoFetchDone, enrichLoading, batchProgress, isDemoMode, enrichHoldings, refetchPortfolio]);

  // Reset auto-fetch when portfolio changes
  useEffect(() => {
    setAutoFetchDone(false);
  }, [selectedPortfolio]);

  // Handle enriching holdings with real market data
  const handleEnrichHoldings = async () => {
    // Use clean symbols for API calls
    const symbols = activePortfolio?.holdings?.map(h => cleanSymbol(h.symbol)) || [];
    if (symbols.length === 0) return;
    
    await enrichHoldings(activePortfolio?.id, symbols);
    // Refresh portfolio data to reflect updated values
    await refetchPortfolio();
  };

  // Handle batch fetch with progress
  const handleBatchFetchDividends = async () => {
    const holdings = activePortfolio?.holdings || [];
    if (holdings.length === 0) return;
    
    const symbols = holdings.map(h => cleanSymbol(h.symbol));
    const total = symbols.length;
    
    setBatchProgress({ current: 0, total, currentSymbol: '' });
    
    try {
      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        setBatchProgress({ current: i + 1, total, currentSymbol: symbol });
        
        // Small delay between calls to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await enrichHoldings(undefined, [symbol]);
      }
      
      await refetchPortfolio();
      toast.success(`Fetched dividend data for ${total} holdings`);
    } catch (err) {
      toast.error('Batch fetch failed');
    } finally {
      setBatchProgress(null);
    }
  };

  // Handle fetching only holdings with missing dividend data
  const handleFetchMissingDividends = async () => {
    const holdings = activePortfolio?.holdings || [];
    const missing = holdings.filter(h => !(h.dividendYield) || h.dividendYield === 0);
    if (missing.length === 0) return;
    
    const symbols = missing.map(h => cleanSymbol(h.symbol));
    const total = symbols.length;
    
    setBatchProgress({ current: 0, total, currentSymbol: '' });
    
    try {
      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        setBatchProgress({ current: i + 1, total, currentSymbol: symbol });
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 500));
        await enrichHoldings(undefined, [symbol]);
      }
      await refetchPortfolio();
      toast.success(`Fetched dividend data for ${total} holdings`);
    } catch (err) {
      toast.error('Batch fetch failed');
    } finally {
      setBatchProgress(null);
    }
  };

  // Handle single stock fetch
  const handleFetchSingleDividend = async (symbol: string) => {
    const cleanedSymbol = cleanSymbol(symbol);
    setSingleFetchLoading(cleanedSymbol);
    
    try {
      await enrichHoldings(undefined, [cleanedSymbol]);
      await refetchPortfolio();
      toast.success(`Fetched dividend data for ${cleanedSymbol}`);
    } catch (err) {
      toast.error(`Failed to fetch data for ${cleanedSymbol}`);
    } finally {
      setSingleFetchLoading(null);
    }
  };

  // Export dividend data to CSV
  const handleExportDividends = () => {
    const rows = [
      ['Symbol', 'Annual Income', 'Yield %', 'Current Price', 'Shares'],
      ...dividendData.holdings.map(h => [
        cleanSymbol(h.symbol),
        h.annualIncome.toFixed(2),
        (h.dividendYield || 0).toFixed(2),
        (h.currentPrice || 0).toFixed(2),
        h.shares.toString()
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dividends-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Dividend data exported');
  };

  // Calculate dividend data from actual holdings
  // Show ALL holdings, but only calculate income for those with dividend yield
  const dividendData = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    
    // Show all holdings in the list (not just those with dividends)
    // Attach next ex-date from dividends data
    const allHoldings = holdings.map(h => {
      const symbolDividends = dividends
        .filter(d => d.symbol === h.symbol && new Date(d.ex_date) >= new Date())
        .sort((a, b) => new Date(a.ex_date).getTime() - new Date(b.ex_date).getTime());
      const nextExDate = symbolDividends.length > 0 ? symbolDividends[0].ex_date : undefined;
      return {
        ...h,
        annualIncome: (h.shares || 0) * (h.currentPrice || 0) * ((h.dividendYield || 0) / 100),
        nextExDate,
      };
    });

    // Calculate totals only from holdings with dividend yield
    const dividendHoldings = holdings.filter(h => (h.dividendYield || 0) > 0);

    const totalDividendIncome = dividendHoldings.reduce((sum, h) => {
      const yieldPercent = h.dividendYield || 0;
      const value = (h.shares || 0) * (h.currentPrice || 0);
      return sum + (value * yieldPercent / 100);
    }, 0);

    const totalValue = dividendHoldings.reduce((sum, h) => sum + ((h.shares || 0) * (h.currentPrice || 0)), 0);
    const averageYield = totalValue > 0 ? (totalDividendIncome / totalValue) * 100 : 0;

    return {
      totalAnnualIncome: totalDividendIncome,
      dailyIncome: totalDividendIncome / 365,
      weeklyIncome: totalDividendIncome / 52,
      monthlyIncome: totalDividendIncome / 12,
      quarterlyIncome: totalDividendIncome / 4,
      averageYield,
      // Sort by annual income (highest first), but show all holdings
      holdings: allHoldings.sort((a, b) => b.annualIncome - a.annualIncome),
      dividendPayingCount: dividendHoldings.length,
    };
  }, [activePortfolio, dividends]);

  // Record income snapshot to database when dividend data changes
  useEffect(() => {
    if (dividendData.monthlyIncome > 0) {
      recordSnapshot(dividendData.monthlyIncome, dividendData.totalAnnualIncome, dividendData.averageYield);
    }
  }, [dividendData.monthlyIncome, dividendData.totalAnnualIncome, dividendData.averageYield, recordSnapshot]);

  // Calendar navigation
  const prevMonth = () => setViewDate(addMonths(viewDate, -1));
  const nextMonth = () => setViewDate(addMonths(viewDate, 1));
  const prevYear = () => setViewDate(addMonths(viewDate, -12));
  const nextYear = () => setViewDate(addMonths(viewDate, 12));
  const resetToToday = () => setViewDate(new Date());

  // Build calendar data
  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(viewDate);
    const firstDayOfWeek = getDay(startOfMonth(viewDate));
    
    const days: { day: number | null; dividends: any[]; amount: number }[] = [];
    
    // Add empty slots for days before the month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, dividends: [], amount: 0 });
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      
      // Check for dividends on this day from the dividends table
      const dayDividends = dividends.filter(d => {
        const payDate = d.pay_date ? parseISO(d.pay_date) : null;
        return payDate && isSameDay(payDate, date);
      });
      
      // Also estimate dividends based on holdings (quarterly distribution)
      const estimatedAmount = dividendData.holdings.reduce((sum, h) => {
        // Assume quarterly dividends paid on common dates (15th of Mar, Jun, Sep, Dec)
        const quarterlyMonths = [2, 5, 8, 11]; // March, June, September, December
        if (quarterlyMonths.includes(month) && day === 15) {
          return sum + (h.annualIncome / 4);
        }
        return sum;
      }, 0);
      
      const dbAmount = dayDividends.reduce((sum, d) => sum + Number(d.amount), 0);
      
      days.push({
        day,
        dividends: dayDividends,
        amount: dbAmount > 0 ? dbAmount : (estimatedAmount > 0 ? estimatedAmount : 0)
      });
    }
    
    // Fill remaining to complete the grid
    while (days.length % 7 !== 0) {
      days.push({ day: null, dividends: [], amount: 0 });
    }
    
    return days;
  }, [viewDate, dividends, dividendData.holdings]);

  // Calculate monthly total
  const monthlyTotal = calendarData.reduce((sum, d) => sum + d.amount, 0);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Generate 12-month forecast
  const monthlyForecast = useMemo(() => {
    const now = new Date();
    return eachMonthOfInterval({
      start: now,
      end: addMonths(now, 11),
    }).map(month => ({
      month: format(month, 'MMM yyyy'),
      estimated: dividendData.monthlyIncome,
      isQuarter: [2, 5, 8, 11].includes(month.getMonth())
    }));
  }, [dividendData.monthlyIncome]);

  return (
    <div className="space-y-6 p-6">
      {/* Demo Mode Indicator */}
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample dividend data. Sign in to see your real portfolio dividends.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dividend Income</h1>
          <p className="text-muted-foreground">Track and forecast your passive income</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleBatchFetchDividends}
            disabled={enrichLoading || batchProgress !== null || !activePortfolio?.holdings?.length}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${batchProgress !== null ? 'animate-spin' : ''}`} />
            {batchProgress !== null ? `${batchProgress.current}/${batchProgress.total}` : 'Fetch All Dividends'}
          </Button>
          <Select value={selectedPortfolio} onValueChange={handlePortfolioChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portfolios</SelectItem>
              {portfolios.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportDividends}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Batch Progress Indicator */}
      {batchProgress !== null && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Fetching dividend data... {batchProgress.current} of {batchProgress.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  Currently fetching: {batchProgress.currentSymbol}
                </p>
              </div>
            </div>
            <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* No dividend data alert */}
      {dividendData.holdings.length === 0 && activePortfolio?.holdings?.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No dividend yield data found. Click "Fetch Dividends" to retrieve real dividend yields from market APIs.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              ${dividendData.dailyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              ${dividendData.weeklyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              ${dividendData.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quarterly Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              ${dividendData.quarterlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Annual Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              ${dividendData.totalAnnualIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {dividendData.averageYield.toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <DividendIncomeInsights holdings={activePortfolio?.holdings ?? []} />
      <CurrencyIncomeSplit holdings={activePortfolio?.holdings ?? []} />

      {/* Dividend Tax Calculator */}
      <DividendTaxCalculator
        grossAnnualIncome={dividendData.totalAnnualIncome}
        grossMonthlyIncome={dividendData.monthlyIncome}
        grossQuarterlyIncome={dividendData.quarterlyIncome}
        grossWeeklyIncome={dividendData.weeklyIncome}
        grossDailyIncome={dividendData.dailyIncome}
      />

      {/* Interactive Calendar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                Est. Total: <span className="text-emerald-500 font-bold">${monthlyTotal.toFixed(2)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetToToday}>Today</Button>
              <div className="flex border rounded-lg overflow-hidden">
                <Button variant="ghost" size="icon" onClick={prevYear} className="rounded-none">
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-none border-x">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-none border-r">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={nextYear} className="rounded-none">
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="border rounded-lg overflow-hidden">
            {/* Days header */}
            <div className="grid grid-cols-7 bg-muted/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground border-b">
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {calendarData.map((dayData, idx) => {
                const isToday = dayData.day && 
                  dayData.day === new Date().getDate() && 
                  viewDate.getMonth() === new Date().getMonth() && 
                  viewDate.getFullYear() === new Date().getFullYear();
                
                return (
                  <div 
                    key={idx}
                    className={`min-h-[100px] p-2 border-b border-r transition-colors ${
                      !dayData.day ? 'bg-muted/30' : 
                      dayData.amount > 0 ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 
                      'hover:bg-muted/50'
                    }`}
                  >
                    {dayData.day && (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                          }`}>
                            {dayData.day}
                          </span>
                          {dayData.amount > 0 && (
                            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              ${dayData.amount.toFixed(0)}
                            </span>
                          )}
                        </div>
                        {dayData.dividends.length > 0 && (
                          <div className="space-y-1">
                            {dayData.dividends.slice(0, 2).map((d: any) => (
                              <div key={d.id} className="text-xs bg-muted rounded px-2 py-1 truncate">
                                {d.symbol}
                              </div>
                            ))}
                            {dayData.dividends.length > 2 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{dayData.dividends.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 12-Month Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>12-Month Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {monthlyForecast.map((m, idx) => (
              <div key={idx} className={`border rounded-lg p-4 ${m.isQuarter ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {m.month}
                </div>
                <div className="text-xl font-bold text-foreground">
                  ${(m.isQuarter ? m.estimated * 1.5 : m.estimated).toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {m.isQuarter ? 'Quarter payout' : 'Est. payout'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historical Dividends */}
      {dividends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Dividends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Symbol</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ex-Date</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Pay Date</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {dividends.slice(0, 10).map(d => (
                    <tr key={d.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium text-foreground">{d.symbol}</td>
                      <td className="py-3 px-4 text-right text-emerald-500 font-medium">${Number(d.amount).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{format(parseISO(d.ex_date), 'MMM d, yyyy')}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{d.pay_date ? format(parseISO(d.pay_date), 'MMM d, yyyy') : '-'}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{d.frequency || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income Goal Tracker */}
      <DividendIncomeGoalTracker
        currentAnnualIncome={dividendData.totalAnnualIncome}
        currentMonthlyIncome={dividendData.monthlyIncome}
        onGoalChange={setActiveGoal}
      />

      {/* Income Progress Chart */}
      <DividendIncomeProgressChart
        currentMonthlyIncome={dividendData.monthlyIncome}
        goalTarget={activeGoal?.target ?? null}
        goalType={activeGoal?.type ?? null}
        snapshots={snapshots}
      />

      {/* Yield on Cost Chart */}
      <YieldOnCostChart holdings={activePortfolio?.holdings || []} dividends={dividends} />

      {/* Holdings Table with Sorting and Filtering */}
      <DividendHoldingsTable
        holdings={dividendData.holdings}
        onFetchSingle={handleFetchSingleDividend}
        singleFetchLoading={singleFetchLoading}
        batchProgress={batchProgress}
      />

      {/* Dividend Safety Scores */}
      <DividendSafetyScore />

      {/* Dividend Growth Tracker */}
      <DividendGrowthTracker />

      {/* Dividend Income Alerts */}
      <DividendIncomeAlerts />

      {/* Dividend Capture Strategy */}
      <DividendCaptureStrategy />

      {/* DRIP Impact Visualization */}
      <DRIPImpactChart holdings={activePortfolio?.holdings || []} dripTransactions={dripTransactions} />

      {/* DRIP Calculator */}
      <DRIPCalculator />

      {/* Dividend Scenario Planner */}
      <DividendScenarioPlanner />

      {/* Dividend Payment Calendar */}
      <DividendPaymentCalendar />
    </div>
  );
};
