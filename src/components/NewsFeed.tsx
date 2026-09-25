import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus, RefreshCcw, Clock, Filter, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relatedSymbols: string[];
  category: string;
  image?: string;
}

export const NewsFeed: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'portfolio' | 'positive' | 'negative'>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');

  // Get unique symbols from portfolio
  const portfolioSymbols = useMemo(() => {
    return activePortfolio?.holdings?.map(h => h.symbol) || [];
  }, [activePortfolio]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-news', {
        body: { symbols: portfolioSymbols }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to fetch news');
      }

      if (data?.error) {
        setError(data.error);
        setNews([]);
      } else if (data?.news) {
        setNews(data.news);
      }
    } catch (err: any) {
      console.error('Error fetching news:', err);
      setError(err.message || 'Failed to fetch news');
      toast.error('Failed to fetch news');
    } finally {
      setLoading(false);
    }
  }, [portfolioSymbols]);

  useEffect(() => {
    fetchNews();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Filter news
  const filteredNews = useMemo(() => {
    return news.filter(item => {
      if (filter === 'portfolio' && item.relatedSymbols.length === 0) return false;
      if (filter === 'positive' && item.sentiment !== 'positive') return false;
      if (filter === 'negative' && item.sentiment !== 'negative') return false;
      if (selectedSymbol !== 'all' && !item.relatedSymbols.includes(selectedSymbol)) return false;
      return true;
    });
  }, [news, filter, selectedSymbol]);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'negative': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'negative': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Newspaper className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Market News</h2>
            <p className="text-sm text-muted-foreground">Real-time news related to your holdings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All News</SelectItem>
              <SelectItem value="portfolio">My Holdings</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Symbols</SelectItem>
              {portfolioSymbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchNews} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-foreground font-medium">Failed to load news</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* News Sentiment Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-emerald-500">
                {news.filter(n => n.sentiment === 'positive').length}
              </p>
              <p className="text-sm text-muted-foreground">Positive</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500/50" />
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-border">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-muted-foreground">
                {news.filter(n => n.sentiment === 'neutral').length}
              </p>
              <p className="text-sm text-muted-foreground">Neutral</p>
            </div>
            <Minus className="w-8 h-8 text-muted-foreground/50" />
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-red-500">
                {news.filter(n => n.sentiment === 'negative').length}
              </p>
              <p className="text-sm text-muted-foreground">Negative</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500/50" />
          </CardContent>
        </Card>
      </div>

      {/* News List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-4 bg-muted rounded w-full mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNews.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Newspaper className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">No news found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredNews.map(item => (
            <Card key={item.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getSentimentIcon(item.sentiment)}
                      <Badge variant="outline" className={getSentimentColor(item.sentiment)}>
                        {item.sentiment}
                      </Badge>
                      <Badge variant="outline">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.publishedAt)}
                      </span>
                    </div>
                    <h3 
                      className="font-semibold text-foreground mb-2 hover:text-primary cursor-pointer"
                      onClick={() => item.url && window.open(item.url, '_blank')}
                    >
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">{item.summary}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{item.source}</span>
                        {item.relatedSymbols.length > 0 && (
                          <div className="flex gap-1">
                            {item.relatedSymbols.map(symbol => (
                              <Badge key={symbol} variant="secondary" className="text-xs">
                                ${symbol}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => item.url && window.open(item.url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Read More
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default NewsFeed;
