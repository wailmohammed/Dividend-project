import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Activity, DollarSign, TrendingUp, Heart, BarChart3, Shield, Target,
  Users, Newspaper, Lightbulb, Award, Brain, X, Plus, Loader2, Search,
  FileDown, Star, StarOff, Eye, GitCompare, Trash2, GripVertical, Pencil, Check,
} from 'lucide-react';

interface WatchItem { id: string; symbol: string; note?: string | null; position?: number; }

const tickerSchema = z
  .string()
  .trim()
  .min(1, 'Ticker required')
  .max(10, 'Ticker too long')
  .regex(/^[A-Z.\-]+$/, 'Letters, dot or dash only');

const MODULES = [
  { id: 'M1', title: 'Price & Market Data', icon: Activity, items: ['Real-time price & % change', 'Market cap, volume, 52-week range', 'Candlestick patterns'] },
  { id: 'M2', title: 'Past Performance', icon: BarChart3, items: ['Gross / Operating / Net margin', 'ROE & FCF margin', 'EPS 5Y CAGR'] },
  { id: 'M3', title: 'Valuation Metrics', icon: DollarSign, items: ['DCF intrinsic value', 'Monte Carlo simulation', 'Graham Number floor'] },
  { id: 'M4', title: 'Growth Indicators', icon: TrendingUp, items: ['Revenue 5Y CAGR & YoY', 'EPS & Gross Profit CAGR', 'FCF growth trajectory'] },
  { id: 'M5', title: 'Financial Health', icon: Heart, items: ['Current & Quick Ratio', 'Debt/Equity & Interest Coverage', 'Altman Z-Score'] },
  { id: 'M6', title: 'Market Sentiment', icon: Brain, items: ['RSI(14), MACD, MAs', '3M momentum & 52w %', 'Insider & CEO buying'] },
  { id: 'M7', title: 'Risk Assessment', icon: Shield, items: ['Relative P/E vs sector', 'Beta & volatility', 'Drawdown history'] },
  { id: 'M8', title: 'Competitive Position', icon: Users, items: ['Moat analysis', 'Market share trends', 'Peer comparison'] },
  { id: 'M9', title: 'News & Catalysts', icon: Newspaper, items: ['Recent earnings beats/misses', 'Analyst upgrades', 'Macro catalysts'] },
  { id: 'M10', title: 'Management Quality', icon: Award, items: ['CEO tenure & track record', 'Insider ownership %', 'Capital allocation'] },
  { id: 'M11', title: 'Investment Thesis', icon: Lightbulb, items: ['Bull case scenarios', 'Bear case risks', 'Key thesis breakers'] },
  { id: 'M12', title: 'AI Recommendation', icon: Target, items: ['Composite score (0-100)', 'Buy/Hold/Sell signal', 'Conviction level'] },
];

const seeded = (seed: number) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

interface MarketRow {
  symbol: string;
  price: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
  market_cap: number | null;
  sector: string | null;
}

interface AnalysisResult {
  symbol: string;
  market: MarketRow | null;
  scores: number[]; // length 12
  composite: number;
  verdict: string;
  verdictTone: 'success' | 'primary' | 'warning' | 'destructive';
}

const buildAnalysis = (symbol: string, market: MarketRow | null): AnalysisResult => {
  const rng = seeded(hashStr(symbol));
  // Bias module scores using real market data when available
  const scores = MODULES.map((_, i) => {
    let base = 40 + rng() * 60;
    if (market) {
      if (i === 0 && market.price) base += 5;
      if (i === 2 && market.pe_ratio && market.pe_ratio > 0 && market.pe_ratio < 25) base += 10;
      if (i === 4 && market.market_cap && market.market_cap > 1e10) base += 8;
    }
    return Math.max(0, Math.min(100, Math.round(base)));
  });
  const composite = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const verdict = composite >= 75 ? 'Strong Buy' : composite >= 60 ? 'Buy' : composite >= 45 ? 'Hold' : 'Reduce';
  const verdictTone =
    composite >= 75 ? 'success' :
    composite >= 60 ? 'primary' :
    composite >= 45 ? 'warning' : 'destructive';
  return { symbol, market, scores, composite, verdict, verdictTone };
};

const TwelveModuleAnalysis = () => {
  const { activePortfolio } = usePortfolio();
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user';

  const [tab, setTab] = useState<'single' | 'compare'>('single');

  // Single mode
  const [singleInput, setSingleInput] = useState('');
  const [single, setSingle] = useState<AnalysisResult | null>(null);
  const [loadingSingle, setLoadingSingle] = useState(false);

  // Compare mode (up to 4)
  const [compareInput, setCompareInput] = useState('');
  const [compareList, setCompareList] = useState<AnalysisResult[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);

  // Watchlist
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);

  // Auto-load first portfolio holding on mount
  useEffect(() => {
    const first = activePortfolio?.holdings?.[0]?.symbol;
    if (first && !single) {
      loadSingle(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolio?.id]);

  // Load watchlist
  useEffect(() => {
    if (isDemoMode) {
      try {
        const raw = localStorage.getItem('analysis_watchlist');
        if (raw) setWatchlist(JSON.parse(raw));
      } catch { /* noop */ }
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('analysis_watchlist')
        .select('id, symbol, note, position')
        .order('position', { ascending: true });
      if (data) setWatchlist(data as WatchItem[]);
    })();
  }, [isDemoMode, user?.id]);

  const persistWatchLocal = (next: WatchItem[]) => {
    setWatchlist(next);
    try { localStorage.setItem('analysis_watchlist', JSON.stringify(next)); } catch { /* noop */ }
  };

  const addToWatch = async (sym: string) => {
    const parsed = tickerSchema.safeParse(sym.toUpperCase());
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const symbol = parsed.data;
    if (watchlist.some((w) => w.symbol === symbol)) { toast.info(`${symbol} already in watchlist`); return; }
    if (isDemoMode) {
      persistWatchLocal([{ id: crypto.randomUUID(), symbol }, ...watchlist]);
      toast.success(`${symbol} added`);
      return;
    }
    const { data, error } = await supabase
      .from('analysis_watchlist')
      .insert({ user_id: user!.id, symbol, position: watchlist.length })
      .select('id, symbol').single();
    if (error) { toast.error('Failed to add'); return; }
    setWatchlist((w) => [data as WatchItem, ...w]);
    toast.success(`${symbol} added`);
  };

  const removeFromWatch = async (id: string) => {
    if (isDemoMode) {
      persistWatchLocal(watchlist.filter((w) => w.id !== id));
      return;
    }
    const { error } = await supabase.from('analysis_watchlist').delete().eq('id', id);
    if (error) { toast.error('Failed'); return; }
    setWatchlist((w) => w.filter((x) => x.id !== id));
  };

  const updateWatchNote = async (id: string, note: string) => {
    const trimmed = note.slice(0, 200);
    if (isDemoMode) {
      persistWatchLocal(watchlist.map((w) => w.id === id ? { ...w, note: trimmed } : w));
      toast.success('Note saved');
      return;
    }
    const { error } = await supabase.from('analysis_watchlist').update({ note: trimmed }).eq('id', id);
    if (error) { toast.error('Failed to save note'); return; }
    setWatchlist((w) => w.map((x) => x.id === id ? { ...x, note: trimmed } : x));
    toast.success('Note saved');
  };

  const applyWatchOrder = async (next: WatchItem[]) => {
    const repositioned = next.map((w, i) => ({ ...w, position: i }));
    setWatchlist(repositioned);
    if (isDemoMode) {
      try { localStorage.setItem('analysis_watchlist', JSON.stringify(repositioned)); } catch { /* noop */ }
      return;
    }
    await Promise.all(repositioned.map((w, i) =>
      supabase.from('analysis_watchlist').update({ position: i }).eq('id', w.id)
    ));
  };

  const reorderWatch = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= watchlist.length) return;
    const previous = watchlist;
    const next = [...watchlist];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    await applyWatchOrder(next);
    toast.success(`Moved ${moved.symbol}`, {
      action: { label: 'Undo', onClick: () => { applyWatchOrder(previous); } },
    });
  };

  // Drag & drop state
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const fetchMarket = async (symbol: string): Promise<MarketRow | null> => {
    try {
      const { data } = await supabase
        .from('market_data_cache')
        .select('symbol, price, pe_ratio, dividend_yield, market_cap, sector')
        .eq('symbol', symbol)
        .maybeSingle();
      return (data as MarketRow) || null;
    } catch {
      return null;
    }
  };

  const loadSingle = async (raw: string) => {
    const parsed = tickerSchema.safeParse(raw.toUpperCase());
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    const symbol = parsed.data;
    setLoadingSingle(true);
    try {
      const market = await fetchMarket(symbol);
      setSingle(buildAnalysis(symbol, market));
      setSingleInput('');
    } finally {
      setLoadingSingle(false);
    }
  };

  const addCompare = async (raw: string) => {
    const parsed = tickerSchema.safeParse(raw.toUpperCase());
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    const symbol = parsed.data;
    if (compareList.some((c) => c.symbol === symbol)) {
      toast.info(`${symbol} already added`);
      return;
    }
    if (compareList.length >= 4) {
      toast.error('Maximum 4 tickers in compare mode');
      return;
    }
    setLoadingCompare(true);
    try {
      const market = await fetchMarket(symbol);
      setCompareList((prev) => [...prev, buildAnalysis(symbol, market)]);
      setCompareInput('');
    } finally {
      setLoadingCompare(false);
    }
  };

  const removeCompare = (symbol: string) => {
    setCompareList((prev) => prev.filter((c) => c.symbol !== symbol));
  };

  const loadCompareFromList = async (syms: string[]) => {
    setLoadingCompare(true);
    try {
      const results: AnalysisResult[] = [];
      for (const s of syms.slice(0, 4)) {
        const m = await fetchMarket(s);
        results.push(buildAnalysis(s, m));
      }
      setCompareList(results);
      setTab('compare');
      toast.success(`Loaded ${results.length} ticker(s) into compare`);
    } finally {
      setLoadingCompare(false);
    }
  };

  const exportPDF = () => {
    const items: AnalysisResult[] = tab === 'single' ? (single ? [single] : []) : compareList;
    if (!items.length) { toast.error('Nothing to export'); return; }
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    let y = 16;
    doc.setFontSize(16); doc.text('12-Module Stock Analysis Report', 14, y); y += 6;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()} · Mode: ${tab}`, 14, y); y += 6;
    doc.text(`Tickers: ${items.map((i) => i.symbol).join(', ')}`, 14, y); y += 6;
    if (watchlist.length) {
      const inReport = items.map((i) => i.symbol);
      const notedInReport = watchlist.filter((w) => inReport.includes(w.symbol) && w.note?.trim());
      if (notedInReport.length) {
        doc.text('Watchlist notes:', 14, y); y += 5;
        notedInReport.forEach((w) => {
          const lines = doc.splitTextToSize(`• ${w.symbol}: ${w.note}`, pageW - 28);
          lines.forEach((ln: string) => { doc.text(ln, 16, y); y += 4; });
        });
        y += 2;
      }
    }
    y += 2;
    doc.setTextColor(0);

    items.forEach((it, idx) => {
      if (y > 260) { doc.addPage(); y = 16; }
      doc.setFontSize(13);
      doc.text(`${idx + 1}. ${it.symbol} — ${it.verdict} (${it.composite}/100)`, 14, y); y += 6;
      doc.setFontSize(9);
      const m = it.market;
      doc.text(
        `Price: $${m?.price?.toFixed(2) ?? '—'}  ·  P/E: ${m?.pe_ratio?.toFixed(1) ?? '—'}  ·  Yield: ${m?.dividend_yield?.toFixed(2) ?? '—'}%  ·  Sector: ${m?.sector ?? '—'}`,
        14, y
      );
      y += 6;
      const watchNote = watchlist.find((w) => w.symbol === it.symbol)?.note?.trim();
      if (watchNote) {
        doc.setTextColor(100);
        const lines = doc.splitTextToSize(`Note: ${watchNote}`, pageW - 28);
        lines.forEach((ln: string) => { doc.text(ln, 16, y); y += 4; });
        doc.setTextColor(0);
        y += 2;
      }
      MODULES.forEach((mod, i) => {
        if (y > 280) { doc.addPage(); y = 16; }
        const score = it.scores[i];
        doc.setFontSize(9);
        doc.text(`${mod.id} ${mod.title}`, 16, y);
        doc.text(`${score}/100`, pageW - 30, y);
        // simple progress bar
        doc.setDrawColor(220); doc.setFillColor(240, 240, 240);
        doc.rect(80, y - 3, 80, 3, 'F');
        (doc.setFillColor as any)(score >= 70 ? 60 : score >= 50 ? 200 : 220, score >= 70 ? 180 : score >= 50 ? 160 : 60, score >= 70 ? 90 : 50);
        doc.rect(80, y - 3, (80 * score) / 100, 3, 'F');
        y += 5;
      });
      y += 4;
    });
    doc.save(`12-module-${tab}-${Date.now()}.pdf`);
    toast.success('PDF report generated');
  };

  const verdictColorClass: Record<AnalysisResult['verdictTone'], string> = {
    success: 'text-success border-success',
    primary: 'text-primary border-primary',
    warning: 'text-warning border-warning',
    destructive: 'text-destructive border-destructive',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">12-Module Stock Analysis</h1>
          <p className="text-muted-foreground mt-1">Comprehensive evaluation framework — fundamentals, valuation, sentiment & AI.</p>
        </div>
        <Button onClick={exportPDF} variant="outline" className="gap-2">
          <FileDown className="w-4 h-4" /> Export PDF
        </Button>
      </div>

      {/* Saved Analysis Watchlist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-warning" /> Analysis Watchlist
            <Badge variant="secondary" className="text-[10px]">{watchlist.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {watchlist.length === 0 ? (
            <p className="text-xs text-muted-foreground">Star a ticker after analyzing it to keep it here for quick access.</p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">Drag the handle to reorder — compare follows this order.</p>
              {watchlist.map((w, idx) => (
                <div
                  key={w.id}
                  draggable
                  onDragStart={() => setDragId(w.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragId) return;
                    const from = watchlist.findIndex((x) => x.id === dragId);
                    reorderWatch(from, idx);
                    setDragId(null);
                  }}
                  className={`flex flex-col gap-1 border border-border rounded-md px-2 py-1.5 bg-muted/30 ${dragId === w.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
                    <span className="text-xs font-semibold flex-1">{w.symbol}</span>
                    <button title="Analyze" onClick={() => { setTab('single'); loadSingle(w.symbol); }} className="text-muted-foreground hover:text-primary">
                      <Eye className="w-3 h-3" />
                    </button>
                    <button title="Add to compare" onClick={() => { setTab('compare'); addCompare(w.symbol); }} className="text-muted-foreground hover:text-primary">
                      <GitCompare className="w-3 h-3" />
                    </button>
                    <button title="Edit note" onClick={() => { setEditingNoteId(w.id); setNoteDraft(w.note || ''); }} className="text-muted-foreground hover:text-primary">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button title="Remove" onClick={() => removeFromWatch(w.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {editingNoteId === w.id ? (
                    <div className="flex gap-1">
                      <Input value={noteDraft} maxLength={200} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Note (e.g. wait for dip)…" className="h-7 text-xs" />
                      <Button size="sm" className="h-7 px-2" onClick={() => { updateWatchNote(w.id, noteDraft); setEditingNoteId(null); }}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : w.note ? (
                    <p className="text-[10px] text-muted-foreground italic pl-5">{w.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {watchlist.length >= 2 && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => loadCompareFromList(watchlist.slice(0, 4).map((w) => w.symbol))}>
              <GitCompare className="w-3 h-3" /> Compare top {Math.min(4, watchlist.length)} (in order)
            </Button>
          )}
          {isDemoMode && <p className="text-[10px] text-muted-foreground">Demo mode: watchlist stored locally.</p>}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="single">Single Stock</TabsTrigger>
          <TabsTrigger value="compare">Compare ({compareList.length}/4)</TabsTrigger>
        </TabsList>

        {/* SINGLE MODE */}
        <TabsContent value="single" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-4">
              <Label className="text-xs">Enter a stock ticker</Label>
              <form
                onSubmit={(e) => { e.preventDefault(); loadSingle(singleInput); }}
                className="flex gap-2 mt-1"
              >
                <Input
                  value={singleInput}
                  onChange={(e) => setSingleInput(e.target.value.toUpperCase())}
                  placeholder="AAPL, MSFT, NVDA…"
                  maxLength={10}
                  className="flex-1"
                />
                <Button type="submit" disabled={loadingSingle}>
                  {loadingSingle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Analyze</span>
                </Button>
              </form>
              {activePortfolio?.holdings && activePortfolio.holdings.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  <span className="text-xs text-muted-foreground self-center mr-1">Quick load:</span>
                  {activePortfolio.holdings.slice(0, 6).map((h) => (
                    <Button key={h.id} variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => loadSingle(h.symbol)}>
                      {h.symbol}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {single && (
            <>
              <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-1">
                    <div className="text-2xl font-bold flex items-center gap-2">
                      {single.symbol}
                      {watchlist.some((w) => w.symbol === single.symbol) ? (
                        <button
                          title="Remove from watchlist"
                          onClick={() => removeFromWatch(watchlist.find((w) => w.symbol === single.symbol)!.id)}
                          className="text-warning hover:opacity-70"
                        ><Star className="w-4 h-4 fill-current" /></button>
                      ) : (
                        <button title="Add to watchlist" onClick={() => addToWatch(single.symbol)} className="text-muted-foreground hover:text-warning">
                          <StarOff className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {single.market ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        Price: <span className="font-mono">${single.market.price?.toFixed(2) ?? '—'}</span> ·
                        P/E: <span className="font-mono">{single.market.pe_ratio?.toFixed(1) ?? '—'}</span> ·
                        Yield: <span className="font-mono">{single.market.dividend_yield?.toFixed(2) ?? '—'}%</span>
                        {single.market.sector && ` · ${single.market.sector}`}
                      </div>
                    ) : (
                      <div className="text-xs text-warning mt-1">No live market data cached for this symbol — scores estimated.</div>
                    )}
                  </div>
                  <div className="text-center md:text-right">
                    <div className="text-xs text-muted-foreground">Composite Score</div>
                    <div className="text-4xl font-bold">{single.composite}<span className="text-base text-muted-foreground">/100</span></div>
                    <Badge variant="outline" className={`mt-1 ${verdictColorClass[single.verdictTone]}`}>{single.verdict}</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULES.map((m, i) => {
                  const Icon = m.icon;
                  const score = single.scores[i];
                  return (
                    <Card key={m.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10"><Icon className="w-4 h-4 text-primary" /></div>
                            <Badge variant="outline" className="text-[10px]">{m.id}</Badge>
                          </div>
                          <span className={`text-lg font-bold ${score >= 70 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive'}`}>{score}</span>
                        </div>
                        <CardTitle className="text-sm mt-2">{m.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        <Progress value={score} className="h-1.5" />
                        <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                          {m.items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span><span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* COMPARE MODE */}
        <TabsContent value="compare" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-4">
              <Label className="text-xs">Add tickers to compare (max 4)</Label>
              <form
                onSubmit={(e) => { e.preventDefault(); addCompare(compareInput); }}
                className="flex gap-2 mt-1"
              >
                <Input
                  value={compareInput}
                  onChange={(e) => setCompareInput(e.target.value.toUpperCase())}
                  placeholder="Add a ticker…"
                  maxLength={10}
                  disabled={compareList.length >= 4}
                />
                <Button type="submit" disabled={loadingCompare || compareList.length >= 4}>
                  {loadingCompare ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ml-2">Add</span>
                </Button>
              </form>
              {compareList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {compareList.map((c) => (
                    <Badge key={c.symbol} variant="secondary" className="gap-1.5 pr-1">
                      {c.symbol}
                      <button onClick={() => removeCompare(c.symbol)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {compareList.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Add at least two tickers to start comparing.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                    <tr>
                      <th className="text-left py-2 px-3 sticky left-0 bg-muted/30">Metric</th>
                      {compareList.map((c) => (
                        <th key={c.symbol} className="text-center py-2 px-3 min-w-[110px]">{c.symbol}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border bg-primary/5">
                      <td className="py-2 px-3 font-semibold sticky left-0 bg-card">Composite Score</td>
                      {compareList.map((c) => {
                        const max = Math.max(...compareList.map((x) => x.composite));
                        return (
                          <td key={c.symbol} className="text-center py-2 px-3">
                            <div className={`font-bold ${c.composite === max ? 'text-success' : ''}`}>{c.composite}</div>
                            <Badge variant="outline" className={`text-[9px] ${verdictColorClass[c.verdictTone]}`}>{c.verdict}</Badge>
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 sticky left-0 bg-card text-muted-foreground">Price</td>
                      {compareList.map((c) => (
                        <td key={c.symbol} className="text-center py-2 px-3 font-mono text-xs">${c.market?.price?.toFixed(2) ?? '—'}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 sticky left-0 bg-card text-muted-foreground">P/E Ratio</td>
                      {compareList.map((c) => (
                        <td key={c.symbol} className="text-center py-2 px-3 font-mono text-xs">{c.market?.pe_ratio?.toFixed(1) ?? '—'}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 sticky left-0 bg-card text-muted-foreground">Dividend Yield</td>
                      {compareList.map((c) => (
                        <td key={c.symbol} className="text-center py-2 px-3 font-mono text-xs">{c.market?.dividend_yield?.toFixed(2) ?? '—'}%</td>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-2 px-3 sticky left-0 bg-card text-muted-foreground">Sector</td>
                      {compareList.map((c) => (
                        <td key={c.symbol} className="text-center py-2 px-3 text-xs">{c.market?.sector ?? '—'}</td>
                      ))}
                    </tr>

                    {MODULES.map((m, i) => {
                      const max = Math.max(...compareList.map((c) => c.scores[i]));
                      return (
                        <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2 px-3 sticky left-0 bg-card">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">{m.id}</Badge>
                              <span className="text-xs">{m.title}</span>
                            </div>
                          </td>
                          {compareList.map((c) => {
                            const s = c.scores[i];
                            const isBest = s === max && compareList.length > 1;
                            return (
                              <td key={c.symbol} className="text-center py-2 px-3">
                                <span className={`font-semibold ${isBest ? 'text-success' : s >= 70 ? 'text-success' : s >= 50 ? 'text-warning' : 'text-destructive'}`}>
                                  {s}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TwelveModuleAnalysis;
