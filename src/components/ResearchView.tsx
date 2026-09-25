import { useState, useEffect } from 'react';
import { Search, TrendingUp, ExternalLink, BookOpen, Video, FileText, LineChart, Sparkles, Activity, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { HistoricalPriceChart } from './HistoricalPriceChart';
import { TechnicalPriceChart } from './TechnicalPriceChart';
import { StockQualityAnalysis } from './StockQualityAnalysis';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { useAuth } from '@/context/AuthContext';

export const ResearchView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [searchQuery, setSearchQuery] = useState('');
  const { activePortfolio, selectedResearchSymbol } = usePortfolio();
  const [selectedSymbol, setSelectedSymbol] = useState<string>(cleanSymbol(selectedResearchSymbol) || 'AAPL');

  // Update local state when context changes (e.g., when user clicks arrow in holdings)
  useEffect(() => {
    if (selectedResearchSymbol) {
      setSelectedSymbol(cleanSymbol(selectedResearchSymbol));
    }
  }, [selectedResearchSymbol]);

  const popularSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BTC', 'ETH'];
  const holdingSymbols = activePortfolio?.holdings?.map(h => cleanSymbol(h.symbol)) || [];

  const trendingTopics = [
    { title: 'AI & Machine Learning Stocks', growth: '+45%', articles: 234 },
    { title: 'Renewable Energy Sector', growth: '+32%', articles: 189 },
    { title: 'Cryptocurrency Market Analysis', growth: '+28%', articles: 456 },
    { title: 'Healthcare Innovation', growth: '+24%', articles: 167 },
    { title: 'EV & Battery Technology', growth: '+21%', articles: 145 },
  ];

  const educationalContent = [
    {
      type: 'article',
      title: 'Understanding Portfolio Diversification',
      category: 'Basics',
      duration: '5 min read',
      icon: FileText,
    },
    {
      type: 'video',
      title: 'Technical Analysis for Beginners',
      category: 'Trading',
      duration: '12 min watch',
      icon: Video,
    },
    {
      type: 'guide',
      title: 'Complete Guide to Dividend Investing',
      category: 'Income',
      duration: '15 min read',
      icon: BookOpen,
    },
    {
      type: 'article',
      title: 'Risk Management Strategies',
      category: 'Advanced',
      duration: '8 min read',
      icon: FileText,
    },
  ];

  const marketNews = [
    {
      title: 'Federal Reserve Signals Rate Adjustment',
      source: 'Financial Times',
      time: '2 hours ago',
      impact: 'high',
    },
    {
      title: 'Tech Giants Report Strong Earnings',
      source: 'Wall Street Journal',
      time: '4 hours ago',
      impact: 'medium',
    },
    {
      title: 'Oil Prices Surge on Supply Concerns',
      source: 'Bloomberg',
      time: '6 hours ago',
      impact: 'medium',
    },
    {
      title: 'New Trade Deal Boosts Market Sentiment',
      source: 'Reuters',
      time: '8 hours ago',
      impact: 'low',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Demo Mode:</strong> Viewing sample research data and educational content.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Research & Education</h1>
        <p className="text-muted-foreground">Stay informed and grow your investing knowledge</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for stocks, topics, or educational content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="quality" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="quality">Stock Quality</TabsTrigger>
          <TabsTrigger value="charts">Price Charts</TabsTrigger>
          <TabsTrigger value="technical">Technical Analysis</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
          <TabsTrigger value="education">Education</TabsTrigger>
          <TabsTrigger value="news">Market News</TabsTrigger>
        </TabsList>

        {/* Stock Quality Analysis Tab */}
        <TabsContent value="quality" className="space-y-4">
          <StockQualityAnalysis />
        </TabsContent>

        {/* Price Charts Tab */}
        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Historical Price Chart
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a symbol" />
                    </SelectTrigger>
                    <SelectContent>
                      {holdingSymbols.length > 0 && (
                        <>
                          <SelectItem value="__holdings_header" disabled>Your Holdings</SelectItem>
                          {holdingSymbols.map(symbol => (
                            <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                          ))}
                        </>
                      )}
                      <SelectItem value="__popular_header" disabled>Popular Symbols</SelectItem>
                      {popularSymbols.filter(s => !holdingSymbols.includes(s)).map(symbol => (
                        <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {popularSymbols.slice(0, 5).map(symbol => (
                    <Button
                      key={symbol}
                      variant={selectedSymbol === symbol ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSymbol(symbol)}
                    >
                      {symbol}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <HistoricalPriceChart symbol={selectedSymbol} />
        </TabsContent>

        {/* Technical Analysis Tab */}
        <TabsContent value="technical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Technical Analysis with Indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a symbol" />
                    </SelectTrigger>
                    <SelectContent>
                      {holdingSymbols.length > 0 && (
                        <>
                          <SelectItem value="__holdings_header" disabled>Your Holdings</SelectItem>
                          {holdingSymbols.map(symbol => (
                            <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                          ))}
                        </>
                      )}
                      <SelectItem value="__popular_header" disabled>Popular Symbols</SelectItem>
                      {popularSymbols.filter(s => !holdingSymbols.includes(s)).map(symbol => (
                        <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {popularSymbols.slice(0, 5).map(symbol => (
                    <Button
                      key={symbol}
                      variant={selectedSymbol === symbol ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSymbol(symbol)}
                    >
                      {symbol}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                View price action with technical indicators including SMA, Bollinger Bands, and RSI to identify trends and potential entry/exit points.
              </p>
            </CardContent>
          </Card>
          
          <TechnicalPriceChart symbol={selectedSymbol} />
        </TabsContent>

        {/* Trending Topics */}
        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Trending Research Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trendingTopics.map((topic, index) => {
                  const url = `https://www.google.com/search?q=${encodeURIComponent(`${topic.title} investing`)}`;

                  return (
                    <div
                      key={index}
                      role="button"
                      tabIndex={0}
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">{topic.title}</h3>
                        <p className="text-sm text-muted-foreground">{topic.articles} articles available</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-green-500 font-semibold">{topic.growth}</span>
                        <ExternalLink className="w-5 h-5 text-muted-foreground" aria-label="Open topic" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Educational Content */}
        <TabsContent value="education" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Educational Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {educationalContent.map((content, index) => {
                  const Icon = content.icon;
                  const url = `https://www.google.com/search?q=${encodeURIComponent(content.title)}`;

                  return (
                    <div
                      key={index}
                      role="button"
                      tabIndex={0}
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                              {content.category}
                            </span>
                            <span className="text-xs text-muted-foreground">{content.duration}</span>
                          </div>
                          <h3 className="font-semibold text-foreground">{content.title}</h3>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        Start Learning
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Learning Path */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Learning Path</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((level, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{level} Level</div>
                      <div className="text-sm text-muted-foreground">
                        {index === 0 && 'Investment basics and portfolio fundamentals'}
                        {index === 1 && 'Technical analysis and risk management'}
                        {index === 2 && 'Advanced strategies and options trading'}
                        {index === 3 && 'Algorithmic trading and market dynamics'}
                      </div>
                    </div>
                    <Button variant={index === 0 ? 'default' : 'outline'} size="sm">
                      {index === 0 ? 'Start' : 'Locked'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Market News */}
        <TabsContent value="news" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Latest Market News</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketNews.map((news, index) => {
                  const url = `https://news.google.com/search?q=${encodeURIComponent(news.title)}`;

                  return (
                    <div
                      key={index}
                      role="button"
                      tabIndex={0}
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div
                        className={`mt-1 w-2 h-2 rounded-full ${
                          news.impact === 'high'
                            ? 'bg-red-500'
                            : news.impact === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{news.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{news.source}</span>
                          <span>•</span>
                          <span>{news.time}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-5 h-5 text-muted-foreground flex-shrink-0" aria-label="Open news" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};