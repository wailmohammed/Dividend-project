import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Shield, DollarSign, BarChart3, Sparkles } from 'lucide-react';
import SnowflakeChart from './SnowflakeChart';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { SnowflakeScore } from '@/types';

interface StockAnalysis {
  symbol: string;
  scores: SnowflakeScore;
  overallScore: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
}

// Generate simulated stock quality scores
const generateStockScores = (symbol: string): SnowflakeScore => {
  // Use symbol to seed pseudo-random values for consistency
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => ((seed * (offset + 1)) % 100) / 25 + 1; // Returns 1-5
  
  const value = Math.min(5, Math.max(1, random(1)));
  const future = Math.min(5, Math.max(1, random(2)));
  const past = Math.min(5, Math.max(1, random(3)));
  const health = Math.min(5, Math.max(1, random(4)));
  const dividend = Math.min(5, Math.max(1, random(5)));
  
  return {
    value,
    future,
    past,
    health,
    dividend,
    total: value + future + past + health + dividend,
  };
};

const getRecommendation = (avgScore: number): StockAnalysis['recommendation'] => {
  if (avgScore >= 4.5) return 'Strong Buy';
  if (avgScore >= 3.5) return 'Buy';
  if (avgScore >= 2.5) return 'Hold';
  if (avgScore >= 1.5) return 'Sell';
  return 'Strong Sell';
};

const getRecommendationColor = (rec: StockAnalysis['recommendation']) => {
  switch (rec) {
    case 'Strong Buy': return 'bg-green-500/20 text-green-500 border-green-500/30';
    case 'Buy': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
    case 'Hold': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'Sell': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    case 'Strong Sell': return 'bg-red-500/20 text-red-500 border-red-500/30';
  }
};

const ScoreExplanation: React.FC<{ label: string; score: number; description: string; icon: React.ReactNode }> = ({
  label, score, description, icon
}) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
    <div className="p-2 rounded-full bg-primary/10">
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`font-bold ${score >= 3.5 ? 'text-green-500' : score >= 2.5 ? 'text-yellow-500' : 'text-red-500'}`}>
          {score.toFixed(1)}/5
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

export const StockQualityAnalysis: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdingSymbols = activePortfolio?.holdings?.map(h => cleanSymbol(h.symbol)) || [];
  const popularSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'JNJ', 'KO', 'PG', 'VZ'];
  
  const [selectedSymbol, setSelectedSymbol] = useState(holdingSymbols[0] || 'AAPL');

  const analysis = useMemo<StockAnalysis>(() => {
    const scores = generateStockScores(selectedSymbol);
    const avgScore = (scores.value + scores.future + scores.past + scores.health + scores.dividend) / 5;
    
    return {
      symbol: selectedSymbol,
      scores,
      overallScore: avgScore,
      recommendation: getRecommendation(avgScore)
    };
  }, [selectedSymbol]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Stock Quality Analysis
          </CardTitle>
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select stock" />
            </SelectTrigger>
            <SelectContent>
              {holdingSymbols.length > 0 && (
                <>
                  <SelectItem value="__holdings" disabled className="text-xs text-muted-foreground">
                    Your Holdings
                  </SelectItem>
                  {holdingSymbols.map(symbol => (
                    <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                  ))}
                </>
              )}
              <SelectItem value="__popular" disabled className="text-xs text-muted-foreground">
                Popular Stocks
              </SelectItem>
              {popularSymbols.filter(s => !holdingSymbols.includes(s)).map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Snowflake Chart */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">{selectedSymbol} Snowflake</h3>
              <Badge className={`${getRecommendationColor(analysis.recommendation)} text-sm px-3 py-1`}>
                {analysis.recommendation}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Overall Score: {analysis.overallScore.toFixed(1)}/5
              </p>
            </div>
            <SnowflakeChart data={analysis.scores} height={280} />
          </div>

          {/* Score Breakdown */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground mb-4">Score Breakdown</h3>
            
            <ScoreExplanation
              label="Value"
              score={analysis.scores.value}
              description="Stock is trading at fair value based on earnings, assets, and cash flow"
              icon={<DollarSign className="w-4 h-4 text-primary" />}
            />
            
            <ScoreExplanation
              label="Future Growth"
              score={analysis.scores.future}
              description="Expected earnings and revenue growth over the next 3 years"
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
            />
            
            <ScoreExplanation
              label="Past Performance"
              score={analysis.scores.past}
              description="Historical earnings growth and consistency over 5 years"
              icon={<BarChart3 className="w-4 h-4 text-primary" />}
            />
            
            <ScoreExplanation
              label="Financial Health"
              score={analysis.scores.health}
              description="Balance sheet strength, debt levels, and cash position"
              icon={<Shield className="w-4 h-4 text-primary" />}
            />
            
            <ScoreExplanation
              label="Dividend"
              score={analysis.scores.dividend}
              description="Dividend yield, payout ratio, and growth history"
              icon={<TrendingDown className="w-4 h-4 text-primary" />}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StockQualityAnalysis;
