import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { 
  TrendingUp, TrendingDown, Shield, DollarSign, BarChart3, Sparkles, Target, 
  Award, Crown, Star, CheckCircle, AlertTriangle, XCircle, ArrowUp, ArrowDown, Minus, Info, Brain
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import SnowflakeChart from './SnowflakeChart';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { SnowflakeScore } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, Line, BarChart, Bar } from 'recharts';
import { format, subMonths } from 'date-fns';

// --- Data generation helpers (simulated) ---
const generateStockScores = (symbol: string): SnowflakeScore => {
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => ((seed * (offset + 1)) % 100) / 25 + 1;
  const value = Math.min(5, Math.max(1, random(1)));
  const future = Math.min(5, Math.max(1, random(2)));
  const past = Math.min(5, Math.max(1, random(3)));
  const health = Math.min(5, Math.max(1, random(4)));
  const dividend = Math.min(5, Math.max(1, random(5)));
  return { value, future, past, health, dividend, total: value + future + past + health + dividend };
};

const FAIR_VALUE_DATA: Record<string, { fairValue: number; peRatio: number; forwardPe: number; priceToBook: number }> = {
  'AAPL': { fairValue: 195, peRatio: 31, forwardPe: 28, priceToBook: 48 },
  'MSFT': { fairValue: 420, peRatio: 36, forwardPe: 32, priceToBook: 12 },
  'GOOGL': { fairValue: 175, peRatio: 25, forwardPe: 22, priceToBook: 7 },
  'AMZN': { fairValue: 195, peRatio: 62, forwardPe: 45, priceToBook: 8 },
  'NVDA': { fairValue: 850, peRatio: 65, forwardPe: 40, priceToBook: 55 },
  'TSLA': { fairValue: 200, peRatio: 70, forwardPe: 55, priceToBook: 15 },
  'JNJ': { fairValue: 165, peRatio: 15, forwardPe: 14, priceToBook: 5.5 },
  'KO': { fairValue: 58, peRatio: 24, forwardPe: 22, priceToBook: 10 },
  'PG': { fairValue: 175, peRatio: 27, forwardPe: 25, priceToBook: 7.5 },
  'VZ': { fairValue: 48, peRatio: 9, forwardPe: 8, priceToBook: 1.8 },
};

const SAFETY_DATA: Record<string, { score: number; payoutRatio: number; streak: number; coverage: number }> = {
  'AAPL': { score: 92, payoutRatio: 15, streak: 12, coverage: 6.5 },
  'MSFT': { score: 95, payoutRatio: 28, streak: 19, coverage: 3.2 },
  'JNJ': { score: 88, payoutRatio: 45, streak: 62, coverage: 2.1 },
  'KO': { score: 82, payoutRatio: 68, streak: 62, coverage: 1.4 },
  'PG': { score: 85, payoutRatio: 62, streak: 68, coverage: 1.6 },
  'VZ': { score: 60, payoutRatio: 52, streak: 19, coverage: 1.3 },
};

const GROWTH_DATA: Record<string, { g1y: number; g5y: number; g10y: number }> = {
  'AAPL': { g1y: 4.2, g5y: 7.2, g10y: 9.5 },
  'MSFT': { g1y: 10.3, g5y: 10.1, g10y: 12.4 },
  'JNJ': { g1y: 5.3, g5y: 6.0, g10y: 6.3 },
  'KO': { g1y: 4.5, g5y: 3.5, g10y: 4.8 },
  'VZ': { g1y: 1.9, g5y: 2.0, g10y: 2.5 },
};

const getRecommendation = (avg: number) => {
  if (avg >= 4.5) return 'Strong Buy';
  if (avg >= 3.5) return 'Buy';
  if (avg >= 2.5) return 'Hold';
  if (avg >= 1.5) return 'Sell';
  return 'Strong Sell';
};

const getRecColor = (rec: string) => {
  switch (rec) {
    case 'Strong Buy': return 'bg-green-500/20 text-green-500 border-green-500/30';
    case 'Buy': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
    case 'Hold': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'Sell': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    default: return 'bg-red-500/20 text-red-500 border-red-500/30';
  }
};

const ScoreBar: React.FC<{ label: string; score: number; icon: React.ReactNode; desc: string }> = ({ label, score, icon, desc }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-full bg-primary/10">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className={`text-sm font-bold ${score >= 3.5 ? 'text-green-500' : score >= 2.5 ? 'text-yellow-500' : 'text-red-500'}`}>
        {score.toFixed(1)}/5
      </span>
    </div>
    <Progress value={(score / 5) * 100} className="h-2" />
    <p className="text-xs text-muted-foreground">{desc}</p>
  </div>
);

export const UnifiedStockReport: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdingSymbols = activePortfolio?.holdings?.map(h => cleanSymbol(h.symbol)) || [];
  const popularSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'JNJ', 'KO', 'PG', 'VZ'];
  const [selectedSymbol, setSelectedSymbol] = useState(holdingSymbols[0] || 'AAPL');
  const [aiInsight, setAiInsight] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRisks, setAiRisks] = useState<{ strengths: string[]; risks: string[] } | null>(null);
  const [aiRisksLoading, setAiRisksLoading] = useState(false);

  const holding = activePortfolio?.holdings?.find(h => cleanSymbol(h.symbol) === selectedSymbol);
  const currentPrice = holding?.currentPrice || 175;

  const scores = useMemo(() => generateStockScores(selectedSymbol), [selectedSymbol]);
  const avgScore = (scores.value + scores.future + scores.past + scores.health + scores.dividend) / 5;
  const recommendation = getRecommendation(avgScore);

  const fairData = FAIR_VALUE_DATA[selectedSymbol] || { fairValue: currentPrice * 1.05, peRatio: 20, forwardPe: 18, priceToBook: 5 };
  const upside = ((fairData.fairValue - currentPrice) / currentPrice) * 100;
  const valuationStatus = upside > 10 ? 'Undervalued' : upside < -10 ? 'Overvalued' : 'Fair Value';

  const safety = SAFETY_DATA[selectedSymbol] || { score: 70, payoutRatio: 40, streak: 10, coverage: 2 };
  const growth = GROWTH_DATA[selectedSymbol] || { g1y: 3, g5y: 5, g10y: 6 };

  // Fair value chart
  const priceHistory = useMemo(() => {
    const data = [];
    for (let i = 24; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const variance = Math.sin(i / 3) * 0.15 + (Math.random() - 0.5) * 0.1;
      data.push({
        date: format(date, 'MMM yy'),
        price: +(currentPrice * (1 - (i / 24) * 0.2 + variance)).toFixed(2),
        fairValue: +(fairData.fairValue * (1 - (i / 24) * 0.15)).toFixed(2),
      });
    }
    return data;
  }, [selectedSymbol, currentPrice, fairData.fairValue]);

  // Growth chart data
  const growthChart = useMemo(() => [
    { period: '1Y', growth: growth.g1y },
    { period: '5Y', growth: growth.g5y },
    { period: '10Y', growth: growth.g10y },
  ], [growth]);

  const fetchAIInsight = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { action: 'stock_analysis', payload: { symbol: selectedSymbol } }
      });
      if (error) throw error;
      setAiInsight(data.result || 'No insight available.');
    } catch {
      setAiInsight('AI analysis unavailable at this time.');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchAIRisks = async () => {
    setAiRisksLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { action: 'stock_risks', payload: { symbol: selectedSymbol } }
      });
      if (error) throw error;
      setAiRisks(data.result || null);
    } catch {
      setAiRisks(null);
    } finally {
      setAiRisksLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Visual Stock Report
          </h1>
          <p className="text-muted-foreground">Comprehensive analysis inspired by Simply Wall St</p>
        </div>
        <Select value={selectedSymbol} onValueChange={(v) => { setSelectedSymbol(v); setAiInsight(''); setAiRisks(null); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {holdingSymbols.length > 0 && holdingSymbols.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
            {popularSymbols.filter(s => !holdingSymbols.includes(s)).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overview Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <p className="text-3xl font-bold text-primary">{avgScore.toFixed(1)}<span className="text-lg">/5</span></p>
            <Badge className={`mt-1 ${getRecColor(recommendation)}`}>{recommendation}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Fair Value</p>
            <p className="text-2xl font-bold">${fairData.fairValue.toFixed(0)}</p>
            <Badge className={upside > 10 ? 'bg-green-500/20 text-green-500' : upside < -10 ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}>
              {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% {valuationStatus}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">Dividend Safety</p>
            <p className={`text-2xl font-bold ${safety.score >= 80 ? 'text-green-500' : safety.score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
              {safety.score}/100
            </p>
            <p className="text-xs text-muted-foreground">{safety.streak} yr streak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">5Y Div Growth</p>
            <p className={`text-2xl font-bold ${growth.g5y >= 5 ? 'text-green-500' : 'text-foreground'}`}>
              +{growth.g5y.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Annualized CAGR</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="snowflake" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="snowflake">Quality Snowflake</TabsTrigger>
          <TabsTrigger value="valuation">Fair Value</TabsTrigger>
          <TabsTrigger value="health">Financial Health</TabsTrigger>
          <TabsTrigger value="dividend">Dividend Quality</TabsTrigger>
          <TabsTrigger value="ai">AI Insight</TabsTrigger>
        </TabsList>

        {/* Snowflake */}
        <TabsContent value="snowflake">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{selectedSymbol} Snowflake</CardTitle></CardHeader>
              <CardContent>
                <SnowflakeChart data={scores} height={300} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <ScoreBar label="Value" score={scores.value} icon={<DollarSign className="w-4 h-4 text-primary" />} desc="Trading at fair value based on earnings and cash flow" />
                <ScoreBar label="Future Growth" score={scores.future} icon={<TrendingUp className="w-4 h-4 text-primary" />} desc="Expected earnings growth over 3 years" />
                <ScoreBar label="Past Performance" score={scores.past} icon={<BarChart3 className="w-4 h-4 text-primary" />} desc="Historical earnings consistency over 5 years" />
                <ScoreBar label="Financial Health" score={scores.health} icon={<Shield className="w-4 h-4 text-primary" />} desc="Balance sheet strength and debt levels" />
                <ScoreBar label="Dividend" score={scores.dividend} icon={<DollarSign className="w-4 h-4 text-primary" />} desc="Dividend yield, payout ratio, and growth" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Valuation */}
        <TabsContent value="valuation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Price vs Fair Value</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm text-muted-foreground">Current Price</p>
                  <p className="text-2xl font-bold">${currentPrice.toFixed(2)}</p>
                </div>
                <Badge className={upside > 10 ? 'bg-green-500/20 text-green-500' : upside < -10 ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}>
                  {valuationStatus}
                </Badge>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Fair Value</p>
                  <p className="text-2xl font-bold text-primary">${fairData.fairValue.toFixed(2)}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Area type="monotone" dataKey="fairValue" fill="hsl(var(--primary) / 0.1)" stroke="none" />
                  <Line type="monotone" dataKey="price" name="Price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fairValue" name="Fair Value" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-sm text-muted-foreground">P/E Ratio</p><p className="text-lg font-bold">{fairData.peRatio}x</p></div>
                <div><p className="text-sm text-muted-foreground">Forward P/E</p><p className="text-lg font-bold">{fairData.forwardPe}x</p></div>
                <div><p className="text-sm text-muted-foreground">P/B Ratio</p><p className="text-lg font-bold">{fairData.priceToBook}x</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Health */}
        <TabsContent value="health">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Dividend Safety</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${safety.score >= 80 ? 'text-green-500' : safety.score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {safety.score}
                  </div>
                  <Badge className={safety.score >= 80 ? 'bg-green-500/20 text-green-500 mt-2' : safety.score >= 60 ? 'bg-yellow-500/20 text-yellow-500 mt-2' : 'bg-red-500/20 text-red-500 mt-2'}>
                    {safety.score >= 80 ? 'Very Safe' : safety.score >= 60 ? 'Safe' : 'At Risk'}
                  </Badge>
                </div>
                <div className="space-y-3 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Payout Ratio</span>
                    <span className={`font-medium ${safety.payoutRatio > 75 ? 'text-red-500' : ''}`}>{safety.payoutRatio}%</span>
                  </div>
                  <Progress value={safety.payoutRatio} className="h-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">FCF Coverage</span>
                    <span className="font-medium">{safety.coverage}x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Consecutive Years</span>
                    <Badge variant="outline">{safety.streak} yrs</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Dividend Growth</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={growthChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="growth" name="CAGR" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center text-sm">
                  {growthChart.map(g => (
                    <div key={g.period}>
                      <p className="text-muted-foreground">{g.period}</p>
                      <p className={`font-bold ${g.growth >= 5 ? 'text-green-500' : 'text-foreground'}`}>+{g.growth.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Dividend Quality */}
        <TabsContent value="dividend">
          <Card>
            <CardHeader><CardTitle>Dividend Profile for {selectedSymbol}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Yield</p>
                  <p className="text-2xl font-bold">{(holding?.dividendYield || 1.5).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payout Ratio</p>
                  <p className={`text-2xl font-bold ${safety.payoutRatio > 75 ? 'text-red-500' : ''}`}>{safety.payoutRatio}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-2xl font-bold">{safety.streak}</p>
                    <span className="text-sm text-muted-foreground">yrs</span>
                  </div>
                  {safety.streak >= 50 && <Badge className="bg-yellow-500/20 text-yellow-600"><Crown className="w-3 h-3 mr-1" />King</Badge>}
                  {safety.streak >= 25 && safety.streak < 50 && <Badge className="bg-purple-500/20 text-purple-500"><Award className="w-3 h-3 mr-1" />Aristocrat</Badge>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">5Y Growth</p>
                  <p className={`text-2xl font-bold ${growth.g5y >= 5 ? 'text-green-500' : ''}`}>+{growth.g5y.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insight */}
        <TabsContent value="ai">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-primary" />AI Analysis</CardTitle>
                <CardDescription>AI-powered fundamental analysis for {selectedSymbol}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!aiInsight && !aiLoading && (
                  <Button onClick={fetchAIInsight} className="w-full">
                    <Brain className="w-4 h-4 mr-2" />Generate AI Analysis
                  </Button>
                )}
                {aiLoading && <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                {aiInsight && <p className="text-sm leading-relaxed">{aiInsight}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">Bull vs Bear Case</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!aiRisks && !aiRisksLoading && (
                  <Button onClick={fetchAIRisks} variant="outline" className="w-full">
                    <BarChart3 className="w-4 h-4 mr-2" />Generate Bull/Bear Analysis
                  </Button>
                )}
                {aiRisksLoading && <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}
                {aiRisks && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-green-500 mb-2 flex items-center gap-1"><ArrowUp className="w-4 h-4" />Strengths</h4>
                      <ul className="space-y-1">
                        {aiRisks.strengths?.map((s, i) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><CheckCircle className="w-3 h-3 text-green-500 mt-1 shrink-0" />{s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-red-500 mb-2 flex items-center gap-1"><ArrowDown className="w-4 h-4" />Risks</h4>
                      <ul className="space-y-1">
                        {aiRisks.risks?.map((r, i) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><AlertTriangle className="w-3 h-3 text-red-500 mt-1 shrink-0" />{r}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This report combines multiple analysis models. Scores and fair values are estimates for educational purposes only. Always do your own research.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default UnifiedStockReport;
