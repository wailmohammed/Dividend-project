import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Globe, Loader2, Zap, TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Newspaper, Shield, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface MacroSignal {
  indicator: string;
  value: string;
  trend: string;
  implication: string;
}

interface KeyEvent {
  event: string;
  impact: string;
  affectedSectors: string[];
  significance: string;
}

interface TradingIdea {
  type: string;
  description: string;
  timeframe: string;
}

interface RiskItem {
  risk: string;
  probability: string;
  impact: string;
}

interface IntelligenceData {
  headline: string;
  marketMood: string;
  moodScore: number;
  keyEvents: KeyEvent[];
  macroSignals: MacroSignal[];
  sectorRotation: {
    inflows: string[];
    outflows: string[];
    narrative: string;
  };
  tradingIdeas: TradingIdea[];
  riskRadar: RiskItem[];
  weekAhead: string;
}

const DEMO_INTEL: IntelligenceData = {
  headline: 'Markets rally on dovish Fed signals as AI capex cycle broadens — rotation into utilities and small caps accelerating',
  marketMood: 'risk-on',
  moodScore: 72,
  keyEvents: [
    { event: 'Fed Chair signals potential rate cuts in H2 2026', impact: 'positive', affectedSectors: ['Real Estate', 'Utilities', 'Small Caps'], significance: 'high' },
    { event: 'NVIDIA earnings beat expectations by 15%', impact: 'positive', affectedSectors: ['Technology', 'Semiconductors'], significance: 'high' },
    { event: 'China PMI contraction deepens to 48.2', impact: 'negative', affectedSectors: ['Materials', 'Industrials', 'Luxury'], significance: 'medium' },
    { event: 'Oil inventories surge, WTI drops below $75', impact: 'negative', affectedSectors: ['Energy'], significance: 'medium' },
    { event: 'GLP-1 drug market forecast revised up to $150B by 2030', impact: 'positive', affectedSectors: ['Healthcare', 'Biotech'], significance: 'medium' },
  ],
  macroSignals: [
    { indicator: 'US 10Y Yield', value: '4.18%', trend: 'falling', implication: 'Easing financial conditions support growth stocks and REITs' },
    { indicator: 'VIX', value: '14.8', trend: 'falling', implication: 'Low volatility signals complacency — potential for sharp reversal' },
    { indicator: 'DXY (Dollar)', value: '103.2', trend: 'falling', implication: 'Weaker dollar boosts multinationals and emerging markets' },
    { indicator: 'Oil (WTI)', value: '$74.80', trend: 'falling', implication: 'Lower energy costs support consumer spending' },
  ],
  sectorRotation: {
    inflows: ['Utilities', 'Small Caps', 'REITs', 'Biotech'],
    outflows: ['Energy', 'Materials', 'Large Cap Growth'],
    narrative: 'Classic rate-cut rotation underway: money flowing from expensive mega-caps into rate-sensitive sectors and beaten-down small caps.',
  },
  tradingIdeas: [
    { type: 'long', description: 'Buy IWM (Russell 2000 ETF) on rate-cut tailwind and relative valuation discount', timeframe: '2-4 weeks' },
    { type: 'long', description: 'Accumulate utility stocks (XLU) ahead of expected rate cuts', timeframe: '1-3 months' },
    { type: 'hedge', description: 'Consider VIX calls as a hedge — low VIX = cheap portfolio insurance', timeframe: '1-2 weeks' },
  ],
  riskRadar: [
    { risk: 'Inflation re-acceleration from sticky services', probability: 'medium', impact: 'high' },
    { risk: 'AI capex bubble concerns triggering tech selloff', probability: 'low', impact: 'high' },
    { risk: 'Geopolitical escalation in Middle East disrupting oil', probability: 'medium', impact: 'medium' },
  ],
  weekAhead: 'Key focus next week: Non-Farm Payrolls (Friday) will set the tone for rate cut expectations. Also watch CPI revisions Wednesday and earnings from major retailers. Any signs of labor market weakening could accelerate the rate-cut trade.',
};

const moodColors: Record<string, string> = {
  'risk-on': 'text-emerald-600 dark:text-emerald-400',
  'risk-off': 'text-red-600 dark:text-red-400',
  'mixed': 'text-amber-600 dark:text-amber-400',
  'cautious': 'text-orange-600 dark:text-orange-400',
};

const impactColors: Record<string, string> = {
  positive: 'border-l-emerald-500',
  negative: 'border-l-red-500',
  neutral: 'border-l-blue-500',
};

const MarketIntelligence: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<IntelligenceData | null>(null);

  const fetchIntelligence = useCallback(async () => {
    if (isDemoMode) {
      setIntel(DEMO_INTEL);
      toast.success('Market intelligence loaded');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: { action: 'market_intelligence' },
      });
      if (error) throw error;
      if (data?.result?.headline) {
        setIntel(data.result);
        toast.success('Intelligence brief generated');
      } else throw new Error('Invalid response');
    } catch (err: any) {
      console.error('Intelligence error:', err);
      toast.error('Failed to generate intelligence brief');
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Globe className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Market Intelligence</h2>
            <p className="text-sm text-muted-foreground">AI-powered global market analysis — what's moving the world right now</p>
          </div>
        </div>
        <Button onClick={fetchIntelligence} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Generate Brief'}
        </Button>
      </div>

      {!intel ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Globe className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">What's Moving the World?</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Get an AI-generated intelligence brief covering macro signals, sector rotation, risk factors, and actionable trading ideas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Headline */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Newspaper className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-base font-semibold text-foreground leading-relaxed">{intel.headline}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline" className={`${moodColors[intel.marketMood]} capitalize`}>{intel.marketMood.replace('-', ' ')}</Badge>
                    <span className="text-xs text-muted-foreground">Mood Score: <span className="font-semibold">{intel.moodScore}/100</span></span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Key Market Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {intel.keyEvents.map((e, i) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 bg-muted/20 ${impactColors[e.impact]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.event}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {e.affectedSectors.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${e.significance === 'high' ? 'border-red-300 text-red-500' : 'border-border'}`}>
                      {e.significance}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Macro Signals & Sector Rotation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Macro Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {intel.macroSignals.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{s.indicator}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{s.value}</span>
                        {s.trend === 'rising' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> :
                         s.trend === 'falling' ? <TrendingDown className="w-3.5 h-3.5 text-red-500" /> :
                         <span className="text-xs text-muted-foreground">→</span>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.implication}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Sector Rotation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">↑ Inflows</p>
                    <div className="flex flex-wrap gap-1.5">
                      {intel.sectorRotation.inflows.map(s => (
                        <Badge key={s} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5">↓ Outflows</p>
                    <div className="flex flex-wrap gap-1.5">
                      {intel.sectorRotation.outflows.map(s => (
                        <Badge key={s} className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0 text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{intel.sectorRotation.narrative}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trading Ideas & Risk Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Actionable Trading Ideas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {intel.tradingIdeas.map((idea, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] border-0 ${idea.type === 'long' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : idea.type === 'short' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                        {idea.type.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{idea.timeframe}</span>
                    </div>
                    <p className="text-sm text-foreground">{idea.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Risk Radar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {intel.riskRadar.map((r, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm font-medium text-foreground mb-1">{r.risk}</p>
                    <div className="flex gap-3">
                      <span className="text-[10px] text-muted-foreground">Probability: <span className={r.probability === 'high' ? 'text-red-500 font-semibold' : r.probability === 'medium' ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>{r.probability}</span></span>
                      <span className="text-[10px] text-muted-foreground">Impact: <span className={r.impact === 'high' ? 'text-red-500 font-semibold' : r.impact === 'medium' ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>{r.impact}</span></span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Week Ahead */}
          <Card className="bg-muted/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Week Ahead Preview</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{intel.weekAhead}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MarketIntelligence;
