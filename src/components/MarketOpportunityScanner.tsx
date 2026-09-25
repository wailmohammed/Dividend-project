import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Radar, TrendingUp, TrendingDown, Loader2, Zap, Target, Shield, Clock, ArrowUpRight, Flame, Eye, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar } from 'recharts';
import { toast } from 'sonner';

interface Opportunity {
  symbol: string;
  name: string;
  category: string;
  score: number;
  currentPrice: number;
  targetPrice: number;
  upside: number;
  sector: string;
  catalysts: string[];
  riskLevel: string;
  timeHorizon: string;
  summary: string;
}

interface SectorOutlook {
  sector: string;
  rating: string;
  reason: string;
}

interface ScanResult {
  opportunities: Opportunity[];
  marketRegime: string;
  topThemes: string[];
  sectorOutlook: SectorOutlook[];
}

const DEMO_SCAN: ScanResult = {
  opportunities: [
    { symbol: 'CRWD', name: 'CrowdStrike', category: 'momentum', score: 88, currentPrice: 385, targetPrice: 450, upside: 16.9, sector: 'Technology', catalysts: ['AI-driven cybersecurity demand', 'Federal contract wins'], riskLevel: 'medium', timeHorizon: 'medium', summary: 'Leading next-gen cybersecurity platform with accelerating enterprise adoption and expanding TAM through AI integration.' },
    { symbol: 'VST', name: 'Vistra Corp', category: 'breakout', score: 82, currentPrice: 128, targetPrice: 165, upside: 28.9, sector: 'Utilities', catalysts: ['Data center power demand surge', 'Nuclear renaissance play'], riskLevel: 'medium', timeHorizon: 'long', summary: 'Power generation company benefiting from AI data center electricity demand explosion and nuclear energy revival.' },
    { symbol: 'HIMS', name: 'Hims & Hers Health', category: 'undervalued', score: 79, currentPrice: 52, targetPrice: 72, upside: 38.5, sector: 'Healthcare', catalysts: ['GLP-1 compounding opportunity', 'Subscriber growth acceleration'], riskLevel: 'high', timeHorizon: 'medium', summary: 'Telehealth disruptor capitalizing on compounded GLP-1 demand with 40%+ subscriber growth and improving margins.' },
    { symbol: 'AVGO', name: 'Broadcom', category: 'momentum', score: 91, currentPrice: 228, targetPrice: 275, upside: 20.6, sector: 'Technology', catalysts: ['Custom AI chip dominance', 'VMware synergies accelerating'], riskLevel: 'low', timeHorizon: 'long', summary: 'Semiconductor giant with unmatched AI networking position and VMware integration driving margin expansion.' },
    { symbol: 'KMI', name: 'Kinder Morgan', category: 'dividend_gem', score: 76, currentPrice: 28, targetPrice: 34, upside: 21.4, sector: 'Energy', catalysts: ['Natural gas infrastructure demand', '6.2% yield with growth'], riskLevel: 'low', timeHorizon: 'long', summary: 'Pipeline operator with growing dividend and increasing natural gas demand from LNG exports and power generation.' },
    { symbol: 'CELH', name: 'Celsius Holdings', category: 'turnaround', score: 72, currentPrice: 32, targetPrice: 48, upside: 50.0, sector: 'Consumer', catalysts: ['International expansion', 'Distribution normalization'], riskLevel: 'high', timeHorizon: 'medium', summary: 'Energy drink challenger trading at depressed valuations after distribution reset, with international expansion providing next growth leg.' },
    { symbol: 'ANET', name: 'Arista Networks', category: 'momentum', score: 86, currentPrice: 98, targetPrice: 125, upside: 27.6, sector: 'Technology', catalysts: ['AI campus networking upgrade cycle', 'Cloud titan spend increase'], riskLevel: 'medium', timeHorizon: 'medium', summary: 'Networking leader riding the AI infrastructure buildout wave with dominant cloud customer relationships.' },
    { symbol: 'XLU', name: 'Utilities Select SPDR', category: 'sector_rotation', score: 74, currentPrice: 78, targetPrice: 88, upside: 12.8, sector: 'Utilities', catalysts: ['Rate cut beneficiary', 'AI power demand secular trend'], riskLevel: 'low', timeHorizon: 'medium', summary: 'Defensive sector ETF benefiting from rate cut expectations and structural electricity demand growth from AI.' },
  ],
  marketRegime: 'risk-on',
  topThemes: ['AI Infrastructure Buildout', 'Rate Cut Expectations', 'Energy Transition & Power Demand', 'GLP-1 & Healthcare Innovation'],
  sectorOutlook: [
    { sector: 'Technology', rating: 'overweight', reason: 'AI capex cycle still accelerating' },
    { sector: 'Utilities', rating: 'overweight', reason: 'Data center power demand + rate cuts' },
    { sector: 'Healthcare', rating: 'neutral', reason: 'GLP-1 tailwind offset by pricing pressure' },
    { sector: 'Financials', rating: 'neutral', reason: 'NII compression vs. capital markets recovery' },
    { sector: 'Energy', rating: 'underweight', reason: 'Supply growth capping oil prices' },
    { sector: 'Consumer Disc.', rating: 'neutral', reason: 'Mixed consumer spending signals' },
  ],
};

const categoryLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  undervalued: { label: 'Undervalued', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', icon: <Target className="w-3 h-3" /> },
  momentum: { label: 'Momentum', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', icon: <TrendingUp className="w-3 h-3" /> },
  breakout: { label: 'Breakout', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: <Zap className="w-3 h-3" /> },
  dividend_gem: { label: 'Dividend Gem', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: <Shield className="w-3 h-3" /> },
  turnaround: { label: 'Turnaround', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', icon: <Flame className="w-3 h-3" /> },
  sector_rotation: { label: 'Sector Rotation', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', icon: <BarChart3 className="w-3 h-3" /> },
};

const ratingColors: Record<string, string> = {
  overweight: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-foreground',
  underweight: 'text-red-600 dark:text-red-400',
};

const MarketOpportunityScanner: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanType, setScanType] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'upside'>('score');

  const runScan = useCallback(async () => {
    if (isDemoMode) {
      setScanResult(DEMO_SCAN);
      toast.success('Demo scan complete — 8 opportunities found');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { action: 'market_opportunity_scan', payload: { scanType } },
      });
      if (error) throw error;
      const result = data?.result;
      if (result?.opportunities) {
        setScanResult(result);
        toast.success(`Scan complete — ${result.opportunities.length} opportunities found`);
      } else {
        throw new Error('Invalid scan response');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      toast.error('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, scanType]);

  const sorted = scanResult?.opportunities
    ? [...scanResult.opportunities].sort((a, b) => sortBy === 'score' ? b.score - a.score : b.upside - a.upside)
    : [];

  const scoreChartData = sorted.slice(0, 8).map(o => ({ name: o.symbol, score: o.score, upside: o.upside }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Radar className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Market Opportunity Scanner</h2>
          <p className="text-sm text-muted-foreground">AI-powered discovery of hidden investment opportunities across global markets</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Scan Type</label>
              <Select value={scanType} onValueChange={setScanType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Opportunities</SelectItem>
                  <SelectItem value="undervalued">Undervalued Gems</SelectItem>
                  <SelectItem value="momentum">Momentum Plays</SelectItem>
                  <SelectItem value="breakout">Breakout Candidates</SelectItem>
                  <SelectItem value="dividend_gem">Dividend Gems</SelectItem>
                  <SelectItem value="turnaround">Turnaround Stories</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">AI Score</SelectItem>
                  <SelectItem value="upside">Upside %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runScan} disabled={loading} className="gap-2 min-w-[160px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Scanning...' : 'Run AI Scan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!scanResult ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Radar className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Discover Hidden Opportunities</h3>
            <p className="text-sm text-muted-foreground max-w-lg">
              Our AI scans the entire market to surface undervalued stocks, momentum plays, breakout candidates, and high-yield dividend gems — inspired by professional-grade tools like Forecaster.biz.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Market Regime & Themes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Market Regime</p>
                <p className="text-lg font-bold text-foreground capitalize">{scanResult.marketRegime.replace('-', ' ')}</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Top Investment Themes</p>
                <div className="flex flex-wrap gap-2">
                  {scanResult.topThemes.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="opportunities">
            <TabsList>
              <TabsTrigger value="opportunities">Opportunities ({sorted.length})</TabsTrigger>
              <TabsTrigger value="chart">Score Chart</TabsTrigger>
              <TabsTrigger value="sectors">Sector Outlook</TabsTrigger>
            </TabsList>

            <TabsContent value="opportunities">
              <div className="grid gap-4">
                {sorted.map(opp => {
                  const cat = categoryLabels[opp.category] || { label: opp.category, color: 'bg-muted text-foreground', icon: null };
                  return (
                    <Card key={opp.symbol} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-lg font-bold text-foreground">{opp.symbol}</span>
                              <span className="text-sm text-muted-foreground">{opp.name}</span>
                              <Badge className={`${cat.color} text-[10px] gap-1 border-0`}>{cat.icon}{cat.label}</Badge>
                              <Badge variant="outline" className="text-[10px]">{opp.sector}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{opp.summary}</p>
                            <div className="flex flex-wrap gap-1">
                              {opp.catalysts.map((c, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 md:gap-6 shrink-0">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Score</p>
                              <p className={`text-xl font-bold ${opp.score >= 80 ? 'text-emerald-500' : opp.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{opp.score}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Price</p>
                              <p className="text-sm font-semibold text-foreground">${opp.currentPrice}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Target</p>
                              <p className="text-sm font-semibold text-primary">${opp.targetPrice}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Upside</p>
                              <div className="flex items-center gap-0.5">
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                                <p className="text-sm font-bold text-emerald-500">+{opp.upside.toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Risk</p>
                              <Badge variant="outline" className={`text-[10px] ${opp.riskLevel === 'low' ? 'text-emerald-500 border-emerald-300' : opp.riskLevel === 'high' ? 'text-red-500 border-red-300' : 'text-amber-500 border-amber-300'}`}>
                                {opp.riskLevel}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="chart">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Opportunity Score vs Upside</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scoreChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--popover-foreground))' }} />
                        <Bar dataKey="score" name="AI Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="upside" name="Upside %" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sectors">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">AI Sector Outlook</CardTitle>
                  <CardDescription>Sector positioning recommendations based on current market conditions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scanResult.sectorOutlook.map(s => (
                      <div key={s.sector} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.sector}</p>
                          <p className="text-xs text-muted-foreground">{s.reason}</p>
                        </div>
                        <Badge variant="outline" className={`${ratingColors[s.rating]} text-xs capitalize font-semibold`}>
                          {s.rating}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default MarketOpportunityScanner;
