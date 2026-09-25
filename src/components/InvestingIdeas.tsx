import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  TrendingDown, TrendingUp, DollarSign, Zap, ShieldCheck, Flame, 
  Lightbulb, ArrowRight, BarChart3, Star, Filter
} from 'lucide-react';

interface StockIdea {
  symbol: string;
  name: string;
  price: number;
  change: number;
  yield?: number;
  pe?: number;
  marketCap: string;
  reason: string;
}

const IDEAS: Record<string, { title: string; description: string; icon: React.ReactNode; color: string; stocks: StockIdea[] }> = {
  undervalued: {
    title: 'Undervalued Stocks',
    description: 'Stocks trading below estimated fair value based on P/E, P/B, and DCF models',
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'text-green-500',
    stocks: [
      { symbol: 'VZ', name: 'Verizon Communications', price: 42.50, change: -2.1, yield: 6.5, pe: 9, marketCap: '$179B', reason: 'Trading at 40% discount to DCF fair value with 6.5% yield' },
      { symbol: 'INTC', name: 'Intel Corporation', price: 31.20, change: -5.3, pe: 12, marketCap: '$131B', reason: 'Deep value play on semiconductor recovery with new fab investments' },
      { symbol: 'BMY', name: 'Bristol-Myers Squibb', price: 52.80, change: -1.8, yield: 4.2, pe: 8, marketCap: '$107B', reason: 'Forward P/E of 8x with strong pipeline and 4.2% dividend yield' },
      { symbol: 'PYPL', name: 'PayPal Holdings', price: 62.40, change: 1.2, pe: 15, marketCap: '$68B', reason: '70% below ATH, generating strong free cash flow, buyback program' },
      { symbol: 'CVS', name: 'CVS Health', price: 78.90, change: -0.8, yield: 3.1, pe: 10, marketCap: '$102B', reason: 'Healthcare conglomerate at 10x earnings with growing Aetna segment' },
    ]
  },
  high_dividend: {
    title: 'High Dividend Yield',
    description: 'Quality companies paying above-average dividends with strong coverage',
    icon: <DollarSign className="w-5 h-5" />,
    color: 'text-emerald-500',
    stocks: [
      { symbol: 'O', name: 'Realty Income', price: 54.20, change: 0.5, yield: 5.8, pe: 45, marketCap: '$48B', reason: 'Monthly dividend REIT with 30+ year increase streak, A3 credit rating' },
      { symbol: 'ABBV', name: 'AbbVie Inc', price: 185.30, change: 1.1, yield: 3.6, pe: 14, marketCap: '$327B', reason: '52-year dividend streak (King), strong immunology pipeline' },
      { symbol: 'MO', name: 'Altria Group', price: 45.70, change: -0.3, yield: 8.2, pe: 9, marketCap: '$79B', reason: '8.2% yield with 54-year increase streak, dominant US tobacco position' },
      { symbol: 'EPD', name: 'Enterprise Products', price: 28.90, change: 0.7, yield: 7.1, marketCap: '$63B', reason: '7.1% distribution yield, 25-year increase streak, low leverage MLP' },
      { symbol: 'SCHD', name: 'Schwab US Dividend ETF', price: 78.40, change: 0.2, yield: 3.4, marketCap: '$54B', reason: 'Quality dividend ETF, 12% 5Y dividend CAGR, 0.06% expense ratio' },
    ]
  },
  buy_the_dip: {
    title: 'Buy the Dip',
    description: 'Quality stocks that have pulled back significantly from recent highs',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-orange-500',
    stocks: [
      { symbol: 'CRWD', name: 'CrowdStrike', price: 285.60, change: -8.2, pe: 75, marketCap: '$68B', reason: 'Leader in endpoint security, -15% from highs on sector rotation' },
      { symbol: 'SNOW', name: 'Snowflake', price: 165.40, change: -12.1, pe: 0, marketCap: '$54B', reason: 'Cloud data platform, -25% from highs, accelerating consumption revenue' },
      { symbol: 'ENPH', name: 'Enphase Energy', price: 118.30, change: -6.5, pe: 35, marketCap: '$16B', reason: 'Solar microinverter leader, -60% from ATH, European expansion underway' },
      { symbol: 'DIS', name: 'Walt Disney', price: 95.80, change: -3.4, pe: 22, marketCap: '$175B', reason: 'Disney+ approaching profitability, parks segment strong, near 52-week lows' },
      { symbol: 'NKE', name: 'Nike', price: 98.50, change: -4.7, pe: 28, marketCap: '$150B', reason: 'Global brand power, DTC transformation, -30% from highs on China concerns' },
    ]
  },
  quality_growth: {
    title: 'Quality Growth',
    description: 'Companies with strong moats, growing earnings, and high ROIC',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: 'text-blue-500',
    stocks: [
      { symbol: 'MSFT', name: 'Microsoft', price: 415.20, change: 1.8, pe: 36, yield: 0.7, marketCap: '$3.1T', reason: 'Azure + AI leader, 20%+ revenue growth, 42% operating margins' },
      { symbol: 'V', name: 'Visa', price: 282.50, change: 0.9, pe: 30, yield: 0.7, marketCap: '$580B', reason: 'Global payment duopoly, 50%+ net margins, secular digital payments trend' },
      { symbol: 'COST', name: 'Costco', price: 725.80, change: 0.4, pe: 50, yield: 0.5, marketCap: '$322B', reason: '93% membership renewal rate, growing e-commerce, pricing power moat' },
      { symbol: 'UNH', name: 'UnitedHealth Group', price: 528.40, change: 1.2, pe: 22, yield: 1.4, marketCap: '$488B', reason: 'Healthcare conglomerate with Optum growth engine, 15%+ EPS growth' },
      { symbol: 'ASML', name: 'ASML Holding', price: 685.30, change: 2.1, pe: 40, yield: 0.9, marketCap: '$275B', reason: 'Monopoly on EUV lithography, essential for advanced chip manufacturing' },
    ]
  },
  momentum: {
    title: 'Momentum Leaders',
    description: 'Stocks showing strong price and earnings momentum with technical breakouts',
    icon: <Flame className="w-5 h-5" />,
    color: 'text-red-500',
    stocks: [
      { symbol: 'NVDA', name: 'NVIDIA', price: 875.40, change: 4.2, pe: 65, yield: 0.02, marketCap: '$2.2T', reason: 'AI infrastructure leader, 200%+ data center growth, strong guidance' },
      { symbol: 'LLY', name: 'Eli Lilly', price: 785.60, change: 3.1, pe: 120, yield: 0.6, marketCap: '$747B', reason: 'GLP-1 drugs Mounjaro/Zepbound driving blockbuster revenue growth' },
      { symbol: 'META', name: 'Meta Platforms', price: 505.20, change: 2.8, pe: 27, marketCap: '$1.3T', reason: 'Year of efficiency paying off, AI advertising gains, Reality Labs optionality' },
      { symbol: 'AVGO', name: 'Broadcom', price: 1350.80, change: 1.9, pe: 35, yield: 1.4, marketCap: '$630B', reason: 'VMware integration + custom AI chips for hyperscalers driving growth' },
      { symbol: 'GE', name: 'GE Aerospace', price: 162.40, change: 2.5, pe: 45, yield: 0.5, marketCap: '$177B', reason: 'Post-spinoff pure-play aerospace, 30% operating margins, fleet growth' },
    ]
  }
};

export const InvestingIdeas: React.FC = () => {
  const [activeIdea, setActiveIdea] = useState('undervalued');
  
  const currentIdea = IDEAS[activeIdea];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-primary" />
          Investing Ideas
        </h1>
        <p className="text-muted-foreground">Curated stock collections to inspire your next investment</p>
      </div>

      {/* Idea Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(IDEAS).map(([key, idea]) => (
          <button
            key={key}
            onClick={() => setActiveIdea(key)}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeIdea === key 
                ? 'bg-primary/10 border-primary shadow-md' 
                : 'bg-card border-border hover:bg-muted/50'
            }`}
          >
            <div className={`mb-2 ${idea.color}`}>{idea.icon}</div>
            <h3 className="text-sm font-bold text-foreground">{idea.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{idea.stocks.length} picks</p>
          </button>
        ))}
      </div>

      {/* Active Idea Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={currentIdea.color}>{currentIdea.icon}</div>
            <div>
              <CardTitle>{currentIdea.title}</CardTitle>
              <CardDescription>{currentIdea.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentIdea.stocks.map((stock) => (
              <div key={stock.symbol} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-foreground text-lg">{stock.symbol}</span>
                    <span className="text-sm text-muted-foreground">{stock.name}</span>
                    <span className={`text-sm font-medium ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stock.change >= 0 ? '+' : ''}{stock.change}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{stock.reason}</p>
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Price</p>
                    <p className="font-bold">${stock.price.toFixed(2)}</p>
                  </div>
                  {stock.yield && (
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Yield</p>
                      <p className="font-bold text-green-500">{stock.yield}%</p>
                    </div>
                  )}
                  {stock.pe && (
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">P/E</p>
                      <p className="font-bold">{stock.pe}x</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Market Cap</p>
                    <p className="font-bold">{stock.marketCap}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardContent className="p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Disclaimer</p>
            <p className="mt-1">
              These are educational stock ideas based on common screening criteria. They are not investment recommendations. 
              Always conduct your own due diligence before investing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvestingIdeas;
