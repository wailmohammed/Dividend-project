import { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, Video, ExternalLink, Star, ThumbsUp, ChevronRight, Clock, TrendingUp, Shield, PiggyBank, BarChart3, DollarSign, ArrowLeft, Bookmark, BookmarkCheck, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { useAuth } from '@/context/AuthContext';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  readTime: string;
  views: number;
  rating: number;
  date: string;
  tags: string[];
}

const knowledgeBaseArticles: Article[] = [
  {
    id: 'diversified-portfolio',
    title: 'How to Build a Diversified Portfolio',
    category: 'Portfolio Management',
    readTime: '8 min',
    views: 12453,
    rating: 4.8,
    date: '2024-01-15',
    tags: ['diversification', 'asset allocation', 'risk management'],
    content: `
# Building a Diversified Portfolio

Diversification is one of the most important principles in investing. It involves spreading your investments across different asset classes, sectors, and geographic regions to reduce risk.

## Why Diversify?

1. **Reduces Risk**: When one investment performs poorly, others may perform well, balancing your overall returns.
2. **Smoother Returns**: Diversified portfolios tend to have less volatile returns over time.
3. **Protection Against Uncertainty**: No one can predict which investments will perform best.

## Key Diversification Strategies

### Asset Class Diversification
- **Stocks**: Offer growth potential but higher volatility
- **Bonds**: Provide income and stability
- **Real Estate**: Offers income and inflation protection
- **Commodities**: Can hedge against inflation
- **Cash**: Provides liquidity and safety

### Sector Diversification
Spread your stock investments across different sectors:
- Technology
- Healthcare
- Consumer Staples
- Financials
- Energy
- Utilities

### Geographic Diversification
- Domestic markets
- International developed markets
- Emerging markets

## Sample Diversified Portfolio

| Asset Class | Conservative | Moderate | Aggressive |
|-------------|-------------|----------|------------|
| Stocks | 30% | 60% | 80% |
| Bonds | 50% | 30% | 10% |
| Real Estate | 10% | 5% | 5% |
| Cash | 10% | 5% | 5% |

## Tips for Implementation

1. **Start with broad index funds** - They provide instant diversification
2. **Rebalance regularly** - Quarterly or annually
3. **Consider your time horizon** - Longer horizons can handle more volatility
4. **Don't over-diversify** - Too many holdings can be hard to manage

Remember: Diversification doesn't guarantee profits or protect against losses, but it's a proven strategy for managing investment risk.
    `
  },
  {
    id: 'market-volatility',
    title: 'Understanding Market Volatility',
    category: 'Risk Management',
    readTime: '6 min',
    views: 9821,
    rating: 4.7,
    date: '2024-01-10',
    tags: ['volatility', 'VIX', 'risk'],
    content: `
# Understanding Market Volatility

Volatility refers to the degree of variation in the price of a financial instrument over time. Understanding volatility is crucial for making informed investment decisions.

## What Causes Volatility?

1. **Economic Data Releases**: GDP, employment numbers, inflation data
2. **Geopolitical Events**: Elections, trade wars, conflicts
3. **Earnings Reports**: Company performance can move markets
4. **Interest Rate Changes**: Federal Reserve decisions impact all markets
5. **Market Sentiment**: Fear and greed drive short-term movements

## Measuring Volatility

### The VIX Index
The VIX (CBOE Volatility Index) measures expected market volatility:
- **Below 12**: Very low volatility (calm markets)
- **12-20**: Normal volatility
- **20-30**: Elevated volatility
- **Above 30**: High volatility (fear in markets)

### Standard Deviation
A statistical measure of how much returns vary from their average. Higher standard deviation = higher volatility.

## Strategies for Volatile Markets

1. **Stay the Course**: Avoid emotional decisions
2. **Dollar-Cost Averaging**: Invest regularly regardless of market conditions
3. **Maintain Cash Reserves**: Have liquidity for opportunities
4. **Diversify**: Spread risk across asset classes
5. **Review Your Asset Allocation**: Ensure it matches your risk tolerance

## Volatility as Opportunity

- Lower prices mean better buying opportunities for long-term investors
- Volatility creates mispricing that informed investors can exploit
- Options strategies can profit from volatility itself

Remember: Volatility is normal and temporary. Staying invested through volatility has historically been rewarded.
    `
  },
  {
    id: 'technical-indicators',
    title: 'Technical Indicators Explained',
    category: 'Technical Analysis',
    readTime: '12 min',
    views: 8734,
    rating: 4.9,
    date: '2024-01-05',
    tags: ['technical analysis', 'indicators', 'trading'],
    content: `
# Technical Indicators Explained

Technical indicators are mathematical calculations based on price, volume, or open interest that traders use to analyze securities and make trading decisions.

## Moving Averages

### Simple Moving Average (SMA)
The average price over a specific number of periods.
- **50-day SMA**: Intermediate trend indicator
- **200-day SMA**: Long-term trend indicator
- **Golden Cross**: 50-day crosses above 200-day (bullish)
- **Death Cross**: 50-day crosses below 200-day (bearish)

### Exponential Moving Average (EMA)
Gives more weight to recent prices, making it more responsive to new information.

## Momentum Indicators

### Relative Strength Index (RSI)
Measures the speed and magnitude of price changes.
- **Range**: 0-100
- **Above 70**: Overbought (potential sell signal)
- **Below 30**: Oversold (potential buy signal)

### MACD (Moving Average Convergence Divergence)
Shows the relationship between two moving averages.
- **Signal Line Crossover**: When MACD crosses above signal line (bullish)
- **Zero Line Crossover**: When MACD crosses above zero (trend confirmation)

## Volume Indicators

### On-Balance Volume (OBV)
Relates volume to price change:
- Rising OBV = buying pressure
- Falling OBV = selling pressure

### Volume-Price Trend
Combines price and volume to confirm trends.

## Using Indicators Effectively

1. **Don't rely on a single indicator** - Use multiple for confirmation
2. **Understand the context** - Indicators work differently in trending vs. ranging markets
3. **Combine with fundamentals** - Technical analysis works best with fundamental analysis
4. **Practice risk management** - Always use stop-losses

## Common Mistakes to Avoid

- Overcomplicating charts with too many indicators
- Ignoring the broader market trend
- Not considering the time frame
- Trading against the trend
    `
  },
  {
    id: 'dollar-cost-averaging',
    title: 'Dollar-Cost Averaging Strategy',
    category: 'Trading Strategies',
    readTime: '5 min',
    views: 7654,
    rating: 4.6,
    date: '2024-01-20',
    tags: ['DCA', 'investing strategy', 'beginner'],
    content: `
# Dollar-Cost Averaging (DCA)

Dollar-cost averaging is an investment strategy where you invest a fixed amount of money at regular intervals, regardless of the share price.

## How DCA Works

Instead of investing a lump sum all at once, you spread your investment over time:

**Example**: $1,200 to invest
- Lump Sum: Buy $1,200 worth in January
- DCA: Buy $100 worth each month for 12 months

## Benefits of DCA

1. **Removes Emotion**: No need to time the market
2. **Reduces Impact of Volatility**: You buy more shares when prices are low, fewer when high
3. **Easy to Implement**: Set up automatic investments
4. **Builds Discipline**: Regular investing becomes a habit
5. **Lower Average Cost**: Over time, your average cost per share may be lower

## When DCA Works Best

- Regular income investors (paycheck investing)
- Long-term investment horizons
- Volatile markets
- When you can't predict market direction

## DCA vs. Lump Sum Investing

Studies show lump sum investing beats DCA about 2/3 of the time because markets tend to rise over time. However:
- DCA reduces regret from poor timing
- DCA is practical for regular income earners
- DCA provides psychological comfort during volatile periods

## Implementing DCA

1. **Choose your investment**: Index funds are popular for DCA
2. **Set your amount**: What you can afford regularly
3. **Set your frequency**: Weekly, bi-weekly, or monthly
4. **Automate**: Set up automatic transfers
5. **Stay consistent**: Don't skip contributions

## Common DCA Platforms

Most brokerages offer automatic investment plans. Many employers offer 401(k) contributions, which are a form of DCA.

Remember: The best time to start investing was yesterday. The second best time is today.
    `
  },
  {
    id: 'esg-investing',
    title: 'Guide to ESG Investing',
    category: 'Investment Types',
    readTime: '7 min',
    views: 5432,
    rating: 4.5,
    date: '2024-02-01',
    tags: ['ESG', 'sustainable investing', 'SRI'],
    content: `
# Guide to ESG Investing

ESG (Environmental, Social, and Governance) investing is an approach that considers these factors alongside financial factors in the investment decision-making process.

## What is ESG?

### Environmental Factors
- Climate change and carbon emissions
- Air and water pollution
- Deforestation
- Energy efficiency
- Waste management
- Water scarcity

### Social Factors
- Employee relations and diversity
- Working conditions
- Local communities
- Health and safety
- Human rights
- Customer satisfaction

### Governance Factors
- Board composition
- Executive compensation
- Political contributions
- Corruption and bribery
- Shareholder rights
- Tax strategy

## Why ESG Matters

1. **Risk Management**: Companies with good ESG practices may face fewer regulatory, legal, and reputational risks
2. **Performance**: Studies suggest ESG investments can perform as well as or better than traditional investments
3. **Values Alignment**: Invest in line with your personal values
4. **Future-Proofing**: ESG-focused companies may be better positioned for long-term success

## ESG Investment Options

### ESG Mutual Funds and ETFs
- Broad ESG index funds
- Thematic funds (clean energy, water, etc.)
- Best-in-class funds

### Direct Stock Selection
- Use ESG ratings to screen companies
- Research individual company practices
- Engage with companies through shareholder advocacy

## ESG Ratings and Research

Major ESG rating providers:
- MSCI ESG Ratings
- Sustainalytics
- Bloomberg ESG
- S&P Global ESG Scores

## Getting Started with ESG

1. Define your priorities (climate, social justice, governance)
2. Research ESG funds that align with your values
3. Review holdings to ensure they meet your criteria
4. Monitor your investments and company practices
5. Consider shareholder advocacy opportunities
    `
  },
  {
    id: 'getting-started-portfolio',
    title: 'Setting Up Your First Portfolio',
    category: 'Getting Started',
    readTime: '10 min',
    views: 11234,
    rating: 4.9,
    date: '2024-01-08',
    tags: ['beginner', 'getting started', 'first portfolio'],
    content: `
# Setting Up Your First Portfolio

Starting your investment journey can feel overwhelming, but with a clear plan, you can build a solid foundation for your financial future.

## Before You Invest

### 1. Build an Emergency Fund
Before investing, have 3-6 months of expenses saved in a readily accessible account.

### 2. Pay Off High-Interest Debt
Credit card debt typically has higher interest rates than investment returns.

### 3. Define Your Goals
- What are you investing for? (retirement, house, education)
- What's your time horizon?
- What's your risk tolerance?

## Choosing Your Accounts

### Tax-Advantaged Accounts
- **401(k)**: Employer-sponsored, often with matching
- **IRA**: Individual retirement account with tax benefits
- **Roth IRA**: Tax-free growth and withdrawals

### Taxable Brokerage Account
- No contribution limits
- No withdrawal restrictions
- Ideal for medium-term goals

## Your First Investments

### Simple 3-Fund Portfolio
1. **Total US Stock Market Index Fund** (60%)
2. **Total International Stock Index Fund** (20%)
3. **Total Bond Market Index Fund** (20%)

Adjust percentages based on your age and risk tolerance.

### Target-Date Funds
One fund that automatically adjusts allocation as you age. Perfect for hands-off investors.

## Getting Started Steps

1. **Open an account**: Choose a low-cost broker
2. **Fund your account**: Start with what you can afford
3. **Choose your investments**: Start simple with index funds
4. **Set up automatic contributions**: Build the habit
5. **Rebalance annually**: Keep your allocation on track

## Common Beginner Mistakes

- Waiting too long to start
- Trying to time the market
- Checking your portfolio too often
- Panic selling during downturns
- Not diversifying enough
- Paying high fees

## Track Your Progress

Use this app to:
- Monitor your portfolio performance
- Track your asset allocation
- Set investment goals
- Review your dividend income
- Analyze your risk exposure

Remember: The best portfolio is one you can stick with long-term.
    `
  },
  {
    id: 'chart-patterns',
    title: 'Advanced Chart Pattern Recognition',
    category: 'Technical Analysis',
    readTime: '15 min',
    views: 6543,
    rating: 4.7,
    date: '2024-02-05',
    tags: ['chart patterns', 'technical analysis', 'advanced'],
    content: `
# Advanced Chart Pattern Recognition

Chart patterns are formations that appear on price charts that can signal potential future price movements.

## Reversal Patterns

### Head and Shoulders
- **Formation**: Three peaks with middle peak (head) highest
- **Signal**: Bearish reversal when price breaks neckline
- **Target**: Distance from head to neckline projected downward

### Inverse Head and Shoulders
- Opposite of head and shoulders
- Bullish reversal pattern
- Often seen at market bottoms

### Double Top / Double Bottom
- **Double Top**: Two peaks at similar price level (bearish)
- **Double Bottom**: Two troughs at similar price level (bullish)

## Continuation Patterns

### Flags and Pennants
- Short-term consolidation patterns
- Flag: Parallel channel against the trend
- Pennant: Small symmetrical triangle

### Triangles
- **Ascending**: Higher lows, flat tops (bullish)
- **Descending**: Lower highs, flat bottoms (bearish)
- **Symmetrical**: Converging trendlines (neutral)

### Wedges
- **Rising Wedge**: Converging trendlines, both sloping up (bearish)
- **Falling Wedge**: Converging trendlines, both sloping down (bullish)

## Cup and Handle

One of the most reliable bullish patterns:
1. Price forms a rounded bottom (cup)
2. Small pullback (handle)
3. Breakout above handle resistance

## Trading Chart Patterns

### Entry Points
- Wait for pattern confirmation (breakout)
- Volume should confirm the breakout
- Use limit orders for better fills

### Stop Losses
- Place below pattern support for bullish patterns
- Place above pattern resistance for bearish patterns
- Consider pattern failure zones

### Price Targets
- Measured move: Project pattern height
- Fibonacci extensions
- Previous support/resistance levels

## Important Considerations

1. **Context matters**: Patterns work better with the trend
2. **Time frame**: Patterns on higher time frames are more reliable
3. **Volume**: Should confirm the pattern
4. **Multiple confirmations**: Use other indicators
5. **Practice**: Paper trade before using real money
    `
  },
  {
    id: 'dividend-investing',
    title: 'Complete Guide to Dividend Investing',
    category: 'Investment Types',
    readTime: '11 min',
    views: 8765,
    rating: 4.8,
    date: '2024-01-25',
    tags: ['dividends', 'income investing', 'DRIP'],
    content: `
# Complete Guide to Dividend Investing

Dividend investing focuses on building a portfolio of stocks that pay regular dividends, creating a stream of passive income.

## What are Dividends?

Dividends are cash payments made by companies to shareholders, typically from profits. They represent a share of the company's earnings.

## Key Dividend Metrics

### Dividend Yield
Annual dividend per share ÷ Stock price × 100
- Higher yield = more income per dollar invested
- Very high yields may signal risk

### Dividend Payout Ratio
Dividends paid ÷ Net income × 100
- Below 60% is generally sustainable
- Above 80% may indicate future cuts

### Dividend Growth Rate
How fast the dividend has grown over time
- Look for consistent growth
- Dividend Aristocrats: 25+ years of increases

## Types of Dividend Stocks

### Dividend Aristocrats
S&P 500 companies that have increased dividends for 25+ consecutive years.

### Dividend Kings
Companies with 50+ years of consecutive dividend increases.

### REITs (Real Estate Investment Trusts)
Required to distribute 90% of taxable income as dividends.

### High-Yield Stocks
Utilities, telecoms, and mature companies often offer higher yields.

## Building a Dividend Portfolio

### Diversification
- Spread across sectors
- Mix of high yield and dividend growth
- Include international dividend payers

### Reinvestment (DRIP)
Dividend Reinvestment Plans automatically reinvest dividends to buy more shares.
- Compounds your returns
- No additional transaction costs
- Builds position over time

### When to Sell
- Dividend cut or suspension
- Fundamental business deterioration
- Payout ratio becomes unsustainable
- Better opportunities elsewhere

## Tax Considerations

### Qualified Dividends
- Taxed at capital gains rates (0%, 15%, or 20%)
- Must hold stock for 60+ days

### Non-Qualified Dividends
- Taxed as ordinary income
- Includes REITs and some foreign stocks

## Getting Started

1. Define your income goals
2. Research dividend-paying stocks
3. Check dividend history and sustainability
4. Diversify across sectors
5. Set up DRIP for reinvestment
6. Monitor your dividend income with this app
    `
  }
];

export const KnowledgeBaseView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('wealthos_kb_bookmarks');
    if (saved) {
      try {
        setBookmarkedIds(JSON.parse(saved));
      } catch {
        setBookmarkedIds([]);
      }
    }
  }, []);

  const toggleBookmark = (articleId: string) => {
    setBookmarkedIds(prev => {
      const updated = prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId];
      localStorage.setItem('wealthos_kb_bookmarks', JSON.stringify(updated));
      if (updated.includes(articleId)) {
        toast.success('Article bookmarked');
      } else {
        toast.success('Bookmark removed');
      }
      return updated;
    });
  };

  const isBookmarked = (articleId: string) => bookmarkedIds.includes(articleId);

  const bookmarkedArticles = knowledgeBaseArticles.filter(a => bookmarkedIds.includes(a.id));

  const categories = [
    { name: 'Getting Started', icon: BookOpen, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { name: 'Portfolio Management', icon: PiggyBank, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { name: 'Trading Strategies', icon: TrendingUp, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { name: 'Technical Analysis', icon: BarChart3, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
    { name: 'Risk Management', icon: Shield, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { name: 'Investment Types', icon: DollarSign, color: 'text-teal-500', bgColor: 'bg-teal-500/10' },
  ];

  const filteredArticles = knowledgeBaseArticles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const popularArticles = [...knowledgeBaseArticles].sort((a, b) => b.views - a.views).slice(0, 4);
  const recentArticles = [...knowledgeBaseArticles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  const getCategoryArticleCount = (categoryName: string) => {
    return knowledgeBaseArticles.filter(a => a.category === categoryName).length;
  };

  // Article View
  if (selectedArticle) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Knowledge Base
          </Button>
          <Button
            variant="outline"
            onClick={() => toggleBookmark(selectedArticle.id)}
            className="flex items-center gap-2"
          >
            {isBookmarked(selectedArticle.id) ? (
              <>
                <BookmarkCheck className="w-4 h-4 text-primary" />
                Bookmarked
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                Bookmark
              </>
            )}
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{selectedArticle.category}</Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {selectedArticle.readTime}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {selectedArticle.rating}
              </span>
            </div>
            <CardTitle className="text-2xl">{selectedArticle.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {selectedArticle.views.toLocaleString()} views • Published {new Date(selectedArticle.date).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {selectedArticle.content.split('\n').map((line, index) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={index} className="text-2xl font-bold mt-6 mb-4 text-foreground">{line.slice(2)}</h1>;
                  } else if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-xl font-semibold mt-5 mb-3 text-foreground">{line.slice(3)}</h2>;
                  } else if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-medium mt-4 mb-2 text-foreground">{line.slice(4)}</h3>;
                  } else if (line.startsWith('- ')) {
                    return <li key={index} className="ml-4 text-muted-foreground">{line.slice(2)}</li>;
                  } else if (line.startsWith('|')) {
                    return <code key={index} className="block text-sm bg-muted p-1 rounded">{line}</code>;
                  } else if (line.trim()) {
                    return <p key={index} className="text-muted-foreground mb-3">{line}</p>;
                  }
                  return null;
                })}
              </div>
            </ScrollArea>
            <div className="mt-6 pt-4 border-t">
              <div className="flex flex-wrap gap-2">
                {selectedArticle.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Category View
  if (selectedCategory) {
    return (
      <div className="space-y-6 p-6">
        <Button 
          variant="ghost" 
          onClick={() => setSelectedCategory(null)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Categories
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{selectedCategory}</h1>
          <p className="text-muted-foreground">{filteredArticles.length} articles</p>
        </div>

        <div className="grid gap-4">
          {filteredArticles.map((article) => (
            <Card 
              key={article.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedArticle(article)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {article.readTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {article.rating}
                      </span>
                      <span>{article.views.toLocaleString()} views</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Demo Mode:</strong> Viewing sample educational content and articles.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Knowledge Base</h1>
        <p className="text-muted-foreground">Learn everything about investing and portfolio management</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search articles, guides, and tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchQuery && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>{filteredArticles.length} articles found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredArticles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="text-primary">{article.category}</span>
                      <span>•</span>
                      <span>{article.readTime}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              ))}
              {filteredArticles.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No articles found matching your search.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories Grid */}
      {!searchQuery && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Browse by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category, index) => {
                const Icon = category.icon;
                return (
                  <Card 
                    key={index} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${category.bgColor}`}>
                          <Icon className={`w-6 h-6 ${category.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">{category.name}</h3>
                          <p className="text-sm text-muted-foreground">{getCategoryArticleCount(category.name)} articles</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="popular" className="space-y-4">
            <TabsList>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="favorites" className="flex items-center gap-1">
                <Bookmark className="w-3 h-3" />
                Favorites
                {bookmarkedIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{bookmarkedIds.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recommended">Recommended</TabsTrigger>
            </TabsList>

            <TabsContent value="popular" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Most Popular Articles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {popularArticles.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => setSelectedArticle(article)}
                        className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="text-primary">{article.category}</span>
                            <span>•</span>
                            <span>{article.readTime}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                              <span>{article.rating}</span>
                            </div>
                            <span>•</span>
                            <span>{article.views.toLocaleString()} views</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recent" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recently Added</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentArticles.map((article) => (
                      <div
                        key={article.id}
                        onClick={() => setSelectedArticle(article)}
                        className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{article.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="text-primary">{article.category}</span>
                            <span>•</span>
                            <span>{new Date(article.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="favorites" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookmarkCheck className="w-5 h-5 text-primary" />
                    Your Bookmarked Articles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bookmarkedArticles.length > 0 ? (
                    <div className="space-y-4">
                      {bookmarkedArticles.map((article) => (
                        <div
                          key={article.id}
                          className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <div className="flex-1" onClick={() => setSelectedArticle(article)}>
                            <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="text-primary">{article.category}</span>
                              <span>•</span>
                              <span>{article.readTime}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(article.id);
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Bookmark className="w-4 h-4 fill-current" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Bookmark className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No bookmarked articles yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Click the bookmark icon on any article to save it here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommended" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5" />
                    Recommended for You
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {knowledgeBaseArticles.slice(0, 4).map((article) => (
                      <div
                        key={article.id}
                        onClick={() => setSelectedArticle(article)}
                        className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="text-primary">{article.category}</span>
                            <span>•</span>
                            <span>{article.readTime}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setSelectedCategory('Getting Started')}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Getting Started Guide
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setSelectedCategory('Trading Strategies')}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Trading Strategies
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setSelectedCategory('Investment Types')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Investment Guides
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setSelectedCategory('Technical Analysis')}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Technical Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
