import React, { useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { useDividends } from '../hooks/useDividends';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Percent, Calendar } from 'lucide-react';

const DividendCAGRTracker: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { dividends } = useDividends(activePortfolio.id);
  const holdings = activePortfolio.holdings || [];

  const analysis = useMemo(() => {
    // Calculate YoC for each holding
    const holdingYoC = holdings.filter(h => h.dividendYield > 0).map(h => {
      const costBasis = h.avgPrice * h.shares;
      const annualDividend = h.currentPrice * (h.dividendYield / 100) * h.shares;
      const yocPercent = costBasis > 0 ? (annualDividend / costBasis) * 100 : 0;
      const currentYield = h.dividendYield;
      return {
        symbol: h.symbol,
        name: h.name,
        yocPercent: Math.round(yocPercent * 100) / 100,
        currentYield: Math.round(currentYield * 100) / 100,
        annualDividend: Math.round(annualDividend * 100) / 100,
        costBasis: Math.round(costBasis),
        shares: h.shares,
        avgPrice: h.avgPrice,
        currentPrice: h.currentPrice,
      };
    }).sort((a, b) => b.yocPercent - a.yocPercent);

    // Aggregate dividend income by year
    const yearlyIncome: Record<string, number> = {};
    dividends.forEach(d => {
      const year = new Date(d.ex_date).getFullYear().toString();
      yearlyIncome[year] = (yearlyIncome[year] || 0) + Number(d.amount);
    });

    const years = Object.keys(yearlyIncome).sort();
    const yearlyData = years.map(y => ({
      year: y,
      income: Math.round(yearlyIncome[y] * 100) / 100,
    }));

    // CAGR calculation
    let cagr = 0;
    if (yearlyData.length >= 2) {
      const first = yearlyData[0].income;
      const last = yearlyData[yearlyData.length - 1].income;
      const n = yearlyData.length - 1;
      if (first > 0 && last > 0) {
        cagr = (Math.pow(last / first, 1 / n) - 1) * 100;
      }
    }

    // Monthly income for current year
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = new Date().getMonth(); // 0-indexed
    const monthlyIncome: Record<string, number> = {};
    dividends.filter(d => d.ex_date.startsWith(currentYear)).forEach(d => {
      const month = new Date(d.ex_date).toLocaleString('default', { month: 'short' });
      monthlyIncome[month] = (monthlyIncome[month] || 0) + Number(d.amount);
    });

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hasAnyDividendData = Object.values(monthlyIncome).some(v => v > 0);

    // If no real dividend records, project from holdings' dividend data
    const projectedMonthly: Record<string, number> = {};
    if (!hasAnyDividendData && holdingYoC.length > 0) {
      holdingYoC.forEach(h => {
        // Estimate quarterly payments (most common)
        const quarterlyAmount = h.annualDividend / 4;
        const payMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec as typical quarters
        payMonths.forEach(mi => {
          const mKey = months[mi];
          projectedMonthly[mKey] = (projectedMonthly[mKey] || 0) + quarterlyAmount;
        });
      });
    }

    const monthlyData = months.map((m, idx) => {
      const actual = monthlyIncome[m] || 0;
      const projected = projectedMonthly[m] || 0;
      const income = actual > 0 ? actual : projected;
      const isPast = idx <= currentMonth;
      const status = actual > 0 ? 'Paid' : projected > 0 ? (isPast ? 'Estimated' : 'Forecasted') : (isPast ? 'No Payment' : 'Forecasted');
      return {
        month: m,
        income: Math.round(income * 100) / 100,
        status,
      };
    });

    // Totals
    const totalAnnualIncome = holdingYoC.reduce((s, h) => s + h.annualDividend, 0);
    const totalCostBasis = holdingYoC.reduce((s, h) => s + h.costBasis, 0);
    const portfolioYoC = totalCostBasis > 0 ? (totalAnnualIncome / totalCostBasis) * 100 : 0;
    const portfolioYield = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
    const weightedYield = portfolioYield > 0 ? (totalAnnualIncome / portfolioYield) * 100 : 0;

    return { holdingYoC, yearlyData, monthlyData, cagr, totalAnnualIncome, portfolioYoC, weightedYield };
  }, [holdings, dividends]);

  if (holdings.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Add holdings to see dividend CAGR & YoC analysis</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Annual Income</span>
            </div>
            <div className="text-2xl font-bold text-foreground">${analysis.totalAnnualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className="text-xs text-muted-foreground">${(analysis.totalAnnualIncome / 12).toFixed(0)}/month</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Yield on Cost (YoC)</span>
            </div>
            <div className="text-2xl font-bold text-emerald-500">{analysis.portfolioYoC.toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground">vs {analysis.weightedYield.toFixed(2)}% current yield</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Dividend CAGR</span>
            </div>
            <div className={`text-2xl font-bold ${analysis.cagr >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {analysis.cagr > 0 ? '+' : ''}{analysis.cagr.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">{analysis.yearlyData.length} year{analysis.yearlyData.length !== 1 ? 's' : ''} tracked</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Dividend Payers</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{analysis.holdingYoC.length}</div>
            <div className="text-xs text-muted-foreground">of {holdings.length} holdings</div>
          </CardContent>
        </Card>
      </div>

      {/* Yearly Income Chart */}
      {analysis.yearlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Yearly Dividend Income & Growth</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analysis.yearlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Income']} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Monthly Income ({new Date().getFullYear()})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {analysis.monthlyData.map(m => (
              <div key={m.month} className={`p-2 rounded-lg text-center border ${
                m.status === 'Paid' ? 'bg-emerald-500/10 border-emerald-500/20' :
                m.status === 'Estimated' ? 'bg-amber-500/10 border-amber-500/20' :
                m.status === 'Forecasted' ? 'bg-primary/5 border-primary/20' :
                'bg-muted/30 border-border'
              }`}>
                <div className="text-[10px] font-medium text-muted-foreground">{m.month}</div>
                <div className="text-xs font-bold text-foreground">${m.income.toFixed(0)}</div>
                <Badge variant="outline" className={`text-[8px] mt-1 ${
                  m.status === 'Paid' ? 'text-emerald-500 border-emerald-500/30' :
                  m.status === 'Estimated' ? 'text-amber-500 border-amber-500/30' :
                  m.status === 'Forecasted' ? 'text-primary border-primary/30' : 'text-muted-foreground'
                }`}>
                  {m.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-Holding YoC Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Yield on Cost by Holding</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {analysis.holdingYoC.map(h => (
              <div key={h.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:border-primary/20 transition-colors">
                <div>
                  <span className="font-bold text-sm text-foreground">{h.symbol}</span>
                  <div className="text-[10px] text-muted-foreground">{h.name}</div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <div className="text-xs text-muted-foreground">Current Yield</div>
                    <div className="text-sm font-medium text-foreground">{h.currentYield.toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">YoC</div>
                    <div className={`text-sm font-bold ${h.yocPercent > h.currentYield ? 'text-emerald-500' : 'text-foreground'}`}>
                      {h.yocPercent.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Annual $</div>
                    <div className="text-sm font-medium text-foreground">${h.annualDividend.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DividendCAGRTracker;
