import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { useDividendSafety } from '@/hooks/useDividendSafety';
import { cleanSymbol } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle, Award, Flame, RefreshCw } from 'lucide-react';

const getGrade = (score: number) => {
  if (score >= 90) return { grade: 'A+', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30' };
  if (score >= 80) return { grade: 'A', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/30' };
  if (score >= 70) return { grade: 'B', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30' };
  if (score >= 60) return { grade: 'C', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' };
  if (score >= 40) return { grade: 'D', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30' };
  return { grade: 'F', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30' };
};

export const DividendSafetyDashboard = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.currentPrice, 0);

  const dividendSymbols = useMemo(
    () => holdings.filter(h => (h.dividendYield || 0) > 0).map(h => cleanSymbol(h.symbol)),
    [holdings],
  );

  const { ratings, loading, error, refresh } = useDividendSafety(dividendSymbols);

  const safetyAnalysis = useMemo(() => {
    const analyzed = holdings
      .filter(h => (h.dividendYield || 0) > 0)
      .map(h => {
        const r = ratings[cleanSymbol(h.symbol)];
        const weight = totalValue > 0 ? (h.shares * h.currentPrice) / totalValue : 0;
        return {
          ...h,
          weight,
          hasData: !!r,
          score: r?.score ?? 50,
          payoutRatio: Number(r?.payout_ratio ?? 0),
          coverageRatio: Number(r?.coverage_ratio ?? 0),
          growthStreak: r?.growth_streak ?? 0,
          fivYrGrowth: Number(r?.five_yr_growth ?? 0),
          nextExDate: r?.next_ex_date || null,
          risks: r?.risks?.length ? r.risks : (r ? [] : ['Awaiting data']),
        };
      })
      .sort((a, b) => b.score - a.score);

    const weightedScore = analyzed.reduce((sum, h) => sum + h.score * h.weight, 0);
    const rated = analyzed.filter(h => h.hasData && h.payoutRatio > 0);
    const payoutWeight = rated.reduce((s, h) => s + h.weight, 0);
    const avgPayoutRatio = payoutWeight > 0 ? rated.reduce((s, h) => s + h.payoutRatio * h.weight, 0) / payoutWeight : 0;
    const aristocrats = analyzed.filter(h => h.growthStreak >= 25).length;
    const atRisk = analyzed.filter(h => h.hasData && h.score < 50).length;

    return { holdings: analyzed, weightedScore, avgPayoutRatio, aristocrats, atRisk };
  }, [holdings, totalValue, ratings]);

  const portfolioGrade = getGrade(safetyAnalysis.weightedScore);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Dividend Safety Dashboard
          </h2>
          <p className="text-muted-foreground">Live payout ratios, cash-flow coverage, growth streaks and safety scores</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-amber-500/40">
          <CardContent className="py-4 text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </CardContent>
        </Card>
      )}

      {(() => {
        const inc = safetyAnalysis.holdings.filter(h => h.hasData).map(h => ({
          income: h.shares * h.currentPrice * ((h.dividendYield || 0) / 100), score: h.score,
        }));
        const total = inc.reduce((s, x) => s + x.income, 0);
        if (total <= 0) return null;
        const pct = (f: (s: number) => boolean) => Math.round((inc.filter(x => f(x.score)).reduce((s, x) => s + x.income, 0) / total) * 100);
        const safe = pct(s => s >= 65), mid = pct(s => s >= 50 && s < 65), bad = Math.max(0, 100 - safe - mid);
        return (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="font-semibold">How safe is my income?</div>
              <p className="text-sm text-muted-foreground">
                Of your ${total.toFixed(0)}/yr in dividends: <b className="text-foreground">{safe}% likely safe</b>, {mid}% borderline, {bad}% may be unsafe.
              </p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="bg-primary" style={{ width: `${safe}%` }} />
                <div className="bg-accent" style={{ width: `${mid}%` }} />
                <div className="bg-destructive" style={{ width: `${bad}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">You'll get a Portfolio Update whenever a holding's grade changes. <a href="/tools/safety-track-record" className="underline">Public track record</a></p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-4xl font-black ${portfolioGrade.color}`}>{portfolioGrade.grade}</div>
            <div className="text-sm text-muted-foreground mt-1">Portfolio Safety</div>
            <div className="text-xs text-muted-foreground">{safetyAnalysis.weightedScore.toFixed(0)}/100</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{safetyAnalysis.avgPayoutRatio.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground mt-1">Avg Payout Ratio</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1">
              <Award className="w-6 h-6 text-amber-500" />
              <span className="text-3xl font-bold">{safetyAnalysis.aristocrats}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">Aristocrats (25yr+)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <span className="text-3xl font-bold">{safetyAnalysis.atRisk}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">At Risk</div>
          </CardContent>
        </Card>
      </div>

      {/* Holdings Safety Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-Holding Safety Analysis</CardTitle>
          <CardDescription>Scored on payout ratio, free cash-flow coverage, debt and dividend growth history</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && Object.keys(ratings).length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Stock</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Grade</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Score</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Payout</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Coverage</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Streak</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">5yr CAGR</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Next ex-date</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Risks</th>
                  </tr>
                </thead>
                <tbody>
                  {safetyAnalysis.holdings.map(h => {
                    const grade = getGrade(h.score);
                    return (
                      <tr key={h.symbol} className="border-b border-muted hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-medium">{cleanSymbol(h.symbol)}</div>
                          <div className="text-xs text-muted-foreground">{h.dividendYield?.toFixed(2)}% yield</div>
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge variant="outline" className={grade.bg}>
                            <span className={`font-bold ${grade.color}`}>{grade.grade}</span>
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-2">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={h.score} className="w-16 h-2" />
                            <span className="text-xs w-8">{h.score}</span>
                          </div>
                        </td>
                        <td className={`text-right py-3 px-2 ${h.payoutRatio > 75 ? 'text-red-500' : h.payoutRatio > 60 ? 'text-amber-500' : h.payoutRatio > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {h.payoutRatio > 0 ? `${h.payoutRatio.toFixed(0)}%` : '—'}
                        </td>
                        <td className={`text-right py-3 px-2 ${h.coverageRatio === 0 ? 'text-muted-foreground' : h.coverageRatio < 1.2 ? 'text-red-500' : h.coverageRatio < 1.5 ? 'text-amber-500' : 'text-green-500'}`}>
                          {h.coverageRatio > 0 ? `${h.coverageRatio.toFixed(1)}x` : '—'}
                        </td>
                        <td className="text-center py-3 px-2">
                          <div className="flex items-center justify-center gap-1">
                            {h.growthStreak >= 25 && <Flame className="w-3 h-3 text-amber-500" />}
                            <span className={h.growthStreak >= 25 ? 'font-bold text-amber-600' : ''}>{h.growthStreak}yr</span>
                          </div>
                        </td>
                        <td className={`text-right py-3 px-2 ${h.fivYrGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {h.fivYrGrowth >= 0 ? '+' : ''}{h.fivYrGrowth.toFixed(1)}%
                        </td>
                        <td className="text-center py-3 px-2 text-muted-foreground">
                          {h.nextExDate ? new Date(h.nextExDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-1">
                            {h.risks.length === 0 ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              h.risks.map(r => (
                                <Badge key={r} variant="outline" className="text-xs text-amber-600 border-amber-500/30">{r}</Badge>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {safetyAnalysis.holdings.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Dividend Holdings</h3>
            <p className="text-muted-foreground">Add dividend-paying stocks to see safety analysis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DividendSafetyDashboard;
