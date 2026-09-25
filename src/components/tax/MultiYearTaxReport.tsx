import React, { useState, useMemo, useRef } from 'react';
import { useTaxLots } from '@/hooks/useTaxLots';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend, ReferenceLine } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ArrowRight,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  History,
  Scale
} from 'lucide-react';
import { MultiYearTaxReportPDF } from './MultiYearTaxReportPDF';
import { Form8949CSVExport } from './Form8949CSVExport';

interface YearlyData {
  year: number;
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalNet: number;
  transactionCount: number;
}

interface CarryoverLoss {
  year: number;
  shortTermCarryover: number;
  longTermCarryover: number;
  totalCarryover: number;
  usedAgainstIncome: number;
}

const MAX_LOSS_DEDUCTION = 3000;

export const MultiYearTaxReport: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { taxLots, loading } = useTaxLots(activePortfolio?.id);
  const currentYear = new Date().getFullYear();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [startYear, setStartYear] = useState(currentYear - 4);
  const [endYear, setEndYear] = useState(currentYear);

  const years = useMemo(() => {
    const yrs: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y--) {
      yrs.push(y);
    }
    return yrs;
  }, [currentYear]);

  // Calculate yearly data
  const yearlyData = useMemo((): YearlyData[] => {
    const dataByYear: Record<number, YearlyData> = {};

    // Initialize years
    for (let y = startYear; y <= endYear; y++) {
      dataByYear[y] = {
        year: y,
        shortTermGains: 0,
        shortTermLosses: 0,
        longTermGains: 0,
        longTermLosses: 0,
        netShortTerm: 0,
        netLongTerm: 0,
        totalNet: 0,
        transactionCount: 0
      };
    }

    // Process closed tax lots
    taxLots
      .filter(lot => lot.is_closed && lot.sale_date && lot.realized_gain_loss !== null)
      .forEach(lot => {
        const saleYear = new Date(lot.sale_date!).getFullYear();
        if (saleYear < startYear || saleYear > endYear) return;

        const purchaseDate = new Date(lot.purchase_date);
        const saleDate = new Date(lot.sale_date!);
        const holdingDays = (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
        const isLongTerm = holdingDays >= 365;
        const gainLoss = lot.realized_gain_loss!;

        const yearData = dataByYear[saleYear];
        yearData.transactionCount++;

        if (isLongTerm) {
          if (gainLoss >= 0) {
            yearData.longTermGains += gainLoss;
          } else {
            yearData.longTermLosses += Math.abs(gainLoss);
          }
        } else {
          if (gainLoss >= 0) {
            yearData.shortTermGains += gainLoss;
          } else {
            yearData.shortTermLosses += Math.abs(gainLoss);
          }
        }
      });

    // Calculate net values
    Object.values(dataByYear).forEach(data => {
      data.netShortTerm = data.shortTermGains - data.shortTermLosses;
      data.netLongTerm = data.longTermGains - data.longTermLosses;
      data.totalNet = data.netShortTerm + data.netLongTerm;
    });

    return Object.values(dataByYear).sort((a, b) => a.year - b.year);
  }, [taxLots, startYear, endYear]);

  // Calculate carryover losses
  const carryoverData = useMemo((): CarryoverLoss[] => {
    const result: CarryoverLoss[] = [];
    let runningShortTermCarryover = 0;
    let runningLongTermCarryover = 0;

    yearlyData.forEach(yearData => {
      // Apply previous year carryover to current year
      let shortTermForYear = yearData.netShortTerm + runningShortTermCarryover;
      let longTermForYear = yearData.netLongTerm + runningLongTermCarryover;

      // If short-term has loss and long-term has gain, offset
      if (shortTermForYear < 0 && longTermForYear > 0) {
        const offset = Math.min(Math.abs(shortTermForYear), longTermForYear);
        shortTermForYear += offset;
        longTermForYear -= offset;
      }
      // If long-term has loss and short-term has gain, offset
      if (longTermForYear < 0 && shortTermForYear > 0) {
        const offset = Math.min(Math.abs(longTermForYear), shortTermForYear);
        longTermForYear += offset;
        shortTermForYear -= offset;
      }

      // Calculate total net after offsets
      const totalNet = shortTermForYear + longTermForYear;

      // Calculate deduction against ordinary income (up to $3000)
      let usedAgainstIncome = 0;
      if (totalNet < 0) {
        usedAgainstIncome = Math.min(Math.abs(totalNet), MAX_LOSS_DEDUCTION);
      }

      // Calculate remaining carryover
      const remainingLoss = totalNet < 0 ? Math.abs(totalNet) - usedAgainstIncome : 0;

      // Allocate carryover proportionally to short/long term
      if (remainingLoss > 0) {
        if (shortTermForYear < 0 && longTermForYear < 0) {
          const shortRatio = Math.abs(shortTermForYear) / (Math.abs(shortTermForYear) + Math.abs(longTermForYear));
          runningShortTermCarryover = -remainingLoss * shortRatio;
          runningLongTermCarryover = -remainingLoss * (1 - shortRatio);
        } else if (shortTermForYear < 0) {
          runningShortTermCarryover = -remainingLoss;
          runningLongTermCarryover = 0;
        } else {
          runningShortTermCarryover = 0;
          runningLongTermCarryover = -remainingLoss;
        }
      } else {
        runningShortTermCarryover = 0;
        runningLongTermCarryover = 0;
      }

      result.push({
        year: yearData.year,
        shortTermCarryover: runningShortTermCarryover,
        longTermCarryover: runningLongTermCarryover,
        totalCarryover: runningShortTermCarryover + runningLongTermCarryover,
        usedAgainstIncome
      });
    });

    return result;
  }, [yearlyData]);

  // Chart data
  const chartData = useMemo(() => {
    return yearlyData.map(y => ({
      year: y.year.toString(),
      'Short-Term': y.netShortTerm,
      'Long-Term': y.netLongTerm,
      'Total': y.totalNet
    }));
  }, [yearlyData]);

  const chartConfig = {
    'Short-Term': { color: 'hsl(var(--chart-1))' },
    'Long-Term': { color: 'hsl(var(--chart-2))' },
    'Total': { color: 'hsl(var(--chart-3))' }
  };

  // Summary stats
  const summary = useMemo(() => {
    const totalGains = yearlyData.reduce((sum, y) => sum + y.shortTermGains + y.longTermGains, 0);
    const totalLosses = yearlyData.reduce((sum, y) => sum + y.shortTermLosses + y.longTermLosses, 0);
    const netTotal = yearlyData.reduce((sum, y) => sum + y.totalNet, 0);
    const totalTransactions = yearlyData.reduce((sum, y) => sum + y.transactionCount, 0);
    
    const currentCarryover = carryoverData.length > 0 
      ? carryoverData[carryoverData.length - 1].totalCarryover 
      : 0;

    const defaultYear: YearlyData = { 
      year: 0, 
      totalNet: 0, 
      shortTermGains: 0, 
      shortTermLosses: 0, 
      longTermGains: 0, 
      longTermLosses: 0, 
      netShortTerm: 0, 
      netLongTerm: 0, 
      transactionCount: 0 
    };

    const bestYear = yearlyData.length > 0 
      ? yearlyData.reduce((best, y) => y.totalNet > best.totalNet ? y : best, yearlyData[0])
      : null;
    const worstYear = yearlyData.length > 0 
      ? yearlyData.reduce((worst, y) => y.totalNet < worst.totalNet ? y : worst, yearlyData[0])
      : null;

    return { totalGains, totalLosses, netTotal, totalTransactions, currentCarryover, bestYear, worstYear };
  }, [yearlyData, carryoverData]);

  const pdfSummary = useMemo(() => ({
    totalGains: summary.totalGains,
    totalLosses: summary.totalLosses,
    netTotal: summary.netTotal,
    totalTransactions: summary.totalTransactions,
    currentCarryover: summary.currentCarryover,
    bestYear: summary.bestYear,
    worstYear: summary.worstYear
  }), [summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={contentRef}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Multi-Year Tax Report</h3>
            <p className="text-sm text-muted-foreground">
              Year-over-year capital gains analysis with carryover tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MultiYearTaxReportPDF
            yearlyData={yearlyData}
            carryoverData={carryoverData}
            summary={pdfSummary}
            startYear={startYear}
            endYear={endYear}
            contentRef={contentRef}
          />
          <div className="flex items-center gap-2">
            <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Total Gains</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              +${summary.totalGains.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Total Losses</span>
            </div>
            <p className="text-2xl font-bold text-red-500">
              -${summary.totalLosses.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className={`${summary.netTotal >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Net Total</span>
            </div>
            <p className={`text-2xl font-bold ${summary.netTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {summary.netTotal >= 0 ? '+' : ''}${summary.netTotal.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Current Carryover</span>
            </div>
            <p className="text-2xl font-bold text-amber-500">
              ${Math.abs(summary.currentCarryover).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Best/Worst Year */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-emerald-500/30">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Best Year</p>
              <p className="text-xl font-bold">{summary.bestYear?.year || 'N/A'}</p>
              <p className="text-sm text-emerald-500">
                +${summary.bestYear?.totalNet.toLocaleString() || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30">
          <CardContent className="pt-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Worst Year</p>
              <p className="text-xl font-bold">{summary.worstYear?.year || 'N/A'}</p>
              <p className="text-sm text-red-500">
                ${summary.worstYear?.totalNet.toLocaleString() || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year-over-Year Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Year-over-Year Capital Gains
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="year" className="text-xs" />
              <YAxis 
                className="text-xs"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="Short-Term" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Long-Term" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Yearly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Yearly Breakdown</CardTitle>
          <CardDescription>
            Detailed capital gains and losses by tax year
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">ST Gains</TableHead>
                <TableHead className="text-right">ST Losses</TableHead>
                <TableHead className="text-right">LT Gains</TableHead>
                <TableHead className="text-right">LT Losses</TableHead>
                <TableHead className="text-right">Net Total</TableHead>
                <TableHead className="text-right">Trades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyData.map(year => (
                <TableRow key={year.year}>
                  <TableCell className="font-bold">{year.year}</TableCell>
                  <TableCell className="text-right text-emerald-500">
                    +${year.shortTermGains.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    -${year.shortTermLosses.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-emerald-500">
                    +${year.longTermGains.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    -${year.longTermLosses.toLocaleString()}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${year.totalNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {year.totalNet >= 0 ? '+' : ''}${year.totalNet.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {year.transactionCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Carryover Loss Tracking */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Capital Loss Carryover Tracking
          </CardTitle>
          <CardDescription>
            Track unused capital losses that carry forward to future tax years. 
            Up to $3,000 per year can offset ordinary income.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">ST Carryover</TableHead>
                <TableHead className="text-right">LT Carryover</TableHead>
                <TableHead className="text-right">Used vs Income</TableHead>
                <TableHead className="text-right">Remaining Carryover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carryoverData.map(carry => (
                <TableRow key={carry.year}>
                  <TableCell className="font-bold">{carry.year}</TableCell>
                  <TableCell className="text-right">
                    {carry.shortTermCarryover < 0 ? (
                      <span className="text-amber-500">${Math.abs(carry.shortTermCarryover).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">$0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {carry.longTermCarryover < 0 ? (
                      <span className="text-amber-500">${Math.abs(carry.longTermCarryover).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">$0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {carry.usedAgainstIncome > 0 ? (
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                        ${carry.usedAgainstIncome.toLocaleString()}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">$0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {carry.totalCarryover < 0 ? (
                      <span className="text-amber-500">${Math.abs(carry.totalCarryover).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">$0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {summary.currentCarryover < 0 && (
            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    You have ${Math.abs(summary.currentCarryover).toLocaleString()} in unused capital losses
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This loss will carry forward to future tax years. You can use up to $3,000 per year 
                    to offset ordinary income, with the remainder available to offset future capital gains.
                  </p>
                </div>
              </div>
            </div>
        )}
        </CardContent>
      </Card>

      {/* Form 8949 CSV Export */}
      <Form8949CSVExport 
        portfolioId={activePortfolio?.id} 
        taxYear={endYear} 
      />
    </div>
  );
};
