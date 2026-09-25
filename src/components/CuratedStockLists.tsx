import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Input } from './ui/input';
import { Crown, Shield, TrendingUp, DollarSign, Search, Star, ArrowUpRight } from 'lucide-react';

interface ListStock {
  symbol: string;
  name: string;
  price: number;
  yield: number;
  yearsGrowth: number;
  sector: string;
  payoutRatio: number;
  divGrowth5Y: number;
  safetyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

const gradeColor = (g: string) => {
  if (g === 'A') return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  if (g === 'B') return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
  if (g === 'C') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
  if (g === 'D') return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
  return 'text-red-500 bg-red-500/10 border-red-500/30';
};

const ARISTOCRATS: ListStock[] = [
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 155.20, yield: 3.10, yearsGrowth: 62, sector: 'Healthcare', payoutRatio: 46, divGrowth5Y: 5.8, safetyGrade: 'A' },
  { symbol: 'PG', name: 'Procter & Gamble', price: 160.50, yield: 2.45, yearsGrowth: 68, sector: 'Consumer Defensive', payoutRatio: 58, divGrowth5Y: 5.5, safetyGrade: 'A' },
  { symbol: 'KO', name: 'Coca-Cola', price: 62.30, yield: 3.05, yearsGrowth: 62, sector: 'Consumer Defensive', payoutRatio: 72, divGrowth5Y: 3.2, safetyGrade: 'A' },
  { symbol: 'PEP', name: 'PepsiCo', price: 170.80, yield: 2.80, yearsGrowth: 52, sector: 'Consumer Defensive', payoutRatio: 65, divGrowth5Y: 7.1, safetyGrade: 'A' },
  { symbol: 'MMM', name: '3M Company', price: 105.40, yield: 5.70, yearsGrowth: 65, sector: 'Industrials', payoutRatio: 82, divGrowth5Y: 1.2, safetyGrade: 'C' },
  { symbol: 'ABT', name: 'Abbott Laboratories', price: 108.90, yield: 1.95, yearsGrowth: 52, sector: 'Healthcare', payoutRatio: 38, divGrowth5Y: 12.5, safetyGrade: 'A' },
  { symbol: 'CL', name: 'Colgate-Palmolive', price: 78.60, yield: 2.40, yearsGrowth: 61, sector: 'Consumer Defensive', payoutRatio: 55, divGrowth5Y: 3.0, safetyGrade: 'B' },
  { symbol: 'EMR', name: 'Emerson Electric', price: 98.50, yield: 2.15, yearsGrowth: 67, sector: 'Industrials', payoutRatio: 42, divGrowth5Y: 1.5, safetyGrade: 'B' },
];

const KINGS: ListStock[] = [
  { symbol: 'AWR', name: 'American States Water', price: 82.30, yield: 1.90, yearsGrowth: 69, sector: 'Utilities', payoutRatio: 55, divGrowth5Y: 9.2, safetyGrade: 'A' },
  { symbol: 'DOV', name: 'Dover Corp', price: 148.20, yield: 1.35, yearsGrowth: 68, sector: 'Industrials', payoutRatio: 28, divGrowth5Y: 1.8, safetyGrade: 'B' },
  { symbol: 'NWN', name: 'Northwest Natural', price: 41.50, yield: 4.65, yearsGrowth: 68, sector: 'Utilities', payoutRatio: 78, divGrowth5Y: 0.6, safetyGrade: 'B' },
  { symbol: 'PH', name: 'Parker-Hannifin', price: 415.80, yield: 1.25, yearsGrowth: 67, sector: 'Industrials', payoutRatio: 22, divGrowth5Y: 13.0, safetyGrade: 'A' },
  { symbol: 'SWK', name: 'Stanley Black & Decker', price: 92.10, yield: 3.50, yearsGrowth: 56, sector: 'Industrials', payoutRatio: 85, divGrowth5Y: 4.5, safetyGrade: 'C' },
  { symbol: 'TGT', name: 'Target Corp', price: 142.60, yield: 3.10, yearsGrowth: 56, sector: 'Consumer Cyclical', payoutRatio: 48, divGrowth5Y: 11.8, safetyGrade: 'B' },
];

const HIGH_YIELD: ListStock[] = [
  { symbol: 'T', name: 'AT&T', price: 17.80, yield: 6.25, yearsGrowth: 0, sector: 'Communication', payoutRatio: 55, divGrowth5Y: -8.5, safetyGrade: 'C' },
  { symbol: 'VZ', name: 'Verizon', price: 38.50, yield: 6.80, yearsGrowth: 19, sector: 'Communication', payoutRatio: 56, divGrowth5Y: 2.0, safetyGrade: 'B' },
  { symbol: 'MO', name: 'Altria Group', price: 45.20, yield: 8.50, yearsGrowth: 54, sector: 'Consumer Defensive', payoutRatio: 75, divGrowth5Y: 4.2, safetyGrade: 'B' },
  { symbol: 'O', name: 'Realty Income', price: 55.80, yield: 5.50, yearsGrowth: 30, sector: 'Real Estate', payoutRatio: 76, divGrowth5Y: 3.8, safetyGrade: 'A' },
  { symbol: 'EPD', name: 'Enterprise Products', price: 27.90, yield: 7.20, yearsGrowth: 25, sector: 'Energy', payoutRatio: 62, divGrowth5Y: 3.0, safetyGrade: 'B' },
  { symbol: 'MPW', name: 'Medical Properties Trust', price: 5.80, yield: 12.40, yearsGrowth: 10, sector: 'Real Estate', payoutRatio: 125, divGrowth5Y: -15.0, safetyGrade: 'F' },
  { symbol: 'AGNC', name: 'AGNC Investment', price: 10.20, yield: 14.10, yearsGrowth: 0, sector: 'Financial', payoutRatio: 92, divGrowth5Y: -5.5, safetyGrade: 'D' },
];

const GROWTH: ListStock[] = [
  { symbol: 'AVGO', name: 'Broadcom', price: 890.50, yield: 1.90, yearsGrowth: 14, sector: 'Technology', payoutRatio: 35, divGrowth5Y: 18.5, safetyGrade: 'A' },
  { symbol: 'MSFT', name: 'Microsoft', price: 378.90, yield: 0.75, yearsGrowth: 22, sector: 'Technology', payoutRatio: 25, divGrowth5Y: 10.2, safetyGrade: 'A' },
  { symbol: 'V', name: 'Visa Inc', price: 278.40, yield: 0.80, yearsGrowth: 16, sector: 'Financial', payoutRatio: 22, divGrowth5Y: 16.8, safetyGrade: 'A' },
  { symbol: 'HD', name: 'Home Depot', price: 345.60, yield: 2.45, yearsGrowth: 14, sector: 'Consumer Cyclical', payoutRatio: 48, divGrowth5Y: 12.0, safetyGrade: 'A' },
  { symbol: 'COST', name: 'Costco', price: 572.30, yield: 0.65, yearsGrowth: 20, sector: 'Consumer Defensive', payoutRatio: 28, divGrowth5Y: 12.5, safetyGrade: 'A' },
  { symbol: 'UNH', name: 'UnitedHealth', price: 520.10, yield: 1.45, yearsGrowth: 15, sector: 'Healthcare', payoutRatio: 30, divGrowth5Y: 15.2, safetyGrade: 'A' },
];

const LISTS = {
  aristocrats: { data: ARISTOCRATS, icon: Crown, color: 'text-amber-500', label: 'Dividend Aristocrats', desc: '25+ consecutive years of dividend increases' },
  kings: { data: KINGS, icon: Crown, color: 'text-purple-500', label: 'Dividend Kings', desc: '50+ consecutive years of dividend increases' },
  highYield: { data: HIGH_YIELD, icon: DollarSign, color: 'text-emerald-500', label: 'High Yield', desc: 'Stocks yielding 5%+ annually' },
  growth: { data: GROWTH, icon: TrendingUp, color: 'text-blue-500', label: 'Dividend Growth', desc: 'Fast-growing dividends with strong fundamentals' },
};

const CuratedStockLists: React.FC = () => {
  const [activeList, setActiveList] = useState<keyof typeof LISTS>('aristocrats');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'yield' | 'yearsGrowth' | 'divGrowth5Y' | 'safetyGrade'>('yield');

  const list = LISTS[activeList];
  const filtered = list.data
    .filter(s => !search || s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'safetyGrade') return a.safetyGrade.localeCompare(b.safetyGrade);
      return (b as any)[sortBy] - (a as any)[sortBy];
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Curated Stock Lists
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeList} onValueChange={v => { setActiveList(v as keyof typeof LISTS); setSearch(''); }}>
            <TabsList className="grid grid-cols-4 mb-4">
              {Object.entries(LISTS).map(([key, val]) => (
                <TabsTrigger key={key} value={key} className="gap-1.5 text-xs">
                  <val.icon className={`w-3.5 h-3.5 ${val.color}`} />
                  {key === 'highYield' ? 'High Yield' : key === 'growth' ? 'Growth' : key.charAt(0).toUpperCase() + key.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mb-4">
              <div className="text-sm text-muted-foreground mb-3">{list.desc}</div>
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter stocks..." className="pl-9" />
                </div>
                <div className="flex gap-1">
                  {(['yield', 'yearsGrowth', 'divGrowth5Y', 'safetyGrade'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)} className={`px-2 py-1 text-xs rounded border transition-colors ${sortBy === s ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
                      {s === 'yield' ? 'Yield' : s === 'yearsGrowth' ? 'Streak' : s === 'divGrowth5Y' ? 'Growth' : 'Safety'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {Object.keys(LISTS).map(key => (
              <TabsContent key={key} value={key}>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filtered.map(s => (
                    <div key={s.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:border-primary/20 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{s.symbol.slice(0, 2)}</div>
                        <div>
                          <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{s.symbol}</div>
                          <div className="text-[10px] text-muted-foreground">{s.name} · {s.sector}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs text-muted-foreground">Yield</div>
                          <div className="text-sm font-bold text-emerald-500">{s.yield.toFixed(2)}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Streak</div>
                          <div className="text-sm font-bold text-foreground">{s.yearsGrowth}yr</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">5Y Growth</div>
                          <div className={`text-sm font-bold ${s.divGrowth5Y >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.divGrowth5Y > 0 ? '+' : ''}{s.divGrowth5Y}%</div>
                        </div>
                        <Badge variant="outline" className={`text-xs font-bold ${gradeColor(s.safetyGrade)}`}>{s.safetyGrade}</Badge>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <div className="text-center text-muted-foreground py-8">No stocks match your filter</div>}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CuratedStockLists;
