import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText, Search, TrendingUp, TrendingDown, ShieldCheck,
  AlertTriangle, Newspaper, ChevronRight, Star, Sparkles, Loader2, RefreshCw,
} from 'lucide-react';

interface NarrativeData {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  overallSentiment: 'Bullish' | 'Neutral' | 'Bearish';
  summary: string;
  risks: string[];
  rewards: string[];
  recentDevelopments: string[];
  analystConsensus: string;
  keyMetrics: { label: string; value: string; trend: 'up' | 'down' | 'flat' }[];
  isAI?: boolean;
}

// Fallback static narratives for well-known stocks
const STATIC_NARRATIVES: Record<string, Omit<NarrativeData, 'symbol' | 'name' | 'sector' | 'currentPrice'>> = {
  'AAPL': {
    overallSentiment: 'Bullish',
    summary: 'Apple remains a dominant force in consumer tech with strong services growth offsetting hardware maturity.',
    risks: ['iPhone revenue concentration (~52%)', 'China demand risk', 'Premium valuation at ~30x earnings', 'App Store antitrust scrutiny'],
    rewards: ['Services revenue growing 15%+ YoY', 'Massive buyback ($90B+)', 'AI features driving upgrades', '2.2B+ active devices'],
    recentDevelopments: ['Apple Intelligence AI rollout', 'Services hit record revenue', 'Vision Pro enterprise adoption growing'],
    analystConsensus: 'Strong Buy — Average target $210',
    keyMetrics: [{ label: 'Rev Growth', value: '+5.2%', trend: 'up' }, { label: 'FCF', value: '$111B', trend: 'up' }, { label: 'Div Growth', value: '+6.1%', trend: 'up' }, { label: 'Buyback', value: '3.5%', trend: 'flat' }],
  },
  'MSFT': {
    overallSentiment: 'Bullish',
    summary: 'Microsoft is the leading enterprise AI beneficiary through Azure OpenAI and Copilot. Cloud growth and margin expansion drive value.',
    risks: ['Azure growth deceleration', 'Heavy AI CapEx', 'Copilot monetization early-stage', 'Regulatory scrutiny'],
    rewards: ['Azure revenue growing 29%+', 'Copilot adoption', 'Dominant enterprise AI position', '70%+ recurring revenue'],
    recentDevelopments: ['Azure AI run rate >$10B', 'Copilot enterprise adoption accelerating', 'GitHub Copilot 1.8M+ subscribers'],
    analystConsensus: 'Strong Buy — Average target $480',
    keyMetrics: [{ label: 'Cloud Growth', value: '+29%', trend: 'up' }, { label: 'Op Margin', value: '44%', trend: 'up' }, { label: 'FCF', value: '$63B', trend: 'up' }, { label: 'Div Yield', value: '0.75%', trend: 'up' }],
  },
};

const NARRATIVE_CACHE_PREFIX = 'wealthos_narrative_v1_';
const NARRATIVE_TTL = 24 * 60 * 60 * 1000;

const getCachedNarrative = (symbol: string): NarrativeData | null => {
  try {
    const raw = localStorage.getItem(NARRATIVE_CACHE_PREFIX + symbol);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < NARRATIVE_TTL) return data;
    }
  } catch {}
  return null;
};

const setCachedNarrative = (symbol: string, data: NarrativeData) => {
  try { localStorage.setItem(NARRATIVE_CACHE_PREFIX + symbol, JSON.stringify({ data, ts: Date.now() })); } catch {}
};

const generateFallbackNarrative = (symbol: string, name: string, sector: string, price: number): NarrativeData => ({
  symbol, name, sector, currentPrice: price,
  overallSentiment: 'Neutral',
  summary: `${name} (${symbol}) operates in the ${sector || 'diversified'} sector at $${price.toFixed(2)}. The stock presents a balanced risk/reward profile based on current fundamentals.`,
  risks: ['Sector competitive pressures', 'Macroeconomic sensitivity', 'Valuation vs historical average', 'Margin compression risk'],
  rewards: ['Market position strength', 'Dividend income potential', 'Growth catalysts', 'Operational efficiency'],
  recentDevelopments: ['Quarterly results in line', 'Management reaffirmed guidance', 'Continued buyback program'],
  analystConsensus: 'Hold — Limited coverage',
  keyMetrics: [
    { label: 'Price', value: `$${price.toFixed(2)}`, trend: 'flat' },
    { label: 'Sector', value: sector || 'N/A', trend: 'flat' },
  ],
});

export const NarrativeAnalysis = () => {
  const { activePortfolio } = usePortfolio();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiNarratives, setAiNarratives] = useState<Record<string, NarrativeData>>({});
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);

  const holdings = activePortfolio?.holdings || [];

  const narratives = useMemo((): NarrativeData[] => {
    return holdings.map(h => {
      const sym = h.symbol?.replace('.US', '').toUpperCase();
      // Priority: AI-generated > cached > static > fallback
      if (aiNarratives[sym]) return aiNarratives[sym];
      const cached = getCachedNarrative(sym);
      if (cached) return cached;
      const staticN = STATIC_NARRATIVES[sym];
      if (staticN) return { symbol: sym, name: h.name, sector: h.sector, currentPrice: h.currentPrice, ...staticN };
      return generateFallbackNarrative(sym, h.name, h.sector, h.currentPrice);
    });
  }, [holdings, aiNarratives]);

  const filtered = narratives.filter(n =>
    n.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const active = selectedSymbol ? narratives.find(n => n.symbol === selectedSymbol) : null;
  const sentimentColor = (s: string) =>
    s === 'Bullish' ? 'text-emerald-500 bg-emerald-500/10' :
    s === 'Bearish' ? 'text-red-500 bg-red-500/10' :
    'text-blue-500 bg-blue-500/10';

  const generateAINarrative = useCallback(async (symbol: string) => {
    const holding = holdings.find(h => h.symbol?.replace('.US', '').toUpperCase() === symbol);
    if (!holding) return;

    setLoadingSymbol(symbol);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights', {
        body: {
          action: 'narrative_analysis',
          payload: {
            symbol,
            name: holding.name,
            sector: holding.sector,
            price: holding.currentPrice,
            dividendYield: holding.dividendYield,
            peRatio: null,
          },
        },
      });

      if (error) throw error;

      const result = data?.result;
      if (result && result.overallSentiment && result.summary) {
        const narrative: NarrativeData = {
          symbol,
          name: holding.name,
          sector: holding.sector,
          currentPrice: holding.currentPrice,
          overallSentiment: result.overallSentiment,
          summary: result.summary,
          risks: result.risks || [],
          rewards: result.rewards || [],
          recentDevelopments: result.recentDevelopments || [],
          analystConsensus: result.analystConsensus || '',
          keyMetrics: result.keyMetrics || [],
          isAI: true,
        };
        setAiNarratives(prev => ({ ...prev, [symbol]: narrative }));
        setCachedNarrative(symbol, narrative);
        toast.success(`AI narrative generated for ${symbol}`);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.warn('AI narrative failed:', err);
      toast.error(`Could not generate AI narrative for ${symbol}`);
    } finally {
      setLoadingSymbol(null);
    }
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No Holdings Found</h3>
        <p className="text-muted-foreground">Add holdings to see narrative analysis</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Narrative Analysis
          </h2>
          <p className="text-muted-foreground">AI-powered risks, rewards & developments for your holdings</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search holdings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings list */}
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.map(n => (
            <Card
              key={n.symbol}
              className={`cursor-pointer hover:shadow-md transition-all ${selectedSymbol === n.symbol ? 'border-primary shadow-md' : ''}`}
              onClick={() => setSelectedSymbol(n.symbol)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{n.symbol}</span>
                      <Badge className={sentimentColor(n.overallSentiment)} variant="outline">{n.overallSentiment}</Badge>
                      {n.isAI && <Sparkles className="w-3 h-3 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{n.name}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail view */}
        <div className="lg:col-span-2">
          {active ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-xl">{active.symbol}</span>
                      <span className="text-muted-foreground font-normal text-base">— {active.name}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={sentimentColor(active.overallSentiment)}>{active.overallSentiment}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAINarrative(active.symbol)}
                        disabled={loadingSymbol === active.symbol}
                      >
                        {loadingSymbol === active.symbol ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-1" />
                        )}
                        {active.isAI ? 'Refresh AI' : 'Generate AI'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{active.summary}</p>
                  {active.analystConsensus && (
                    <p className="text-xs text-muted-foreground mt-2">{active.analystConsensus}</p>
                  )}
                  {active.isAI && (
                    <Badge variant="outline" className="mt-2 text-xs text-primary border-primary/30">
                      <Sparkles className="w-3 h-3 mr-1" /> AI Generated
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {/* Key Metrics */}
              {active.keyMetrics.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {active.keyMetrics.map(m => (
                    <Card key={m.label}>
                      <CardContent className="py-3 text-center">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="font-bold flex items-center justify-center gap-1">
                          {m.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                          {m.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                          {m.value}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Risks & Rewards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-red-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-red-500">
                      <AlertTriangle className="w-4 h-4" /> Key Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {active.risks.map((r, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-red-400 mt-1">•</span>{r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="border-emerald-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-emerald-500">
                      <ShieldCheck className="w-4 h-4" /> Key Rewards
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {active.rewards.map((r, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-emerald-400 mt-1">•</span>{r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Developments */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-primary" /> Recent Developments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {active.recentDevelopments.map((d, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <Star className="w-3 h-3 text-primary mt-1 shrink-0" />{d}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>Select a holding to view its narrative analysis</p>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default NarrativeAnalysis;
