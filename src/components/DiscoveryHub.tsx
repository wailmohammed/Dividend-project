import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Lightbulb, TrendingUp, Zap, Shield, DollarSign, Cpu, Atom, Car, Droplets, Building2, FlaskConical, Star, ArrowUpRight, ArrowDownRight, Eye, Sparkles, Target, BarChart3, Search } from 'lucide-react';
import { Input } from './ui/input';

interface StockIdea {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: string;
  peRatio: number | null;
  dividendYield: number;
  sector: string;
  snowflakeScore: { value: number; future: number; past: number; health: number; dividend: number };
  reason: string;
}

interface ThemeCollection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  stocks: StockIdea[];
  tag: string;
}

const demoCollections: ThemeCollection[] = [
  {
    id: 'ai-stocks',
    title: 'AI & Machine Learning',
    description: 'Companies leading the artificial intelligence revolution',
    icon: <Cpu className="w-5 h-5" />,
    gradient: 'from-violet-500/10 to-purple-500/10 border-violet-500/20',
    tag: '🔥 Trending',
    stocks: [
      { symbol: 'NVDA', name: 'NVIDIA', price: 875.28, change: 4.2, marketCap: '$2.1T', peRatio: 68.5, dividendYield: 0.02, sector: 'Technology', snowflakeScore: { value: 2, future: 5, past: 5, health: 4, dividend: 1 }, reason: 'Dominant AI chip maker with 80%+ data center GPU market share' },
      { symbol: 'MSFT', name: 'Microsoft', price: 425.52, change: 1.8, marketCap: '$3.1T', peRatio: 36.2, dividendYield: 0.72, sector: 'Technology', snowflakeScore: { value: 3, future: 4, past: 5, health: 5, dividend: 2 }, reason: 'Azure AI + Copilot integration across enterprise products' },
      { symbol: 'GOOGL', name: 'Alphabet', price: 175.98, change: 2.1, marketCap: '$2.2T', peRatio: 27.4, dividendYield: 0.45, sector: 'Technology', snowflakeScore: { value: 4, future: 4, past: 4, health: 5, dividend: 1 }, reason: 'Gemini AI model, DeepMind research, Search AI integration' },
      { symbol: 'PLTR', name: 'Palantir', price: 24.50, change: 5.6, marketCap: '$54B', peRatio: 280, dividendYield: 0, sector: 'Technology', snowflakeScore: { value: 1, future: 4, past: 3, health: 4, dividend: 0 }, reason: 'AIP platform gaining enterprise traction, government AI contracts' },
      { symbol: 'AMD', name: 'AMD', price: 178.30, change: 3.1, marketCap: '$288B', peRatio: 48, dividendYield: 0, sector: 'Technology', snowflakeScore: { value: 2, future: 4, past: 4, health: 4, dividend: 0 }, reason: 'MI300X AI accelerator competing with NVIDIA in data centers' },
    ],
  },
  {
    id: 'nuclear-energy',
    title: 'Nuclear Energy',
    description: 'Clean energy renaissance through nuclear power',
    icon: <Atom className="w-5 h-5" />,
    gradient: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20',
    tag: '⚡ Hot Theme',
    stocks: [
      { symbol: 'CCJ', name: 'Cameco', price: 52.80, change: 2.8, marketCap: '$22B', peRatio: 55, dividendYield: 0.22, sector: 'Energy', snowflakeScore: { value: 2, future: 4, past: 3, health: 4, dividend: 1 }, reason: 'Largest uranium producer, benefiting from nuclear renaissance' },
      { symbol: 'CEG', name: 'Constellation Energy', price: 230.50, change: 1.5, marketCap: '$73B', peRatio: 28, dividendYield: 0.58, sector: 'Utilities', snowflakeScore: { value: 3, future: 4, past: 4, health: 4, dividend: 2 }, reason: 'Largest nuclear fleet in US, Microsoft data center deal' },
      { symbol: 'VST', name: 'Vistra', price: 105.20, change: 3.4, marketCap: '$36B', peRatio: 18, dividendYield: 0.75, sector: 'Utilities', snowflakeScore: { value: 4, future: 4, past: 3, health: 3, dividend: 2 }, reason: 'Nuclear + renewables portfolio, attractive valuation' },
      { symbol: 'UEC', name: 'Uranium Energy', price: 7.80, change: 4.2, marketCap: '$3B', peRatio: null, dividendYield: 0, sector: 'Energy', snowflakeScore: { value: 1, future: 3, past: 2, health: 3, dividend: 0 }, reason: 'US uranium production ramp-up, ISR mining technology' },
    ],
  },
  {
    id: 'dividend-aristocrats',
    title: 'Dividend Aristocrats',
    description: '25+ years of consecutive dividend increases',
    icon: <DollarSign className="w-5 h-5" />,
    gradient: 'from-amber-500/10 to-orange-500/10 border-amber-500/20',
    tag: '💰 Income',
    stocks: [
      { symbol: 'JNJ', name: 'Johnson & Johnson', price: 157.30, change: 0.3, marketCap: '$379B', peRatio: 11.2, dividendYield: 3.12, sector: 'Healthcare', snowflakeScore: { value: 4, future: 3, past: 4, health: 4, dividend: 5 }, reason: '62 years of dividend increases, defensive healthcare giant' },
      { symbol: 'PG', name: 'Procter & Gamble', price: 165.80, change: 0.5, marketCap: '$391B', peRatio: 26, dividendYield: 2.42, sector: 'Consumer Staples', snowflakeScore: { value: 3, future: 3, past: 4, health: 5, dividend: 4 }, reason: '68 years of increases, pricing power in essentials' },
      { symbol: 'KO', name: 'Coca-Cola', price: 62.40, change: 0.1, marketCap: '$269B', peRatio: 24.5, dividendYield: 3.05, sector: 'Consumer Staples', snowflakeScore: { value: 3, future: 3, past: 4, health: 4, dividend: 5 }, reason: '62 years of increases, Warren Buffett favorite' },
      { symbol: 'MMM', name: '3M Company', price: 105.20, change: -0.8, marketCap: '$58B', peRatio: 12, dividendYield: 5.5, sector: 'Industrials', snowflakeScore: { value: 5, future: 3, past: 2, health: 3, dividend: 5 }, reason: 'Deep value play, 65 years of increases, restructuring' },
      { symbol: 'ABBV', name: 'AbbVie', price: 172.50, change: 1.2, marketCap: '$304B', peRatio: 15, dividendYield: 3.68, sector: 'Healthcare', snowflakeScore: { value: 4, future: 3, past: 4, health: 3, dividend: 5 }, reason: 'Strong pharma pipeline beyond Humira, high yield' },
    ],
  },
  {
    id: 'buy-the-dip',
    title: 'Buy the Dip',
    description: 'Quality stocks trading below fair value',
    icon: <Target className="w-5 h-5" />,
    gradient: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20',
    tag: '📉 Opportunity',
    stocks: [
      { symbol: 'PYPL', name: 'PayPal', price: 65.20, change: -1.2, marketCap: '$70B', peRatio: 17, dividendYield: 0, sector: 'Fintech', snowflakeScore: { value: 5, future: 3, past: 3, health: 4, dividend: 0 }, reason: '70% below ATH, Venmo growth, share buybacks accelerating' },
      { symbol: 'DIS', name: 'Walt Disney', price: 112.50, change: -0.5, marketCap: '$206B', peRatio: 70, dividendYield: 0.8, sector: 'Media', snowflakeScore: { value: 3, future: 3, past: 2, health: 3, dividend: 1 }, reason: 'Streaming turning profitable, parks strong, content library moat' },
      { symbol: 'NKE', name: 'Nike', price: 95.40, change: -2.1, marketCap: '$143B', peRatio: 28, dividendYield: 1.52, sector: 'Consumer', snowflakeScore: { value: 3, future: 3, past: 3, health: 4, dividend: 2 }, reason: 'Brand strength, innovation cycle reset, DTC pivot' },
      { symbol: 'BABA', name: 'Alibaba', price: 78.30, change: 1.8, marketCap: '$198B', peRatio: 9.5, dividendYield: 1.2, sector: 'E-Commerce', snowflakeScore: { value: 5, future: 4, past: 3, health: 5, dividend: 2 }, reason: 'Extreme value, cloud + AI growth, massive buybacks' },
    ],
  },
  {
    id: 'insider-buying',
    title: 'High Insider Buying',
    description: 'Stocks with significant recent insider purchases',
    icon: <Shield className="w-5 h-5" />,
    gradient: 'from-indigo-500/10 to-blue-500/10 border-indigo-500/20',
    tag: '🔍 Smart Money',
    stocks: [
      { symbol: 'JPM', name: 'JPMorgan Chase', price: 198.50, change: 0.8, marketCap: '$572B', peRatio: 12, dividendYield: 2.22, sector: 'Financials', snowflakeScore: { value: 4, future: 3, past: 5, health: 4, dividend: 3 }, reason: 'Jamie Dimon added $25M in shares, fortress balance sheet' },
      { symbol: 'META', name: 'Meta Platforms', price: 505.30, change: 2.5, marketCap: '$1.3T', peRatio: 28, dividendYield: 0.35, sector: 'Technology', snowflakeScore: { value: 3, future: 4, past: 5, health: 5, dividend: 1 }, reason: 'Board members purchasing, AI ad targeting improvements' },
      { symbol: 'GM', name: 'General Motors', price: 42.80, change: 1.1, marketCap: '$48B', peRatio: 5.5, dividendYield: 0.93, sector: 'Automotive', snowflakeScore: { value: 5, future: 3, past: 4, health: 3, dividend: 2 }, reason: 'CEO Mary Barra bought $5M in stock, EV transition progress' },
    ],
  },
  {
    id: 'ev-autonomous',
    title: 'EV & Autonomous Vehicles',
    description: 'Electric and self-driving vehicle companies',
    icon: <Car className="w-5 h-5" />,
    gradient: 'from-green-500/10 to-lime-500/10 border-green-500/20',
    tag: '🚗 Mega Trend',
    stocks: [
      { symbol: 'TSLA', name: 'Tesla', price: 245.80, change: 3.5, marketCap: '$780B', peRatio: 72, dividendYield: 0, sector: 'Automotive', snowflakeScore: { value: 1, future: 4, past: 3, health: 4, dividend: 0 }, reason: 'FSD progress, energy storage growth, robotaxi timeline' },
      { symbol: 'RIVN', name: 'Rivian', price: 16.20, change: -1.8, marketCap: '$17B', peRatio: null, dividendYield: 0, sector: 'Automotive', snowflakeScore: { value: 1, future: 3, past: 1, health: 2, dividend: 0 }, reason: 'R2 mass market vehicle, Amazon delivery fleet, VW partnership' },
      { symbol: 'LI', name: 'Li Auto', price: 32.50, change: 2.2, marketCap: '$35B', peRatio: 22, dividendYield: 0, sector: 'Automotive', snowflakeScore: { value: 4, future: 4, past: 4, health: 5, dividend: 0 }, reason: 'Profitable Chinese EV maker, strong EREV demand' },
    ],
  },
];

const MiniSnowflake: React.FC<{ score: StockIdea['snowflakeScore'] }> = ({ score }) => {
  const total = score.value + score.future + score.past + score.health + score.dividend;
  const max = 25;
  const pct = (total / max) * 100;

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-8 h-8 relative">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke="hsl(var(--primary))" strokeWidth="3"
            strokeDasharray={`${pct * 0.942} 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground">{total}</span>
      </div>
    </div>
  );
};

const DiscoveryHub: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  const filteredCollections = useMemo(() => {
    if (!searchQuery) return demoCollections;
    const q = searchQuery.toLowerCase();
    return demoCollections.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.stocks.some(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const activeCollection = selectedCollection ? demoCollections.find(c => c.id === selectedCollection) : null;

  return (
    <div className="space-y-6 p-6">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Showing curated investment themes. Sign in for personalized ideas.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            Discovery Hub
          </h1>
          <p className="text-muted-foreground">Curated stock collections & investment themes</p>
        </div>
        <div className="relative w-full md:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search themes or stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Theme Grid */}
      {!activeCollection ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCollections.map(collection => (
            <Card
              key={collection.id}
              className={`cursor-pointer hover:shadow-lg transition-all border ${collection.gradient} group`}
              onClick={() => setSelectedCollection(collection.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-card rounded-lg border border-border shadow-sm group-hover:shadow-md transition-all">
                    {collection.icon}
                  </div>
                  <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">{collection.tag}</Badge>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{collection.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{collection.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {collection.stocks.slice(0, 4).map(s => (
                    <Badge key={s.symbol} variant="outline" className="text-[10px]">{s.symbol}</Badge>
                  ))}
                  {collection.stocks.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{collection.stocks.length - 4} more</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium group-hover:gap-2 transition-all">
                  <Eye className="w-3 h-3" /> Explore collection
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Expanded Collection View */
        <div className="space-y-4">
          <button
            onClick={() => setSelectedCollection(null)}
            className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
          >
            ← Back to all themes
          </button>

          <Card className={`border ${activeCollection.gradient}`}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-card rounded-lg border border-border shadow-sm">
                  {activeCollection.icon}
                </div>
                <div>
                  <CardTitle className="text-xl">{activeCollection.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{activeCollection.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeCollection.stocks.map(stock => (
                  <div key={stock.symbol} className="p-4 bg-muted/30 rounded-xl border border-border hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-foreground text-lg">{stock.symbol}</span>
                          <span className="text-sm text-muted-foreground">{stock.name}</span>
                          <Badge variant="outline" className="text-[10px]">{stock.sector}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{stock.reason}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>MCap: {stock.marketCap}</span>
                          {stock.peRatio && <span>P/E: {stock.peRatio}</span>}
                          {stock.dividendYield > 0 && <span>Yield: {stock.dividendYield}%</span>}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <MiniSnowflake score={stock.snowflakeScore} />
                        <div>
                          <div className="text-lg font-bold text-foreground">${stock.price.toFixed(2)}</div>
                          <div className={`text-xs font-medium flex items-center justify-end gap-0.5 ${stock.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {stock.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(stock.change)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DiscoveryHub;
