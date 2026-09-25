import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays, startOfYear, endOfYear } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, PieChart, Clock, Timer, Table as TableIcon, FileText, AlertTriangle, Scissors, Download, ClipboardList } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from './ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie, Legend } from 'recharts';
import { SellTransactionsTable, SellWithPL } from './tax/SellTransactionsTable';
import { TaxReportPDF } from './tax/TaxReportPDF';
import { TaxLossHarvestingAdvisor } from './tax/TaxLossHarvestingAdvisor';
import { Form8949Generator } from './tax/Form8949Generator';
import { ScheduleDSummary } from './tax/ScheduleDSummary';
import { TaxSoftwareExport } from './tax/TaxSoftwareExport';
import { useWashSaleDetection } from '@/hooks/useWashSaleDetection';

interface MonthlyPL {
  month: string;
  monthLabel: string;
  realized: number;
  wins: number;
  losses: number;
  trades: number;
  shortTerm: number;
  longTerm: number;
}

interface SymbolPL {
  symbol: string;
  realized: number;
  trades: number;
  avgGain: number;
}

// Generate available tax years based on transaction data
const getTaxYears = (transactions: any[]): string[] => {
  const years = new Set<string>();
  const currentYear = new Date().getFullYear();
  
  transactions.forEach(txn => {
    const year = new Date(txn.date).getFullYear();
    years.add(year.toString());
  });
  
  // Always include current and previous year
  years.add(currentYear.toString());
  years.add((currentYear - 1).toString());
  
  return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
};

export const RealizedPLDashboard = () => {
  const { activePortfolio, portfolios, switchPortfolio, activePortfolioId } = usePortfolio();
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | 'ytd' | 'tax' | 'all'>('12m');
  const [taxYear, setTaxYear] = useState<string>(new Date().getFullYear().toString());

  const transactions = activePortfolio?.transactions || [];
  const availableTaxYears = useMemo(() => getTaxYears(transactions), [transactions]);

  // Calculate all P/L data with holding period tracking
  const plData = useMemo(() => {
    // Build cost basis map per symbol with purchase dates (FIFO tracking)
    const lotMap: Record<string, Array<{ shares: number; price: number; date: string }>> = {};
    
    // Sort transactions by date ascending
    const sortedTxns = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const sellsWithPL: SellWithPL[] = [];

    sortedTxns.forEach(txn => {
      const symbol = cleanSymbol(txn.symbol);
      const shares = txn.shares || 0;
      const price = txn.price || 0;
      const type = txn.type;
      const txnDate = txn.date;

      if (!lotMap[symbol]) {
        lotMap[symbol] = [];
      }

      if (type === 'BUY') {
        lotMap[symbol].push({ shares, price, date: txnDate });
      } else if (type === 'SELL') {
        const lots = lotMap[symbol];
        let remainingToSell = shares;
        let totalCostBasis = 0;
        let earliestPurchaseDate = txnDate;
        
        // FIFO: sell from oldest lots first
        while (remainingToSell > 0 && lots.length > 0) {
          const lot = lots[0];
          const soldFromLot = Math.min(remainingToSell, lot.shares);
          totalCostBasis += soldFromLot * lot.price;
          
          if (!earliestPurchaseDate || new Date(lot.date) < new Date(earliestPurchaseDate)) {
            earliestPurchaseDate = lot.date;
          }
          
          lot.shares -= soldFromLot;
          remainingToSell -= soldFromLot;
          
          if (lot.shares <= 0) {
            lots.shift();
          }
        }
        
        const saleProceeds = shares * price;
        const profitLoss = saleProceeds - totalCostBasis;
        const profitLossPercent = totalCostBasis > 0 ? ((saleProceeds - totalCostBasis) / totalCostBasis) * 100 : 0;
        const holdingDays = differenceInDays(new Date(txnDate), new Date(earliestPurchaseDate));
        const isLongTerm = holdingDays > 365;
        
        sellsWithPL.push({
          id: txn.id,
          symbol,
          date: txnDate,
          shares,
          price,
          total: saleProceeds,
          costBasis: totalCostBasis,
          profitLoss,
          profitLossPercent,
          holdingDays,
          isLongTerm,
          purchaseDate: earliestPurchaseDate
        });
      }
    });

    // Filter by time range or tax year
    const now = new Date();
    let filteredSells: SellWithPL[];
    
    if (timeRange === 'tax') {
      const yearStart = startOfYear(new Date(parseInt(taxYear), 0, 1));
      const yearEnd = endOfYear(new Date(parseInt(taxYear), 0, 1));
      filteredSells = sellsWithPL.filter(s => {
        const saleDate = new Date(s.date);
        return saleDate >= yearStart && saleDate <= yearEnd;
      });
    } else if (timeRange === 'ytd') {
      const yearStart = startOfYear(now);
      filteredSells = sellsWithPL.filter(s => new Date(s.date) >= yearStart);
    } else {
      const rangeMonths = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 120;
      const startDate = subMonths(now, rangeMonths);
      filteredSells = sellsWithPL.filter(s => new Date(s.date) >= startDate);
    }

    // Calculate monthly breakdown with capital gains type
    const monthlyMap = new Map<string, MonthlyPL>();
    
    // Initialize months based on range
    const rangeMonths = timeRange === 'tax' ? 12 : timeRange === 'ytd' ? new Date().getMonth() + 1 : timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 24;
    const baseDate = timeRange === 'tax' ? new Date(parseInt(taxYear), 11, 31) : now;
    
    for (let i = rangeMonths - 1; i >= 0; i--) {
      const month = subMonths(baseDate, i);
      const key = format(month, 'yyyy-MM');
      monthlyMap.set(key, {
        month: key,
        monthLabel: format(month, 'MMM yyyy'),
        realized: 0,
        wins: 0,
        losses: 0,
        trades: 0,
        shortTerm: 0,
        longTerm: 0
      });
    }

    // Aggregate by month
    filteredSells.forEach(sell => {
      const monthKey = format(new Date(sell.date), 'yyyy-MM');
      const existing = monthlyMap.get(monthKey);
      if (existing) {
        existing.realized += sell.profitLoss;
        existing.trades += 1;
        if (sell.profitLoss >= 0) {
          existing.wins += 1;
        } else {
          existing.losses += 1;
        }
        if (sell.isLongTerm) {
          existing.longTerm += sell.profitLoss;
        } else {
          existing.shortTerm += sell.profitLoss;
        }
      }
    });

    const monthlyData = Array.from(monthlyMap.values());

    // Calculate by symbol
    const symbolMap = new Map<string, SymbolPL>();
    filteredSells.forEach(sell => {
      const existing = symbolMap.get(sell.symbol);
      if (existing) {
        existing.realized += sell.profitLoss;
        existing.trades += 1;
        existing.avgGain = existing.realized / existing.trades;
      } else {
        symbolMap.set(sell.symbol, {
          symbol: sell.symbol,
          realized: sell.profitLoss,
          trades: 1,
          avgGain: sell.profitLoss
        });
      }
    });

    const bySymbol = Array.from(symbolMap.values())
      .sort((a, b) => Math.abs(b.realized) - Math.abs(a.realized));

    // Capital gains breakdown
    const shortTermGains = filteredSells.filter(s => !s.isLongTerm && s.profitLoss > 0).reduce((sum, s) => sum + s.profitLoss, 0);
    const shortTermLosses = filteredSells.filter(s => !s.isLongTerm && s.profitLoss < 0).reduce((sum, s) => sum + s.profitLoss, 0);
    const longTermGains = filteredSells.filter(s => s.isLongTerm && s.profitLoss > 0).reduce((sum, s) => sum + s.profitLoss, 0);
    const longTermLosses = filteredSells.filter(s => s.isLongTerm && s.profitLoss < 0).reduce((sum, s) => sum + s.profitLoss, 0);
    
    const shortTermNet = shortTermGains + shortTermLosses;
    const longTermNet = longTermGains + longTermLosses;
    const shortTermCount = filteredSells.filter(s => !s.isLongTerm).length;
    const longTermCount = filteredSells.filter(s => s.isLongTerm).length;
    const avgHoldingDays = filteredSells.length > 0 ? filteredSells.reduce((sum, s) => sum + s.holdingDays, 0) / filteredSells.length : 0;

    // Summary stats
    const totalRealized = filteredSells.reduce((sum, s) => sum + s.profitLoss, 0);
    const totalWins = filteredSells.filter(s => s.profitLoss >= 0).length;
    const totalLosses = filteredSells.filter(s => s.profitLoss < 0).length;
    const winRate = filteredSells.length > 0 ? (totalWins / filteredSells.length) * 100 : 0;
    const avgWin = totalWins > 0 ? filteredSells.filter(s => s.profitLoss >= 0).reduce((sum, s) => sum + s.profitLoss, 0) / totalWins : 0;
    const avgLoss = totalLosses > 0 ? filteredSells.filter(s => s.profitLoss < 0).reduce((sum, s) => sum + s.profitLoss, 0) / totalLosses : 0;
    const bestMonth = monthlyData.reduce((best, m) => m.realized > best.realized ? m : best, monthlyData[0] || { realized: 0, monthLabel: 'N/A' });
    const worstMonth = monthlyData.reduce((worst, m) => m.realized < worst.realized ? m : worst, monthlyData[0] || { realized: 0, monthLabel: 'N/A' });

    return {
      sells: filteredSells,
      monthlyData,
      bySymbol,
      capitalGains: {
        shortTermGains,
        shortTermLosses,
        shortTermNet,
        shortTermCount,
        longTermGains,
        longTermLosses,
        longTermNet,
        longTermCount,
        avgHoldingDays
      },
      summary: {
        totalRealized,
        totalWins,
        totalLosses,
        totalTrades: filteredSells.length,
        winRate,
        avgWin,
        avgLoss,
        bestMonth,
        worstMonth
      }
    };
  }, [transactions, timeRange, taxYear]);

  // Detect wash sales
  const { sellsWithWashSales, washSaleCount, totalDisallowed } = useWashSaleDetection(
    plData.sells,
    transactions
  );

  const chartConfig = {
    realized: {
      label: "Realized P/L",
    },
  };

  // Top 5 winners and losers by symbol
  const topWinners = plData.bySymbol.filter(s => s.realized > 0).slice(0, 5);
  const topLosers = plData.bySymbol.filter(s => s.realized < 0).slice(0, 5);

  const [activeTab, setActiveTab] = useState<string>('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Realized P/L Dashboard</h2>
          <p className="text-muted-foreground">Track your closed position gains and losses</p>
          {washSaleCount > 0 && (
            <Badge variant="destructive" className="mt-2 flex items-center gap-1 w-fit">
              <AlertTriangle className="w-3 h-3" />
              {washSaleCount} Wash Sales Detected (${totalDisallowed.toLocaleString(undefined, { maximumFractionDigits: 0 })} disallowed)
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TaxReportPDF
            sells={sellsWithWashSales}
            taxYear={timeRange === 'tax' ? taxYear : new Date().getFullYear().toString()}
            capitalGains={plData.capitalGains}
            portfolioName={activePortfolio?.name || 'Portfolio'}
          />
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="tax">Tax Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          {timeRange === 'tax' && (
            <Select value={taxYear} onValueChange={setTaxYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTaxYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={activePortfolioId} onValueChange={switchPortfolio}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs for Overview / Transactions / Tax Tools */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap w-full max-w-4xl gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <TableIcon className="w-4 h-4" />
            Transactions
            {washSaleCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {washSaleCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="harvesting" className="flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Harvesting
          </TabsTrigger>
          <TabsTrigger value="form8949" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Form 8949
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Schedule D
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <SellTransactionsTable sells={sellsWithWashSales} />
        </TabsContent>

        <TabsContent value="harvesting" className="mt-6">
          <TaxLossHarvestingAdvisor
            realizedGains={{
              shortTerm: plData.capitalGains.shortTermNet,
              longTerm: plData.capitalGains.longTermNet,
              total: plData.summary.totalRealized,
            }}
            sells={sellsWithWashSales}
            transactions={transactions}
          />
        </TabsContent>

        <TabsContent value="form8949" className="mt-6">
          <Form8949Generator
            sells={sellsWithWashSales}
            taxYear={timeRange === 'tax' ? taxYear : new Date().getFullYear().toString()}
            portfolioName={activePortfolio?.name || 'Portfolio'}
          />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          <ScheduleDSummary
            sells={sellsWithWashSales}
            taxYear={timeRange === 'tax' ? taxYear : new Date().getFullYear().toString()}
            portfolioName={activePortfolio?.name || 'Portfolio'}
          />
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <TaxSoftwareExport
            sells={sellsWithWashSales}
            taxYear={timeRange === 'tax' ? taxYear : new Date().getFullYear().toString()}
            portfolioName={activePortfolio?.name || 'Portfolio'}
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-6 space-y-6">

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {plData.summary.totalRealized >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              Total Realized
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plData.summary.totalRealized >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {plData.summary.totalRealized >= 0 ? '+' : ''}${plData.summary.totalRealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plData.summary.totalTrades}</div>
            <p className="text-xs text-muted-foreground">
              {plData.summary.totalWins} wins / {plData.summary.totalLosses} losses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${plData.summary.winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
              {plData.summary.winRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Win</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              +${plData.summary.avgWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              ${plData.summary.avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-emerald-500">
              +${(plData.summary.bestMonth?.realized || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">{plData.summary.bestMonth?.monthLabel || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Capital Gains Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Timer className="w-5 h-5" />
              Short-Term Capital Gains
              <Badge variant="outline" className="ml-auto font-normal text-xs">
                &lt; 1 Year
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gains</p>
                <p className="text-lg font-bold text-emerald-500">
                  +${plData.capitalGains.shortTermGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Losses</p>
                <p className="text-lg font-bold text-red-500">
                  ${plData.capitalGains.shortTermLosses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-amber-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Net Short-Term</span>
                <span className={`text-xl font-bold ${plData.capitalGains.shortTermNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {plData.capitalGains.shortTermNet >= 0 ? '+' : ''}${plData.capitalGains.shortTermNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {plData.capitalGains.shortTermCount} trade{plData.capitalGains.shortTermCount !== 1 ? 's' : ''} • Taxed as ordinary income
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
              Long-Term Capital Gains
              <Badge variant="outline" className="ml-auto font-normal text-xs">
                &gt; 1 Year
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gains</p>
                <p className="text-lg font-bold text-emerald-500">
                  +${plData.capitalGains.longTermGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Losses</p>
                <p className="text-lg font-bold text-red-500">
                  ${plData.capitalGains.longTermLosses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-blue-500/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Net Long-Term</span>
                <span className={`text-xl font-bold ${plData.capitalGains.longTermNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {plData.capitalGains.longTermNet >= 0 ? '+' : ''}${plData.capitalGains.longTermNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {plData.capitalGains.longTermCount} trade{plData.capitalGains.longTermCount !== 1 ? 's' : ''} • Preferential tax rate (0-20%)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Average Holding Period */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Average Holding Period</p>
                <p className="text-sm text-muted-foreground">Based on {plData.summary.totalTrades} closed positions</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                {Math.round(plData.capitalGains.avgHoldingDays)} days
              </p>
              <Badge variant={plData.capitalGains.avgHoldingDays > 365 ? "default" : "secondary"}>
                {plData.capitalGains.avgHoldingDays > 365 ? 'Long-Term Avg' : 'Short-Term Avg'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monthly Realized P/L
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plData.monthlyData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plData.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis 
                    dataKey="monthLabel" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value: number) => [
                          `${value >= 0 ? '+' : ''}$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                          "P/L"
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="realized" radius={[4, 4, 0, 0]}>
                    {plData.monthlyData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.realized >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No sell transactions found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Winners & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-500">
              <TrendingUp className="w-5 h-5" />
              Top Winners
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topWinners.length > 0 ? (
              <div className="space-y-3">
                {topWinners.map((item, idx) => (
                  <div key={item.symbol} className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        #{idx + 1}
                      </Badge>
                      <div>
                        <div className="font-semibold">{item.symbol}</div>
                        <div className="text-xs text-muted-foreground">{item.trades} trade{item.trades > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-500">
                        +${item.realized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg: +${item.avgGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">No winning trades yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <TrendingDown className="w-5 h-5" />
              Top Losers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topLosers.length > 0 ? (
              <div className="space-y-3">
                {topLosers.map((item, idx) => (
                  <div key={item.symbol} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                        #{idx + 1}
                      </Badge>
                      <div>
                        <div className="font-semibold">{item.symbol}</div>
                        <div className="text-xs text-muted-foreground">{item.trades} trade{item.trades > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-500">
                        ${item.realized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg: ${item.avgGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">No losing trades yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Monthly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Month</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Trades</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Win Rate</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                    <span className="text-amber-600 dark:text-amber-400">Short-Term</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                    <span className="text-blue-600 dark:text-blue-400">Long-Term</span>
                  </th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total P/L</th>
                </tr>
              </thead>
              <tbody>
                {plData.monthlyData.filter(m => m.trades > 0).map(month => {
                  const winRate = month.trades > 0 ? (month.wins / month.trades) * 100 : 0;
                  return (
                    <tr key={month.month} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{month.monthLabel}</td>
                      <td className="py-3 px-2 text-right">
                        {month.trades}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({month.wins}W/{month.losses}L)
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={winRate >= 50 ? 'text-emerald-500' : 'text-red-500'}>
                          {winRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className={`py-3 px-2 text-right ${month.shortTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {month.shortTerm !== 0 ? (
                          <>
                            {month.shortTerm >= 0 ? '+' : ''}${month.shortTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </>
                        ) : '-'}
                      </td>
                      <td className={`py-3 px-2 text-right ${month.longTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {month.longTerm !== 0 ? (
                          <>
                            {month.longTerm >= 0 ? '+' : ''}${month.longTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </>
                        ) : '-'}
                      </td>
                      <td className={`py-3 px-2 text-right font-bold ${month.realized >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {month.realized >= 0 ? '+' : ''}${month.realized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {plData.monthlyData.filter(m => m.trades > 0).length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No sell transactions found in the selected period
              </div>
            )}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
