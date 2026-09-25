import { useState, useMemo } from 'react';
import { format, startOfYear, endOfYear, subYears } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useTaxLots } from '@/hooks/useTaxLots';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { useDividends } from '@/hooks/useDividends';
import { cleanSymbol } from '@/lib/utils';
import { 
  FileText, 
  Download, 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  Printer,
  PieChart
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

const FEDERAL_TAX_BRACKETS_2024: TaxBracket[] = [
  { min: 0, max: 11600, rate: 10 },
  { min: 11600, max: 47150, rate: 12 },
  { min: 47150, max: 100525, rate: 22 },
  { min: 100525, max: 191950, rate: 24 },
  { min: 191950, max: 243725, rate: 32 },
  { min: 243725, max: 609350, rate: 35 },
  { min: 609350, max: Infinity, rate: 37 }
];

const LONG_TERM_RATES: TaxBracket[] = [
  { min: 0, max: 47025, rate: 0 },
  { min: 47025, max: 518900, rate: 15 },
  { min: 518900, max: Infinity, rate: 20 }
];

const COLORS = ['#10b981', '#ef4444', '#6366f1', '#f59e0b', '#8b5cf6'];

export const TaxReportGenerator = () => {
  const { activePortfolio } = usePortfolio();
  const { taxLots, loading } = useTaxLots(activePortfolio?.id);
  const { dividends } = useDividends(activePortfolio?.id);
  const transactions = activePortfolio?.transactions || [];
  
  const symbols = useMemo(() => [...new Set(taxLots.map(l => l.symbol))], [taxLots]);
  const { prices } = useStockPrices(symbols);
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [estimatedIncome, setEstimatedIncome] = useState(75000);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    prices.forEach(p => {
      map[p.symbol] = p.price;
    });
    return map;
  }, [prices]);

  // Filter data by selected year
  const yearData = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));

    const closedLots = taxLots.filter(lot => {
      if (!lot.is_closed || !lot.sale_date) return false;
      const saleDate = new Date(lot.sale_date);
      return saleDate >= yearStart && saleDate <= yearEnd;
    });

    const yearDividends = dividends.filter(d => {
      const payDate = new Date(d.pay_date || d.ex_date);
      return payDate >= yearStart && payDate <= yearEnd;
    });

    return { closedLots, dividends: yearDividends };
  }, [taxLots, dividends, selectedYear]);

  // Calculate tax summary
  const taxSummary = useMemo(() => {
    const { closedLots, dividends: yearDividends } = yearData;

    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;

    closedLots.forEach(lot => {
      const purchaseDate = new Date(lot.purchase_date);
      const saleDate = new Date(lot.sale_date!);
      const holdingDays = Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const isLongTerm = holdingDays >= 365;
      const gainLoss = lot.realized_gain_loss || 0;

      if (isLongTerm) {
        if (gainLoss > 0) longTermGains += gainLoss;
        else longTermLosses += Math.abs(gainLoss);
      } else {
        if (gainLoss > 0) shortTermGains += gainLoss;
        else shortTermLosses += Math.abs(gainLoss);
      }
    });

    const totalDividends = yearDividends.reduce((sum, d) => sum + Number(d.amount), 0);

    // Net gains after offsetting
    const netShortTerm = shortTermGains - shortTermLosses;
    const netLongTerm = longTermGains - longTermLosses;

    // Apply $3,000 capital loss limit if net is negative
    let deductibleLoss = 0;
    let carryoverLoss = 0;
    const totalNetGainLoss = netShortTerm + netLongTerm;
    
    if (totalNetGainLoss < 0) {
      deductibleLoss = Math.min(3000, Math.abs(totalNetGainLoss));
      carryoverLoss = Math.abs(totalNetGainLoss) - deductibleLoss;
    }

    return {
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      netShortTerm,
      netLongTerm,
      totalDividends,
      deductibleLoss,
      carryoverLoss,
      closedLots,
      totalNetGainLoss
    };
  }, [yearData]);

  // Detect potential wash sales
  const washSales = useMemo(() => {
    const { closedLots } = yearData;
    const washSaleList: any[] = [];

    closedLots.forEach(lot => {
      if ((lot.realized_gain_loss || 0) >= 0) return; // Only losses matter

      const saleDate = new Date(lot.sale_date!);
      const windowStart = new Date(saleDate);
      windowStart.setDate(windowStart.getDate() - 30);
      const windowEnd = new Date(saleDate);
      windowEnd.setDate(windowEnd.getDate() + 30);

      // Check if same symbol was bought within wash sale window
      const potentialWash = taxLots.find(other => {
        if (other.id === lot.id) return false;
        if (other.symbol !== lot.symbol) return false;
        const purchaseDate = new Date(other.purchase_date);
        return purchaseDate >= windowStart && purchaseDate <= windowEnd;
      });

      if (potentialWash) {
        washSaleList.push({
          symbol: lot.symbol,
          saleDate: lot.sale_date,
          loss: lot.realized_gain_loss,
          repurchaseDate: potentialWash.purchase_date,
          shares: lot.shares
        });
      }
    });

    return washSaleList;
  }, [yearData, taxLots]);

  // Calculate estimated tax liability
  const estimatedTax = useMemo(() => {
    const { netShortTerm, netLongTerm, totalDividends } = taxSummary;

    // Short-term gains taxed at ordinary income rates
    let shortTermTax = 0;
    if (netShortTerm > 0) {
      const taxableIncome = estimatedIncome + netShortTerm;
      for (const bracket of FEDERAL_TAX_BRACKETS_2024) {
        if (taxableIncome > bracket.min) {
          const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
          shortTermTax += taxableInBracket * (bracket.rate / 100);
        }
      }
      // Subtract base income tax
      let baseTax = 0;
      for (const bracket of FEDERAL_TAX_BRACKETS_2024) {
        if (estimatedIncome > bracket.min) {
          const taxableInBracket = Math.min(estimatedIncome, bracket.max) - bracket.min;
          baseTax += taxableInBracket * (bracket.rate / 100);
        }
      }
      shortTermTax = shortTermTax - baseTax;
    }

    // Long-term gains taxed at preferential rates
    let longTermTax = 0;
    if (netLongTerm > 0) {
      for (const bracket of LONG_TERM_RATES) {
        if (estimatedIncome + netLongTerm > bracket.min) {
          const taxableInBracket = Math.min(estimatedIncome + netLongTerm, bracket.max) - Math.max(estimatedIncome, bracket.min);
          if (taxableInBracket > 0) {
            longTermTax += taxableInBracket * (bracket.rate / 100);
          }
        }
      }
    }

    // Qualified dividends taxed at long-term rates (simplified)
    let dividendTax = totalDividends * 0.15;

    return {
      shortTermTax: Math.max(0, shortTermTax),
      longTermTax,
      dividendTax,
      totalTax: Math.max(0, shortTermTax) + longTermTax + dividendTax
    };
  }, [taxSummary, estimatedIncome]);

  // Gains by symbol
  const gainsBySymbol = useMemo(() => {
    const { closedLots } = yearData;
    const bySymbol: Record<string, number> = {};
    
    closedLots.forEach(lot => {
      if (!bySymbol[lot.symbol]) bySymbol[lot.symbol] = 0;
      bySymbol[lot.symbol] += lot.realized_gain_loss || 0;
    });

    return Object.entries(bySymbol)
      .map(([symbol, pnl]) => ({ symbol, pnl }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [yearData]);

  // Monthly distribution
  const monthlyGains = useMemo(() => {
    const { closedLots } = yearData;
    const byMonth: Record<string, { gains: number; losses: number }> = {};
    
    closedLots.forEach(lot => {
      const month = format(new Date(lot.sale_date!), 'MMM');
      if (!byMonth[month]) byMonth[month] = { gains: 0, losses: 0 };
      const gainLoss = lot.realized_gain_loss || 0;
      if (gainLoss > 0) byMonth[month].gains += gainLoss;
      else byMonth[month].losses += Math.abs(gainLoss);
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(month => ({
      month,
      gains: byMonth[month]?.gains || 0,
      losses: byMonth[month]?.losses || 0,
      net: (byMonth[month]?.gains || 0) - (byMonth[month]?.losses || 0)
    }));
  }, [yearData]);

  const handleExportCSV = () => {
    const { closedLots } = yearData;
    const headers = ['Symbol', 'Shares', 'Purchase Date', 'Sale Date', 'Cost Basis', 'Sale Price', 'Gain/Loss', 'Term'];
    const rows = closedLots.map(lot => {
      const purchaseDate = new Date(lot.purchase_date);
      const saleDate = new Date(lot.sale_date!);
      const holdingDays = Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      return [
        lot.symbol,
        lot.shares,
        format(purchaseDate, 'yyyy-MM-dd'),
        format(saleDate, 'yyyy-MM-dd'),
        lot.cost_basis.toFixed(2),
        lot.sale_price?.toFixed(2) || '',
        lot.realized_gain_loss?.toFixed(2) || '',
        holdingDays >= 365 ? 'Long-Term' : 'Short-Term'
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${selectedYear}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Tax Report Generator
          </h1>
          <p className="text-muted-foreground mt-1">Summarize realized gains/losses and estimate tax liability</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Short-Term Gains</span>
            </div>
            <p className="text-xl font-bold text-emerald-500">
              ${taxSummary.shortTermGains.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Short-Term Losses</span>
            </div>
            <p className="text-xl font-bold text-red-500">
              -${taxSummary.shortTermLosses.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Long-Term Gains</span>
            </div>
            <p className="text-xl font-bold text-blue-500">
              ${taxSummary.longTermGains.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Long-Term Losses</span>
            </div>
            <p className="text-xl font-bold text-amber-500">
              -${taxSummary.longTermLosses.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Dividends Received</span>
            </div>
            <p className="text-xl font-bold text-purple-500">
              ${taxSummary.totalDividends.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className={taxSummary.totalNetGainLoss >= 0 
          ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20" 
          : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20"
        }>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4" />
              <span className="text-xs text-muted-foreground">Net Capital Gain/Loss</span>
            </div>
            <p className={`text-xl font-bold ${taxSummary.totalNetGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {taxSummary.totalNetGainLoss >= 0 ? '+' : ''}${taxSummary.totalNetGainLoss.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Tax Summary</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="wash-sales">Wash Sales</TabsTrigger>
          <TabsTrigger value="estimate">Tax Estimate</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Net Gains Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Gains/Losses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyGains}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" fontSize={10} />
                      <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="gains" name="Gains" fill="#10b981" stackId="a" />
                      <Bar dataKey="losses" name="Losses" fill="#ef4444" stackId="b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Gains by Symbol */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Gains/Losses by Symbol</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {gainsBySymbol.slice(0, 8).map((item, i) => (
                    <div key={item.symbol} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.symbol}</Badge>
                      </div>
                      <span className={`font-bold ${item.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.pnl >= 0 ? '+' : ''}${item.pnl.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {gainsBySymbol.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">No closed positions this year</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tax Term Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Capital Gains by Holding Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold">Short-Term (&lt; 1 year)</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gains:</span>
                      <span className="text-emerald-500">+${taxSummary.shortTermGains.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Losses:</span>
                      <span className="text-red-500">-${taxSummary.shortTermLosses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t border-border">
                      <span>Net:</span>
                      <span className={taxSummary.netShortTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {taxSummary.netShortTerm >= 0 ? '+' : ''}${taxSummary.netShortTerm.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Taxed at ordinary income rates (up to 37%)</p>
                </div>

                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-semibold">Long-Term (≥ 1 year)</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gains:</span>
                      <span className="text-emerald-500">+${taxSummary.longTermGains.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Losses:</span>
                      <span className="text-red-500">-${taxSummary.longTermLosses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t border-border">
                      <span>Net:</span>
                      <span className={taxSummary.netLongTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {taxSummary.netLongTerm >= 0 ? '+' : ''}${taxSummary.netLongTerm.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Taxed at preferential rates (0%, 15%, or 20%)</p>
                </div>
              </div>

              {taxSummary.carryoverLoss > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">Capital Loss Carryover</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    You can deduct up to $3,000 of net capital losses against ordinary income. 
                    The remaining ${taxSummary.carryoverLoss.toLocaleString()} can be carried forward to future tax years.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Gain/Loss</TableHead>
                    <TableHead>Term</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxSummary.closedLots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No closed positions for {selectedYear}
                      </TableCell>
                    </TableRow>
                  ) : (
                    taxSummary.closedLots.map(lot => {
                      const purchaseDate = new Date(lot.purchase_date);
                      const saleDate = new Date(lot.sale_date!);
                      const holdingDays = Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
                      const isLongTerm = holdingDays >= 365;

                      return (
                        <TableRow key={lot.id}>
                          <TableCell className="font-bold">{lot.symbol}</TableCell>
                          <TableCell>{lot.shares}</TableCell>
                          <TableCell>{format(purchaseDate, 'MMM d, yyyy')}</TableCell>
                          <TableCell>{format(saleDate, 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-right">${(lot.cost_basis * lot.shares).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${((lot.sale_price || 0) * lot.shares).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <span className={lot.realized_gain_loss && lot.realized_gain_loss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                              {lot.realized_gain_loss && lot.realized_gain_loss >= 0 ? '+' : ''}${lot.realized_gain_loss?.toFixed(2) || '0.00'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={isLongTerm ? 'default' : 'secondary'}>
                              {isLongTerm ? 'Long' : 'Short'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wash-sales">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Potential Wash Sales
              </CardTitle>
              <CardDescription>
                A wash sale occurs when you sell a security at a loss and repurchase the same or substantially identical security within 30 days before or after the sale.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {washSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                  <p>No potential wash sales detected for {selectedYear}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Loss Amount</TableHead>
                      <TableHead>Repurchase Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {washSales.map((ws, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold">{ws.symbol}</TableCell>
                        <TableCell>{ws.shares}</TableCell>
                        <TableCell>{format(new Date(ws.saleDate), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-red-500">${Math.abs(ws.loss).toFixed(2)}</TableCell>
                        <TableCell>{format(new Date(ws.repurchaseDate), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                            Review Needed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Wash sale losses are not deductible in the year of sale. The disallowed loss is added to the cost basis of the replacement shares.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estimate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Estimated Tax Liability for {selectedYear}
              </CardTitle>
              <CardDescription>
                Based on your investment income and estimated ordinary income
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <label className="text-sm text-muted-foreground">Estimated Ordinary Income:</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={estimatedIncome}
                    onChange={(e) => setEstimatedIncome(parseInt(e.target.value) || 0)}
                    className="pl-8 pr-4 py-2 bg-muted rounded-lg border border-border w-[150px]"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                <Card className="bg-amber-500/10 border-amber-500/20">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Short-Term Gains Tax</p>
                    <p className="text-2xl font-bold text-amber-500">${estimatedTax.shortTermTax.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">At ordinary income rates</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-500/10 border-green-500/20">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Long-Term Gains Tax</p>
                    <p className="text-2xl font-bold text-green-500">${estimatedTax.longTermTax.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">At preferential rates</p>
                  </CardContent>
                </Card>

                <Card className="bg-purple-500/10 border-purple-500/20">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Dividend Tax</p>
                    <p className="text-2xl font-bold text-purple-500">${estimatedTax.dividendTax.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">On qualified dividends</p>
                  </CardContent>
                </Card>

                <Card className="bg-primary/10 border-primary/20">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Estimated Tax</p>
                    <p className="text-2xl font-bold text-primary">${estimatedTax.totalTax.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Federal investment taxes</p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  <strong>Disclaimer:</strong> This is an estimate for informational purposes only. Tax calculations are simplified and may not reflect your actual tax liability. 
                  State taxes, NIIT (3.8% on high earners), AMT, and other factors are not included. Consult a tax professional for accurate tax advice.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
