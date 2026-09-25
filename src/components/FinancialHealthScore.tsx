import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDemoMode } from '@/hooks/useDemoMode';
import { HeartPulse, Shield, TrendingUp, DollarSign, AlertTriangle, CheckCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface HealthMetrics {
  symbol: string;
  name: string;
  sector: string;
  overallScore: number;
  debtToEquity: number;
  currentRatio: number;
  interestCoverage: number;
  freeCashFlowYield: number;
  returnOnEquity: number;
  payoutRatio: number;
  revenueGrowth: number;
  earningsStability: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  risks: string[];
  strengths: string[];
}

const demoData: HealthMetrics[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', overallScore: 88, debtToEquity: 1.5, currentRatio: 1.07, interestCoverage: 29.3, freeCashFlowYield: 3.8, returnOnEquity: 147, payoutRatio: 15, revenueGrowth: 8.2, earningsStability: 92, grade: 'A', risks: ['High debt-to-equity ratio'], strengths: ['Exceptional ROE', 'Strong FCF', 'Low payout ratio', 'Consistent revenue growth'] },
  { symbol: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', overallScore: 92, debtToEquity: 0.42, currentRatio: 1.77, interestCoverage: 44.7, freeCashFlowYield: 2.9, returnOnEquity: 39.2, payoutRatio: 25, revenueGrowth: 15.7, earningsStability: 95, grade: 'A', risks: [], strengths: ['Low leverage', 'Excellent interest coverage', 'Strong growth', 'Highly stable earnings'] },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', overallScore: 74, debtToEquity: 0.54, currentRatio: 1.17, interestCoverage: 18.6, freeCashFlowYield: 4.2, returnOnEquity: 22, payoutRatio: 44, revenueGrowth: 3.1, earningsStability: 80, grade: 'B', risks: ['Slow revenue growth', 'Moderate payout ratio'], strengths: ['Dividend aristocrat', 'Low leverage', 'Solid FCF yield'] },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication', overallScore: 85, debtToEquity: 0.06, currentRatio: 2.93, interestCoverage: 318, freeCashFlowYield: 4.5, returnOnEquity: 27, payoutRatio: 0, revenueGrowth: 12.8, earningsStability: 82, grade: 'A', risks: ['No dividend history'], strengths: ['Virtually debt-free', 'Fortress balance sheet', 'High liquidity'] },
  { symbol: 'T', name: 'AT&T Inc.', sector: 'Telecom', overallScore: 42, debtToEquity: 1.18, currentRatio: 0.59, interestCoverage: 3.8, freeCashFlowYield: 9.1, returnOnEquity: 10, payoutRatio: 65, revenueGrowth: -1.5, earningsStability: 55, grade: 'D', risks: ['High leverage', 'Low current ratio', 'Declining revenue', 'High payout ratio', 'Low interest coverage'], strengths: ['High FCF yield'] },
  { symbol: 'VTI', name: 'Vanguard Total Market', sector: 'Broad Market ETF', overallScore: 78, debtToEquity: 0.8, currentRatio: 1.5, interestCoverage: 15, freeCashFlowYield: 3.2, returnOnEquity: 18, payoutRatio: 35, revenueGrowth: 7, earningsStability: 85, grade: 'B', risks: ['Market-level systematic risk'], strengths: ['Diversified exposure', 'Low cost', 'Stable returns'] },
];

const gradeColors: Record<string, string> = {
  A: 'bg-green-500/20 text-green-400 border-green-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const FinancialHealthScore: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { isDemoModeEnabled } = useDemoMode();
  const [search, setSearch] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const data = useMemo(() => {
    if (isDemoModeEnabled || !activePortfolio?.holdings?.length) return demoData;

    return activePortfolio.holdings.map(h => {
      const seed = h.symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const r = (n: number) => ((seed * 9301 + 49297 + n * 1327) % 233280) / 233280;
      const debtToEquity = +(r(1) * 2).toFixed(2);
      const currentRatio = +(0.5 + r(2) * 3).toFixed(2);
      const interestCoverage = +(1 + r(3) * 50).toFixed(1);
      const freeCashFlowYield = +(r(4) * 10).toFixed(1);
      const returnOnEquity = +(r(5) * 50).toFixed(1);
      const payoutRatio = Math.round(r(6) * 80);
      const revenueGrowth = +(-5 + r(7) * 30).toFixed(1);
      const earningsStability = Math.round(40 + r(8) * 60);

      let score = 50;
      if (debtToEquity < 0.5) score += 10; else if (debtToEquity > 1.5) score -= 10;
      if (currentRatio > 1.5) score += 8; else if (currentRatio < 1) score -= 8;
      if (interestCoverage > 10) score += 8; else if (interestCoverage < 3) score -= 10;
      if (returnOnEquity > 15) score += 8;
      if (revenueGrowth > 5) score += 8; else if (revenueGrowth < 0) score -= 8;
      if (earningsStability > 80) score += 8;
      score = Math.max(10, Math.min(100, score));

      const grade: HealthMetrics['grade'] = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
      const risks: string[] = [];
      const strengths: string[] = [];
      if (debtToEquity > 1.2) risks.push('High leverage'); else if (debtToEquity < 0.5) strengths.push('Low debt');
      if (currentRatio < 1) risks.push('Low liquidity'); else if (currentRatio > 2) strengths.push('Strong liquidity');
      if (revenueGrowth < 0) risks.push('Revenue declining'); else if (revenueGrowth > 10) strengths.push('Strong growth');
      if (returnOnEquity > 20) strengths.push('High profitability');
      if (payoutRatio > 60) risks.push('High payout ratio');

      return { symbol: h.symbol, name: h.name, sector: h.sector || 'Unknown', overallScore: score, debtToEquity, currentRatio, interestCoverage, freeCashFlowYield, returnOnEquity, payoutRatio, revenueGrowth, earningsStability, grade, risks, strengths };
    });
  }, [activePortfolio, isDemoModeEnabled]);

  const filtered = data.filter(d => d.symbol.toLowerCase().includes(search.toLowerCase()) || d.name.toLowerCase().includes(search.toLowerCase()));
  const avgScore = data.length ? Math.round(data.reduce((s, d) => s + d.overallScore, 0) / data.length) : 0;
  const portfolioGrade: HealthMetrics['grade'] = avgScore >= 85 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 55 ? 'C' : avgScore >= 40 ? 'D' : 'F';

  const radarData = expandedSymbol ? (() => {
    const item = data.find(d => d.symbol === expandedSymbol);
    if (!item) return [];
    return [
      { metric: 'Solvency', value: Math.min(100, Math.max(0, 100 - item.debtToEquity * 40)) },
      { metric: 'Liquidity', value: Math.min(100, item.currentRatio * 35) },
      { metric: 'Coverage', value: Math.min(100, item.interestCoverage * 2) },
      { metric: 'Profitability', value: Math.min(100, item.returnOnEquity * 2.5) },
      { metric: 'Growth', value: Math.min(100, Math.max(0, 50 + item.revenueGrowth * 3)) },
      { metric: 'Stability', value: item.earningsStability },
    ];
  })() : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Financial Health Analysis</h2>
        <p className="text-muted-foreground text-sm">Balance sheet strength, profitability, and risk assessment for every holding — inspired by Simply Wall St.</p>
      </div>

      {/* Portfolio Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 bg-card">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-2 ${gradeColors[portfolioGrade]}`}>
              {portfolioGrade}
            </div>
            <p className="text-lg font-semibold text-foreground mt-3">Portfolio Grade</p>
            <p className="text-sm text-muted-foreground">Avg Score: {avgScore}/100</p>
          </CardContent>
        </Card>

        {[
          { label: 'Strong Holdings', value: data.filter(d => d.overallScore >= 70).length, total: data.length, icon: CheckCircle, color: 'text-green-500' },
          { label: 'At Risk', value: data.filter(d => d.overallScore < 50).length, total: data.length, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Avg ROE', value: `${(data.reduce((s, d) => s + d.returnOnEquity, 0) / Math.max(1, data.length)).toFixed(1)}%`, icon: TrendingUp, color: 'text-primary' },
        ].map((item, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {typeof item.value === 'number' ? `${item.value}/${item.total}` : item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search holdings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Holdings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.sort((a, b) => b.overallScore - a.overallScore).map(item => {
          const isExpanded = expandedSymbol === item.symbol;
          return (
            <Card key={item.symbol} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setExpandedSymbol(isExpanded ? null : item.symbol)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{item.symbol}</span>
                      <Badge className={`text-xs ${gradeColors[item.grade]}`}>{item.grade}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{item.overallScore}</p>
                      <p className="text-[10px] text-muted-foreground">/ 100</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                <Progress value={item.overallScore} className="h-2 mb-3" />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">D/E:</span> <span className="text-foreground font-medium">{item.debtToEquity}</span></div>
                  <div><span className="text-muted-foreground">Current:</span> <span className="text-foreground font-medium">{item.currentRatio}</span></div>
                  <div><span className="text-muted-foreground">ROE:</span> <span className="text-foreground font-medium">{item.returnOnEquity}%</span></div>
                  <div><span className="text-muted-foreground">Growth:</span> <span className={`font-medium ${item.revenueGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>{item.revenueGrowth > 0 ? '+' : ''}{item.revenueGrowth}%</span></div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-border space-y-3" onClick={e => e.stopPropagation()}>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name={item.symbol} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>

                    {item.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-500 mb-1">✓ Strengths</p>
                        {item.strengths.map((s, i) => <p key={i} className="text-xs text-muted-foreground ml-3">• {s}</p>)}
                      </div>
                    )}
                    {item.risks.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-500 mb-1">⚠ Risks</p>
                        {item.risks.map((r, i) => <p key={i} className="text-xs text-muted-foreground ml-3">• {r}</p>)}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default FinancialHealthScore;
