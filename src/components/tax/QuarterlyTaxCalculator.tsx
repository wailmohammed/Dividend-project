import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calculator, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle,
  Info,
  FileText
} from 'lucide-react';
import { format, isWithinInterval, startOfYear, endOfYear, parseISO } from 'date-fns';

interface Transaction {
  symbol: string;
  shares: number;
  purchaseDate: string;
  saleDate: string;
  costBasis: number;
  salePrice: number;
  gainLoss: number;
  isLongTerm: boolean;
}

interface QuarterlyTaxCalculatorProps {
  transactions: Transaction[];
  taxYear?: number;
}

// IRS Quarterly payment deadlines
const getQuarterlyDeadlines = (year: number) => [
  { quarter: 'Q1', period: 'Jan 1 - Mar 31', deadline: `Apr 15, ${year}`, months: [0, 1, 2] },
  { quarter: 'Q2', period: 'Apr 1 - May 31', deadline: `Jun 15, ${year}`, months: [3, 4] },
  { quarter: 'Q3', period: 'Jun 1 - Aug 31', deadline: `Sep 15, ${year}`, months: [5, 6, 7] },
  { quarter: 'Q4', period: 'Sep 1 - Dec 31', deadline: `Jan 15, ${year + 1}`, months: [8, 9, 10, 11] }
];

// 2024 Tax brackets for capital gains
const LONG_TERM_RATES = [
  { min: 0, max: 47025, rate: 0, label: '0%' },
  { min: 47025, max: 518900, rate: 0.15, label: '15%' },
  { min: 518900, max: Infinity, rate: 0.20, label: '20%' }
];

const SHORT_TERM_BRACKETS = [
  { min: 0, max: 11600, rate: 0.10, label: '10%' },
  { min: 11600, max: 47150, rate: 0.12, label: '12%' },
  { min: 47150, max: 100525, rate: 0.22, label: '22%' },
  { min: 100525, max: 191950, rate: 0.24, label: '24%' },
  { min: 191950, max: 243725, rate: 0.32, label: '32%' },
  { min: 243725, max: 609350, rate: 0.35, label: '35%' },
  { min: 609350, max: Infinity, rate: 0.37, label: '37%' }
];

export const QuarterlyTaxCalculator: React.FC<QuarterlyTaxCalculatorProps> = ({
  transactions,
  taxYear = new Date().getFullYear()
}) => {
  const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('single');
  const [ordinaryIncome, setOrdinaryIncome] = useState<string>('75000');
  const [otherCapitalGains, setOtherCapitalGains] = useState<string>('0');
  const [selectedYear, setSelectedYear] = useState(taxYear);

  const quarterlyDeadlines = getQuarterlyDeadlines(selectedYear);

  // Filter transactions by year and calculate quarterly gains
  const quarterlyData = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));

    const yearTransactions = transactions.filter(t => {
      const saleDate = parseISO(t.saleDate);
      return isWithinInterval(saleDate, { start: yearStart, end: yearEnd });
    });

    return quarterlyDeadlines.map(q => {
      const quarterTxns = yearTransactions.filter(t => {
        const month = parseISO(t.saleDate).getMonth();
        return q.months.includes(month);
      });

      const shortTermGains = quarterTxns
        .filter(t => !t.isLongTerm)
        .reduce((sum, t) => sum + t.gainLoss, 0);

      const longTermGains = quarterTxns
        .filter(t => t.isLongTerm)
        .reduce((sum, t) => sum + t.gainLoss, 0);

      return {
        ...q,
        transactions: quarterTxns,
        shortTermGains,
        longTermGains,
        totalGains: shortTermGains + longTermGains
      };
    });
  }, [transactions, selectedYear, quarterlyDeadlines]);

  // Calculate cumulative tax liability
  const taxCalculations = useMemo(() => {
    const income = parseFloat(ordinaryIncome) || 0;
    const otherGains = parseFloat(otherCapitalGains) || 0;
    
    let cumulativeShortTerm = otherGains;
    let cumulativeLongTerm = 0;

    // Calculate all quarters in one pass, tracking previous results
    const results: Array<{
      quarter: string;
      period: string;
      deadline: string;
      shortTermGains: number;
      longTermGains: number;
      cumulativeShortTerm: number;
      cumulativeLongTerm: number;
      shortTermTax: number;
      longTermTax: number;
      totalTax: number;
      quarterlyPayment: number;
      paymentDue: number;
    }> = [];

    quarterlyData.forEach((q, index) => {
      cumulativeShortTerm += q.shortTermGains;
      cumulativeLongTerm += q.longTermGains;

      // Calculate short-term tax (ordinary income rates)
      let shortTermTax = 0;
      let remainingShortTerm = Math.max(0, cumulativeShortTerm);
      const taxableIncome = income + remainingShortTerm;

      for (const bracket of SHORT_TERM_BRACKETS) {
        if (taxableIncome > bracket.min) {
          const taxableInBracket = Math.min(taxableIncome - bracket.min, bracket.max - bracket.min);
          const shortTermInBracket = Math.min(remainingShortTerm, taxableInBracket);
          shortTermTax += shortTermInBracket * bracket.rate;
          remainingShortTerm -= shortTermInBracket;
        }
        if (remainingShortTerm <= 0) break;
      }

      // Calculate long-term tax (preferential rates)
      let longTermTax = 0;
      const adjustedIncome = income + Math.max(0, cumulativeShortTerm);
      
      for (const bracket of LONG_TERM_RATES) {
        const bracketMin = filingStatus === 'married' ? bracket.min * 2 : bracket.min;
        const bracketMax = filingStatus === 'married' ? bracket.max * 2 : bracket.max;
        
        if (adjustedIncome < bracketMax && cumulativeLongTerm > 0) {
          const taxableAtRate = Math.min(cumulativeLongTerm, bracketMax - Math.max(adjustedIncome, bracketMin));
          if (taxableAtRate > 0) {
            longTermTax += taxableAtRate * bracket.rate;
          }
        }
      }

      const totalTax = shortTermTax + longTermTax;
      const quarterlyPayment = totalTax / (index + 1);

      // Calculate previous payments made from already computed results
      const previousPayments = index > 0 
        ? results.slice(0, index).reduce((sum, prevResult) => {
            return sum + (prevResult.quarterlyPayment || 0);
          }, 0)
        : 0;

      const paymentDue = Math.max(0, totalTax - previousPayments) / (4 - index);

      results.push({
        quarter: q.quarter,
        period: q.period,
        deadline: q.deadline,
        shortTermGains: q.shortTermGains,
        longTermGains: q.longTermGains,
        cumulativeShortTerm,
        cumulativeLongTerm,
        shortTermTax,
        longTermTax,
        totalTax,
        quarterlyPayment,
        paymentDue: index === 0 ? totalTax / 4 : paymentDue
      });
    });

    return results;
  }, [quarterlyData, ordinaryIncome, otherCapitalGains, filingStatus]);

  const totalYearTax = taxCalculations[3]?.totalTax || 0;
  const totalGains = quarterlyData.reduce((sum, q) => sum + q.totalGains, 0);

  const isUnderpaySafe = (payment: number, index: number) => {
    // Safe harbor: Pay at least 90% of current year tax or 100% of prior year
    const cumulativeTax = taxCalculations[index]?.totalTax || 0;
    const requiredPayment = cumulativeTax * 0.9 / (index + 1);
    return payment >= requiredPayment;
  };

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Estimated Quarterly Tax Calculator
          </CardTitle>
          <CardDescription>
            Calculate estimated tax payments based on your capital gains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label>Tax Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Filing Status</Label>
              <Select value={filingStatus} onValueChange={(v: 'single' | 'married') => setFilingStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married Filing Jointly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Ordinary Income (Annual)</Label>
              <Input
                type="number"
                value={ordinaryIncome}
                onChange={(e) => setOrdinaryIncome(e.target.value)}
                placeholder="75000"
              />
            </div>

            <div className="grid gap-2">
              <Label>Other Capital Gains</Label>
              <Input
                type="number"
                value={otherCapitalGains}
                onChange={(e) => setOtherCapitalGains(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Realized Gains</p>
                <p className={`text-2xl font-bold ${totalGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {totalGains >= 0 ? '+' : ''}{totalGains.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Annual Tax</p>
                <p className="text-2xl font-bold">
                  {totalYearTax.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Quarterly Payment</p>
                <p className="text-2xl font-bold">
                  {(totalYearTax / 4).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quarterly Payment Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Short-Term</TableHead>
                <TableHead className="text-right">Long-Term</TableHead>
                <TableHead className="text-right">Cumulative Tax</TableHead>
                <TableHead className="text-right">Payment Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxCalculations.map((q, index) => {
                const isPast = new Date(q.deadline) < new Date();
                const isUpcoming = !isPast && new Date(q.deadline) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                
                return (
                  <TableRow key={q.quarter}>
                    <TableCell>
                      <Badge variant={isPast ? 'secondary' : isUpcoming ? 'default' : 'outline'}>
                        {q.quarter}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.period}</TableCell>
                    <TableCell>
                      <span className={isUpcoming ? 'font-semibold text-amber-500' : ''}>
                        {q.deadline}
                      </span>
                      {isUpcoming && <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-1" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={q.shortTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {q.shortTermGains >= 0 ? '+' : ''}{q.shortTermGains.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={q.longTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {q.longTermGains >= 0 ? '+' : ''}{q.longTermGains.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {q.totalTax.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-primary">
                        {q.paymentDue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax Rate Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Short-Term Rates (Ordinary Income)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SHORT_TERM_BRACKETS.slice(0, 5).map((bracket, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    ${bracket.min.toLocaleString()} - ${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString()}
                  </span>
                  <Badge variant="secondary">{bracket.label}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Long-Term Rates (Preferential)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {LONG_TERM_RATES.map((bracket, i) => {
                const min = filingStatus === 'married' ? bracket.min * 2 : bracket.min;
                const max = filingStatus === 'married' ? bracket.max * 2 : bracket.max;
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${min.toLocaleString()} - ${max === Infinity ? '∞' : max.toLocaleString()}
                    </span>
                    <Badge variant={bracket.rate === 0 ? 'default' : 'secondary'} className={bracket.rate === 0 ? 'bg-emerald-500' : ''}>
                      {bracket.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Safe Harbor Rule:</strong> To avoid underpayment penalties, pay at least 90% of your current year tax liability or 100% of your prior year tax (110% if AGI &gt; $150,000). 
          Consider increasing quarterly payments if your gains are lumpy. Use IRS Form 1040-ES to submit payments.
        </AlertDescription>
      </Alert>
    </div>
  );
};
