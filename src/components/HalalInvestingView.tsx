import React, { useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useHalalStocks } from '@/hooks/useHalalStocks';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Search, AlertTriangle, CheckCircle2,
  XCircle, Info, TrendingUp, TrendingDown, DollarSign, Building2, Zap, Heart, BookOpen,
  Calculator, ArrowUpRight, ArrowDownRight, Moon, Sparkles, Bell, BellRing,
  ArrowLeft, ArrowUpDown, ChevronRight, Eye, RefreshCw, Loader2, Database, Star, Flame
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const AAOIFI_THRESHOLDS = {
  debtToMarketCap: 0.30,
  cashToMarketCap: 0.30,
  receivablesToMarketCap: 0.49,
  nonPermissibleIncome: 0.05,
};

type ComplianceGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

interface HalalStock {
  symbol: string;
  name: string;
  grade: ComplianceGrade;
  price: number;
  change: number;
  dividendYield: number;
  marketCap: string;
  sector: string;
  peRatio: number;
  debtToMarketCap?: number | null;
  cashToMarketCap?: number | null;
  receivablesToMarketCap?: number | null;
  nonPermissibleRevenuePct?: number;
  businessScreenPassed?: boolean;
  financialScreenPassed?: boolean;
  overallCompliant?: boolean;
  purificationPerShare?: number;
  screeningNotes?: string | null;
  screenedAt?: string;
}

// --- Musaffa/Zoya-Inspired Badge Components ---

const ComplianceBadge = ({ compliant, grade }: { compliant?: boolean; grade?: string }) => {
  if (compliant === true || (grade && (grade.startsWith('A') || grade.startsWith('B')))) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 text-xs border font-semibold">
        <ShieldCheck className="w-3 h-3" />
        Halal
      </Badge>
    );
  }
  if (grade === 'C' || grade === 'C+' || grade === 'C-') {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 text-xs border font-semibold">
        <ShieldAlert className="w-3 h-3" />
        Doubtful
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 gap-1.5 text-xs border font-semibold">
      <ShieldX className="w-3 h-3" />
      Not Halal
    </Badge>
  );
};

const GradeBadge = ({ grade }: { grade: ComplianceGrade | string }) => {
  const color = grade.startsWith('A') ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 ring-emerald-500/20'
    : grade.startsWith('B') ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 ring-blue-500/20'
    : grade.startsWith('C') ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 ring-amber-500/20'
    : 'text-red-600 dark:text-red-400 bg-red-500/10 ring-red-500/20';
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl font-black text-sm ring-1 ${color}`}>
      {grade}
    </span>
  );
};

const RatioBar = ({ label, value, threshold, unit = '%' }: { label: string; value: number; threshold: number; unit?: string }) => {
  const pct = (value / threshold) * 100;
  const passed = value < threshold;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={`font-bold ${passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {(value * 100).toFixed(1)}{unit} / {(threshold * 100).toFixed(0)}{unit}
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${passed ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};

const THEME_PRESETS = [
  { id: 'all', label: 'All Stocks', icon: '📊' },
  { id: 'compliant', label: 'Halal Only', icon: '✅' },
  { id: 'strong', label: 'Grade A', icon: '💪' },
  { id: 'dividend', label: 'Dividend', icon: '💰' },
  { id: 'largecap', label: 'Large Cap', icon: '🏛️' },
  { id: 'redflags', label: 'Red Flags', icon: '🚩' },
];

// Musaffa-style "Pureness" donut
const PurenessRing = ({ percentage }: { percentage: number }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground">{percentage.toFixed(0)}%</span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Halal</span>
      </div>
    </div>
  );
};

const HalalInvestingView: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const {
    allHalalStocks, collections: HALAL_COLLECTIONS, loading: halalLoading,
    screening, screeningProgress, runScreening, screenSymbols, hasData, stats: dbStats
  } = useHalalStocks();

  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showAllStocks, setShowAllStocks] = useState(false);
  const [discoverSortBy, setDiscoverSortBy] = useState<'grade' | 'price' | 'yield' | 'pe'>('grade');
  const [discoverSortDir, setDiscoverSortDir] = useState<'asc' | 'desc'>('desc');
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [detailStock, setDetailStock] = useState<HalalStock | null>(null);
  const [activeTheme, setActiveTheme] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState<string>('all');
  const [zakatGoldPrice, setZakatGoldPrice] = useState(2300);
  const [zakatNisabGrams] = useState(85);

  // Portfolio compliance stats
  const portfolioScreening = useMemo(() => {
    if (holdings.length === 0) return null;
    
    const results = holdings.map(h => {
      const dbStock = allHalalStocks.find(s => s.symbol === h.symbol);
      return {
        symbol: h.symbol,
        name: h.name,
        shares: h.shares,
        currentPrice: h.currentPrice,
        value: h.shares * h.currentPrice,
        found: !!dbStock,
        compliant: dbStock?.overallCompliant ?? null,
        grade: dbStock?.grade || null,
        purificationPerShare: dbStock?.purificationPerShare || 0,
        businessScreenPassed: dbStock?.businessScreenPassed ?? null,
        financialScreenPassed: dbStock?.financialScreenPassed ?? null,
        debtToMarketCap: dbStock?.debtToMarketCap ?? null,
        cashToMarketCap: dbStock?.cashToMarketCap ?? null,
        receivablesToMarketCap: dbStock?.receivablesToMarketCap ?? null,
        nonPermissibleRevenuePct: dbStock?.nonPermissibleRevenuePct ?? 0,
        screeningNotes: dbStock?.screeningNotes || null,
      };
    });
    
    const totalValue = results.reduce((s, r) => s + r.value, 0);
    const halalValue = results.filter(r => r.compliant === true).reduce((s, r) => s + r.value, 0);
    const halal = results.filter(r => r.compliant === true).length;
    const notHalal = results.filter(r => r.compliant === false).length;
    const unscreened = results.filter(r => r.compliant === null).length;
    const complianceRate = totalValue > 0 ? (halalValue / totalValue) * 100 : 0;
    const purificationTotal = results.reduce((s, r) => s + (r.purificationPerShare * r.shares), 0);

    return { results, totalValue, halalValue, halal, notHalal, unscreened, complianceRate, purificationTotal, total: results.length };
  }, [holdings, allHalalStocks]);

  const pieData = portfolioScreening ? [
    { name: 'Halal', value: portfolioScreening.halal, color: '#10b981' },
    { name: 'Not Halal', value: portfolioScreening.notHalal, color: '#ef4444' },
    { name: 'Unscreened', value: portfolioScreening.unscreened, color: '#64748b' },
  ].filter(d => d.value > 0) : [];

  // Halal alternatives for non-compliant holdings
  const alternativesForHolding = (sector: string | null, symbol: string) => {
    return allHalalStocks
      .filter(s => s.overallCompliant && s.symbol !== symbol && (sector ? s.sector === sector : true))
      .sort((a, b) => {
        const gradeOrder: Record<string, number> = { 'A+': 10, A: 9, 'A-': 8, 'B+': 7, B: 6, 'B-': 5 };
        return (gradeOrder[b.grade] || 0) - (gradeOrder[a.grade] || 0);
      })
      .slice(0, 3);
  };

  // Trending stocks (derived from DB data)
  const trendingStocks = useMemo(() => {
    if (!hasData) return { topRated: [], highYield: [], lowPE: [] };
    const compliant = allHalalStocks.filter(s => s.overallCompliant);
    return {
      topRated: compliant.filter(s => s.grade.startsWith('A')).slice(0, 6),
      highYield: [...compliant].sort((a, b) => b.dividendYield - a.dividendYield).filter(s => s.dividendYield > 0).slice(0, 6),
      lowPE: [...compliant].sort((a, b) => (a.peRatio || 999) - (b.peRatio || 999)).filter(s => s.peRatio > 0).slice(0, 6),
    };
  }, [allHalalStocks, hasData]);

  // Zakat calculation
  const zakatCalc = useMemo(() => {
    if (!portfolioScreening) return null;
    const nisabValue = zakatNisabGrams * zakatGoldPrice / 31.1035; // troy oz
    const totalPortfolioValue = portfolioScreening.totalValue;
    const halalValue = portfolioScreening.halalValue;
    const isAboveNisab = totalPortfolioValue >= nisabValue;
    const zakatDue = isAboveNisab ? halalValue * 0.025 : 0;
    return { nisabValue, totalPortfolioValue, halalValue, isAboveNisab, zakatDue };
  }, [portfolioScreening, zakatGoldPrice, zakatNisabGrams]);

  // Filter discover stocks
  const themedStocks = useMemo(() => {
    let stocks = allHalalStocks;
    switch (activeTheme) {
      case 'compliant': stocks = stocks.filter(s => s.overallCompliant); break;
      case 'strong': stocks = stocks.filter(s => s.grade.startsWith('A')); break;
      case 'dividend': stocks = stocks.filter(s => s.dividendYield > 0); break;
      case 'largecap': stocks = stocks.filter(s => s.marketCap.includes('B') || s.marketCap.includes('T')); break;
      case 'redflags': stocks = stocks.filter(s => s.grade === 'D' || s.grade === 'F' || !s.overallCompliant); break;
    }
    if (complianceFilter !== 'all') {
      if (complianceFilter === 'compliant') stocks = stocks.filter(s => s.overallCompliant);
      if (complianceFilter === 'non-compliant') stocks = stocks.filter(s => !s.overallCompliant);
    }
    return stocks;
  }, [allHalalStocks, activeTheme, complianceFilter]);

  return (
    <div className="space-y-6">
      {/* Header — Musaffa/Zoya premium style */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 sm:p-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-300 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 backdrop-blur-sm rounded-2xl">
              <Moon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Shariah Compliance Center</h1>
              <p className="text-sm text-emerald-100/80 mt-1">AAOIFI Standard No. 21 · AI-Powered Screening & Purification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/15 text-white border-white/20 gap-1.5 text-xs backdrop-blur-sm">
              <BookOpen className="w-3 h-3" />
              AAOIFI Certified
            </Badge>
            {hasData && (
              <Badge className="bg-white/15 text-white border-white/20 gap-1.5 text-xs backdrop-blur-sm">
                <Database className="w-3 h-3" />
                {allHalalStocks.length} Stocks
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="discover" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border h-11">
          <TabsTrigger value="discover" className="gap-1.5"><Search className="w-3.5 h-3.5" />Discover</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1.5"><Shield className="w-3.5 h-3.5" />Portfolio</TabsTrigger>
          <TabsTrigger value="purification" className="gap-1.5"><Heart className="w-3.5 h-3.5" />Purification</TabsTrigger>
          <TabsTrigger value="zakat" className="gap-1.5"><Calculator className="w-3.5 h-3.5" />Zakat</TabsTrigger>
          <TabsTrigger value="methodology" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" />Method</TabsTrigger>
        </TabsList>

        {/* =================== TAB 1: DISCOVER =================== */}
        <TabsContent value="discover" className="space-y-6">
          {(selectedCollection || showAllStocks) ? (() => {
            const collection = selectedCollection ? HALAL_COLLECTIONS.find(c => c.name === selectedCollection) : null;
            const sourceStocks = showAllStocks ? themedStocks : (collection?.stocks || []);
            const gradeOrder: Record<string, number> = { 'A+': 10, 'A': 9, 'A-': 8, 'B+': 7, 'B': 6, 'B-': 5, 'C+': 4, 'C': 3, 'C-': 2, 'D': 1, 'F': 0 };
            const filteredStocks = sourceStocks
              .filter(s =>
                !discoverSearch ||
                s.symbol.toLowerCase().includes(discoverSearch.toLowerCase()) ||
                s.name.toLowerCase().includes(discoverSearch.toLowerCase()) ||
                s.sector.toLowerCase().includes(discoverSearch.toLowerCase())
              )
              .sort((a, b) => {
                let diff = 0;
                switch (discoverSortBy) {
                  case 'grade': diff = (gradeOrder[a.grade] || 0) - (gradeOrder[b.grade] || 0); break;
                  case 'price': diff = a.price - b.price; break;
                  case 'yield': diff = a.dividendYield - b.dividendYield; break;
                  case 'pe': diff = a.peRatio - b.peRatio; break;
                }
                return discoverSortDir === 'desc' ? -diff : diff;
              });

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedCollection(null); setShowAllStocks(false); setDiscoverSearch(''); }} className="gap-1.5">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  {collection && <span className="text-2xl">{collection.icon}</span>}
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{showAllStocks ? 'Discover Halal Stocks' : collection?.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {showAllStocks ? `${allHalalStocks.length} screened companies` : `${collection?.count} stocks`}
                    </p>
                  </div>
                </div>

                {showAllStocks && (
                  <div className="flex flex-wrap gap-2">
                    {THEME_PRESETS.map(theme => (
                      <Button key={theme.id} variant={activeTheme === theme.id ? 'default' : 'outline'} size="sm"
                        className={`h-8 text-xs gap-1.5 ${activeTheme === theme.id ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                        onClick={() => setActiveTheme(theme.id)}>
                        <span>{theme.icon}</span>{theme.label}
                      </Button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search symbol, name, or sector..." value={discoverSearch} onChange={e => setDiscoverSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                  </div>
                  <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                    <SelectTrigger className="h-9 w-36 text-sm"><Shield className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="compliant">Halal</SelectItem>
                      <SelectItem value="non-compliant">Not Halal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={discoverSortBy} onValueChange={(v: any) => setDiscoverSortBy(v)}>
                    <SelectTrigger className="h-9 w-32 text-sm"><ArrowUpDown className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade">Grade</SelectItem>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="yield">Div Yield</SelectItem>
                      <SelectItem value="pe">P/E Ratio</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-9 px-3" onClick={() => setDiscoverSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                    {discoverSortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">{filteredStocks.length} of {allHalalStocks.length} stocks</p>

                <div className="space-y-2">
                  {filteredStocks.map(stock => (
                    <Card key={stock.symbol} className="hover:border-emerald-400/50 dark:hover:border-emerald-600/50 transition-all cursor-pointer group" onClick={() => setDetailStock(stock)}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GradeBadge grade={stock.grade} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{stock.symbol}</span>
                              <span className="text-xs text-muted-foreground truncate hidden sm:inline">{stock.name}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <ComplianceBadge compliant={stock.overallCompliant} grade={stock.grade} />
                              {stock.dividendYield > 0 && <Badge variant="outline" className="text-[10px] gap-1">💰 {stock.dividendYield.toFixed(2)}%</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                              <span>{stock.marketCap}</span>
                              <span>{stock.sector}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-foreground">${stock.price.toFixed(2)}</p>
                            {stock.peRatio > 0 && <p className="text-[11px] text-muted-foreground">P/E {stock.peRatio.toFixed(1)}</p>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {filteredStocks.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No stocks match your search.</p>}
              </div>
            );
          })() : (
            <>
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={runScreening} disabled={screening}>
                    {screening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {screening ? 'AI Screening...' : 'Run AI Screening'}
                  </Button>
                  {screening && screeningProgress && <span className="text-xs text-muted-foreground animate-pulse">{screeningProgress}</span>}
                </div>
                {hasData && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShowAllStocks(true); setDiscoverSearch(''); }}>
                    <Search className="w-4 h-4" />View All ({allHalalStocks.length})
                  </Button>
                )}
              </div>

              {/* Stats */}
              {hasData && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Halal</span>
                      </div>
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{dbStats.compliantCount}</div>
                      <p className="text-xs text-muted-foreground mt-1">Shariah-compliant</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-500/20 bg-red-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldX className="w-5 h-5 text-red-500" />
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Not Halal</span>
                      </div>
                      <div className="text-3xl font-black text-red-600 dark:text-red-400">{dbStats.nonCompliantCount}</div>
                      <p className="text-xs text-muted-foreground mt-1">Failed screening</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-semibold text-muted-foreground">Doubtful</span>
                      </div>
                      <div className="text-3xl font-black text-foreground">{dbStats.borderlineCount}</div>
                      <p className="text-xs text-muted-foreground mt-1">Needs review</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-5 h-5 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground">Total</span>
                      </div>
                      <div className="text-3xl font-black text-foreground">{dbStats.total}</div>
                      <p className="text-xs text-muted-foreground mt-1">AI-screened</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {halalLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
              ) : !hasData ? (
                <Card className="border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl mb-4"><Database className="w-12 h-12 text-emerald-500" /></div>
                    <h3 className="text-lg font-bold text-foreground mb-2">No Halal Stocks Screened Yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md">
                      Click "Run AI Screening" to analyze 70+ stocks against AAOIFI Standard No. 21.
                    </p>
                    <Button onClick={runScreening} disabled={screening} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {screening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {screening ? 'Screening...' : 'Start AI Screening'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Trending Halal Stocks — Musaffa style */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Flame className="w-5 h-5 text-orange-500" />
                        Trending Halal Stocks
                      </CardTitle>
                      <CardDescription>Top-performing Shariah-compliant stocks</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="topRated" className="space-y-4">
                        <TabsList className="h-8 bg-muted/30">
                          <TabsTrigger value="topRated" className="text-xs h-7 gap-1"><Star className="w-3 h-3" />Top Rated</TabsTrigger>
                          <TabsTrigger value="highYield" className="text-xs h-7 gap-1"><DollarSign className="w-3 h-3" />High Yield</TabsTrigger>
                          <TabsTrigger value="lowPE" className="text-xs h-7 gap-1"><TrendingDown className="w-3 h-3" />Low P/E</TabsTrigger>
                        </TabsList>
                        {(['topRated', 'highYield', 'lowPE'] as const).map(key => (
                          <TabsContent key={key} value={key}>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {trendingStocks[key].map(stock => (
                                <div key={stock.symbol}
                                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-emerald-400/50 hover:bg-emerald-500/5 transition-all cursor-pointer"
                                  onClick={() => setDetailStock(stock)}>
                                  <GradeBadge grade={stock.grade} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-sm text-foreground">{stock.symbol}</span>
                                      <ComplianceBadge compliant={stock.overallCompliant} grade={stock.grade} />
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate block">{stock.name}</span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-foreground">${stock.price.toFixed(2)}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {key === 'highYield' ? `${stock.dividendYield.toFixed(2)}% yield` :
                                       key === 'lowPE' ? `P/E ${stock.peRatio.toFixed(1)}` :
                                       stock.sector}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>

                  {/* Sector Collections */}
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      Halal Stock Collections
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {HALAL_COLLECTIONS.map(collection => (
                        <Card key={collection.name} className="hover:border-emerald-400/50 dark:hover:border-emerald-600/50 transition-all cursor-pointer group"
                          onClick={() => setSelectedCollection(collection.name)}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-2xl">{collection.icon}</span>
                              <Badge variant="secondary" className="text-xs font-bold">{collection.count}</Badge>
                            </div>
                            <h3 className="font-bold text-sm text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{collection.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {collection.stocks.slice(0, 4).map(s => (
                                <span key={s.symbol} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">{s.symbol}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-emerald-500 transition-colors">
                              View all <ChevronRight className="w-3 h-3" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* =================== TAB 2: PORTFOLIO SCREENING =================== */}
        <TabsContent value="portfolio" className="space-y-6">
          {!portfolioScreening || portfolioScreening.total === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-muted rounded-2xl mb-4"><Shield className="w-12 h-12 text-muted-foreground" /></div>
                <h3 className="text-lg font-bold text-foreground mb-2">No Holdings Found</h3>
                <p className="text-sm text-muted-foreground">Add holdings to your portfolio to screen them for Shariah compliance.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Screen unscreened holdings */}
              {portfolioScreening.unscreened > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{portfolioScreening.unscreened} holding{portfolioScreening.unscreened > 1 ? 's' : ''} not yet screened</p>
                    <p className="text-xs text-muted-foreground">AI will analyze Shariah compliance for your portfolio stocks.</p>
                  </div>
                  <Button size="sm" className="gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => { const syms = portfolioScreening.results.filter(r => !r.found).map(r => r.symbol); screenSymbols(syms); }}
                    disabled={screening}>
                    {screening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {screening ? 'Screening...' : 'Screen Now'}
                  </Button>
                </div>
              )}
              {screening && screeningProgress && <p className="text-xs text-muted-foreground animate-pulse text-center">{screeningProgress}</p>}

              {/* Pureness Ring + Stats — Musaffa style */}
              <div className="grid lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-1">
                  <CardContent className="p-6 flex flex-col items-center justify-center">
                    <PurenessRing percentage={portfolioScreening.complianceRate} />
                    <p className="text-xs text-muted-foreground mt-3 font-semibold">Portfolio Pureness</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Halal Holdings</span>
                    </div>
                    <div className="text-3xl font-black text-foreground">{portfolioScreening.halal}<span className="text-base text-muted-foreground font-normal">/{portfolioScreening.total}</span></div>
                    <p className="text-xs text-muted-foreground mt-1">${portfolioScreening.halalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} compliant</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <span className="text-xs font-semibold text-muted-foreground">Needs Review</span>
                    </div>
                    <div className="text-3xl font-black text-foreground">{portfolioScreening.notHalal + portfolioScreening.unscreened}</div>
                    <p className="text-xs text-muted-foreground mt-1">{portfolioScreening.notHalal} non-halal · {portfolioScreening.unscreened} unscreened</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-5 h-5 text-pink-500" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Purification Due</span>
                    </div>
                    <div className="text-3xl font-black text-amber-600 dark:text-amber-400">${portfolioScreening.purificationTotal.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Donate to charity</p>
                  </CardContent>
                </Card>
              </div>

              {/* Chart + Holdings */}
              <div className="grid lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Compliance Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 && (
                      <>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                              </Pie>
                              <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-3 mt-2">
                          {pieData.map(d => (
                            <div key={d.name} className="flex items-center gap-1.5 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-muted-foreground font-medium">{d.name} ({d.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Holdings Screening</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                      {portfolioScreening.results.map(result => (
                        <div key={result.symbol}>
                          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                            {result.grade ? <GradeBadge grade={result.grade} /> : <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Shield className="w-4 h-4 text-muted-foreground" /></div>}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{result.symbol}</span>
                                <span className="text-xs text-muted-foreground truncate">{result.name}</span>
                              </div>
                              {result.screeningNotes && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{result.screeningNotes}</p>}
                            </div>
                            <div className="text-right text-xs text-muted-foreground font-medium">${result.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {result.found ? (
                              <ComplianceBadge compliant={result.compliant ?? undefined} grade={result.grade || undefined} />
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Not Screened</Badge>
                            )}
                          </div>
                          {/* Halal Alternatives for non-compliant */}
                          {result.found && result.compliant === false && (
                            <div className="ml-12 mb-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                                <Sparkles className="w-3.5 h-3.5" />
                                Halal Alternatives in {allHalalStocks.find(s => s.symbol === result.symbol)?.sector || 'same sector'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {alternativesForHolding(allHalalStocks.find(s => s.symbol === result.symbol)?.sector || null, result.symbol).map(alt => (
                                  <div key={alt.symbol} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs cursor-pointer hover:border-emerald-400/50 transition-colors"
                                    onClick={() => setDetailStock(alt)}>
                                    <GradeBadge grade={alt.grade} />
                                    <div>
                                      <span className="font-bold text-foreground">{alt.symbol}</span>
                                      <span className="text-muted-foreground ml-1">${alt.price.toFixed(0)}</span>
                                    </div>
                                  </div>
                                ))}
                                {alternativesForHolding(allHalalStocks.find(s => s.symbol === result.symbol)?.sector || null, result.symbol).length === 0 && (
                                  <span className="text-xs text-muted-foreground">No alternatives found in this sector.</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* =================== TAB 3: PURIFICATION =================== */}
        <TabsContent value="purification" className="space-y-6">
          {!portfolioScreening ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-pink-500/10 rounded-2xl mb-4"><Heart className="w-12 h-12 text-pink-500" /></div>
                <h3 className="text-lg font-bold text-foreground mb-2">Run Screening First</h3>
                <p className="text-sm text-muted-foreground">Purification calculations require portfolio data.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-pink-500" />Purification Calculator</CardTitle>
                  <CardDescription>Non-halal income to donate based on your holdings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {portfolioScreening.results.filter(r => r.purificationPerShare > 0).map(result => {
                      const totalPurification = result.purificationPerShare * result.shares;
                      return (
                        <div key={result.symbol} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                          <div className="flex items-center gap-3">
                            {result.grade && <GradeBadge grade={result.grade} />}
                            <div>
                              <span className="font-bold text-sm text-foreground">{result.symbol}</span>
                              <p className="text-xs text-muted-foreground">{result.shares} shares × ${result.purificationPerShare.toFixed(2)}</p>
                            </div>
                          </div>
                          <span className="font-black text-sm text-foreground">${totalPurification.toFixed(2)}</span>
                        </div>
                      );
                    })}
                    {portfolioScreening.results.filter(r => r.purificationPerShare > 0).length === 0 && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No purification needed for your current holdings.</p>
                    )}
                  </div>
                  {portfolioScreening.purificationTotal > 0 && (
                    <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Total Purification Due</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Recommended quarterly donation</p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">${portfolioScreening.purificationTotal.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">~${(portfolioScreening.purificationTotal / 4).toFixed(2)}/quarter</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5 text-blue-500" />What is Purification?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Even Shariah-compliant companies may earn a small percentage from non-permissible sources. Investors must <strong className="text-foreground">purify</strong> this by donating it to charity.
                  </p>
                  <div className="space-y-3">
                    {[
                      { step: '1', title: 'Calculate Non-Permissible Income', desc: "Based on each company's ratio and your shares" },
                      { step: '2', title: 'Donate to Charity', desc: 'Cannot be claimed as Zakat' },
                      { step: '3', title: 'Repeat Quarterly', desc: 'Recalculate as financials update' },
                    ].map(item => (
                      <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-primary">{item.step}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* =================== TAB 4: ZAKAT CALCULATOR =================== */}
        <TabsContent value="zakat" className="space-y-6">
          {!portfolioScreening ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-amber-500/10 rounded-2xl mb-4"><Calculator className="w-12 h-12 text-amber-500" /></div>
                <h3 className="text-lg font-bold text-foreground mb-2">Add Portfolio Holdings First</h3>
                <p className="text-sm text-muted-foreground">Zakat is calculated on your portfolio value.</p>
              </CardContent>
            </Card>
          ) : zakatCalc && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-amber-500" />
                    Zakat on Investments
                  </CardTitle>
                  <CardDescription>Calculate annual Zakat (2.5%) on your halal investments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-muted-foreground">Gold Price (per troy oz)</label>
                    <Input type="number" value={zakatGoldPrice} onChange={e => setZakatGoldPrice(Number(e.target.value))} className="h-9" />
                    <p className="text-[11px] text-muted-foreground">Used to calculate Nisab threshold ({zakatNisabGrams}g of gold ≈ ${zakatCalc.nisabValue.toFixed(0)})</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm text-muted-foreground">Total Portfolio Value</span>
                      <span className="text-sm font-bold text-foreground">${zakatCalc.totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Halal Zakatable Value</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${zakatCalc.halalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm text-muted-foreground">Nisab Threshold</span>
                      <span className="text-sm font-bold text-foreground">${zakatCalc.nisabValue.toFixed(0)}</span>
                    </div>
                    <div className={`flex justify-between p-3 rounded-xl border ${zakatCalc.isAboveNisab ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-border'}`}>
                      <span className="text-sm text-muted-foreground">Above Nisab?</span>
                      <Badge className={zakatCalc.isAboveNisab ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground'}>
                        {zakatCalc.isAboveNisab ? 'Yes — Zakat is due' : 'No — Zakat not required'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Annual Zakat Due</p>
                        <p className="text-xs text-muted-foreground mt-0.5">2.5% of halal investment value</p>
                      </div>
                      <p className="text-3xl font-black text-amber-600 dark:text-amber-400">${zakatCalc.zakatDue.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />About Zakat on Stocks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Zakat on investments is obligatory for Muslims whose zakatable wealth exceeds the <strong className="text-foreground">Nisab</strong> (minimum threshold) for one full lunar year.
                  </p>
                  <div className="space-y-3">
                    {[
                      { icon: '🪙', title: 'Nisab = 85g of Gold', desc: `Currently ~$${zakatCalc.nisabValue.toFixed(0)} at $${zakatGoldPrice}/oz` },
                      { icon: '📊', title: 'Only Halal Holdings Count', desc: 'Non-compliant assets are excluded from zakatable wealth' },
                      { icon: '🧮', title: 'Rate: 2.5% (1/40th)', desc: 'Applied once per lunar year on qualifying assets' },
                      { icon: '🤲', title: 'Separate from Purification', desc: 'Zakat is a pillar of Islam; purification is for non-halal earnings' },
                    ].map(item => (
                      <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                        <span className="text-lg">{item.icon}</span>
                        <div>
                          <p className="text-sm font-bold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                        <strong>Note:</strong> This is an estimate. Consult a qualified scholar for your specific situation. Zakat calculation may differ based on school of thought.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* =================== TAB 5: METHODOLOGY =================== */}
        <TabsContent value="methodology" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" />Screening Methodology</CardTitle>
              <CardDescription>Based on AAOIFI Shariah Standard No. 21</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h3 className="font-black text-foreground flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Step 1: Business Activity Screen</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Companies whose core business involves any of the following are non-compliant:</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {['Conventional banking & insurance (riba)', 'Alcohol production & distribution', 'Pork & non-halal food production', 'Gambling & casinos',
                    'Tobacco products', 'Weapons & defense (controversial)', 'Adult entertainment', 'Interest-based financial services'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                      <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <span className="text-red-600 dark:text-red-400 text-xs font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-black text-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />Step 2: Financial Ratios Screen</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Financial structure must meet these AAOIFI thresholds:</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { val: '<30%', label: 'Debt / Market Cap' },
                    { val: '<30%', label: 'Cash & Interest / Market Cap' },
                    { val: '<5%', label: 'Non-Permissible Revenue' },
                  ].map(t => (
                    <div key={t.label} className="p-4 rounded-xl border border-border bg-muted/30 text-center">
                      <p className="text-3xl font-black text-primary">{t.val}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">{t.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-black text-foreground flex items-center gap-2"><Heart className="w-4 h-4 text-pink-500" />Step 3: Purification (Tazkiyah)</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  For compliant stocks, calculate and donate the non-permissible income portion: <strong className="text-foreground">(Non-Permissible Revenue ÷ Outstanding Shares) × Your Shares</strong>.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                    <strong>Disclaimer:</strong> This screening tool provides guidance based on AAOIFI Standard No. 21. It is not a fatwa. Consult a qualified Shariah scholar for personal compliance decisions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stock Detail Modal */}
      <Dialog open={!!detailStock} onOpenChange={(open) => !open && setDetailStock(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {detailStock && (() => {
            const debtRatio = detailStock.debtToMarketCap ?? 0;
            const cashRatio = detailStock.cashToMarketCap ?? 0;
            const receivablesRatio = detailStock.receivablesToMarketCap ?? 0;
            const nonPermRev = (detailStock.nonPermissibleRevenuePct ?? 0) / 100;
            const businessPassed = detailStock.businessScreenPassed ?? true;
            const financialPassed = detailStock.financialScreenPassed ?? true;
            const purification = detailStock.purificationPerShare ?? 0;

            return (
              <div className="space-y-5">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <GradeBadge grade={detailStock.grade} />
                    <div>
                      <DialogTitle className="text-lg">{detailStock.symbol} — {detailStock.name}</DialogTitle>
                      <DialogDescription>{detailStock.sector} · Shariah Compliance Report</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { val: `$${detailStock.price.toFixed(2)}`, label: 'Price' },
                    { val: detailStock.marketCap, label: 'Mkt Cap' },
                    { val: detailStock.dividendYield > 0 ? `${detailStock.dividendYield.toFixed(2)}%` : '—', label: 'Div Yield' },
                  ].map(d => (
                    <div key={d.label} className="text-center p-3 rounded-xl bg-muted/50">
                      <p className="text-lg font-black text-foreground">{d.val}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">{d.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <ComplianceBadge compliant={detailStock.overallCompliant} grade={detailStock.grade} />
                  {businessPassed && <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">Business ✓</Badge>}
                  {financialPassed && <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">Financial ✓</Badge>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {businessPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    <h4 className="font-bold text-sm text-foreground">Business Activity Screen</h4>
                    <Badge variant={businessPassed ? 'default' : 'destructive'} className="text-[10px] ml-auto">{businessPassed ? 'PASS' : 'FAIL'}</Badge>
                  </div>
                  <RatioBar label="Non-Permissible Revenue" value={nonPermRev} threshold={AAOIFI_THRESHOLDS.nonPermissibleIncome} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {financialPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                    <h4 className="font-bold text-sm text-foreground">Financial Ratios Screen</h4>
                    <Badge variant={financialPassed ? 'default' : 'destructive'} className="text-[10px] ml-auto">{financialPassed ? 'PASS' : 'FAIL'}</Badge>
                  </div>
                  <div className="space-y-2">
                    <RatioBar label="Debt / Market Cap" value={debtRatio} threshold={AAOIFI_THRESHOLDS.debtToMarketCap} />
                    <RatioBar label="Cash & Interest / Market Cap" value={cashRatio} threshold={AAOIFI_THRESHOLDS.cashToMarketCap} />
                    <RatioBar label="Receivables / Market Cap" value={receivablesRatio} threshold={AAOIFI_THRESHOLDS.receivablesToMarketCap} />
                  </div>
                </div>

                {detailStock.screeningNotes && (
                  <div className="p-3 rounded-xl bg-muted/50 border border-border">
                    <p className="text-xs text-muted-foreground">{detailStock.screeningNotes}</p>
                  </div>
                )}

                {purification > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-pink-500/5 rounded-xl border border-pink-500/20">
                    <Heart className="w-5 h-5 text-pink-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Purification: ${purification.toFixed(2)} per share</p>
                      <p className="text-xs text-muted-foreground">Donate this amount per share held to charity</p>
                    </div>
                  </div>
                )}

                {/* Halal Alternatives in modal */}
                {detailStock.overallCompliant === false && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      Halal Alternatives in {detailStock.sector}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {alternativesForHolding(detailStock.sector, detailStock.symbol).map(alt => (
                        <div key={alt.symbol} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs cursor-pointer hover:border-emerald-400/50"
                          onClick={() => setDetailStock(alt)}>
                          <GradeBadge grade={alt.grade} />
                          <div>
                            <span className="font-bold text-foreground">{alt.symbol}</span>
                            <span className="text-muted-foreground ml-1">${alt.price.toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HalalInvestingView;
