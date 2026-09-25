import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { usePortfolio } from '@/context/PortfolioContext';
import { GitBranch, AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Shuffle, BarChart2 } from 'lucide-react';

interface CorrelationData {
  symbol1: string;
  symbol2: string;
  correlation: number;
}

// Generate mock correlation data based on holdings
const generateCorrelationMatrix = (holdings: any[]): { 
  matrix: number[][]; 
  symbols: string[];
  correlations: CorrelationData[];
} => {
  const symbols = holdings.slice(0, 15).map(h => h.symbol?.replace('.US', '').toUpperCase());
  const n = symbols.length;
  const matrix: number[][] = [];
  const correlations: CorrelationData[] = [];

  // Sector-based correlation patterns
  const sectorCorrelations: Record<string, Record<string, number>> = {
    'Technology': { 'Technology': 0.8, 'Communication Services': 0.6, 'Consumer Discretionary': 0.5, 'Financials': 0.3 },
    'Financials': { 'Financials': 0.75, 'Real Estate': 0.5, 'Energy': 0.4, 'Technology': 0.3 },
    'Healthcare': { 'Healthcare': 0.7, 'Consumer Staples': 0.4, 'Technology': 0.3 },
    'Consumer Staples': { 'Consumer Staples': 0.7, 'Healthcare': 0.4, 'Utilities': 0.5 },
    'Energy': { 'Energy': 0.85, 'Materials': 0.6, 'Industrials': 0.5 },
    'Real Estate': { 'Real Estate': 0.8, 'Financials': 0.5, 'Utilities': 0.4 },
    'Utilities': { 'Utilities': 0.75, 'Real Estate': 0.4, 'Consumer Staples': 0.4 },
  };

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i];
      } else {
        // Generate correlation based on sectors or random if not defined
        const sector1 = holdings[i]?.sector || 'Other';
        const sector2 = holdings[j]?.sector || 'Other';
        
        let baseCorrelation = 0.3;
        if (sector1 === sector2) {
          baseCorrelation = sectorCorrelations[sector1]?.[sector1] || 0.7;
        } else {
          baseCorrelation = sectorCorrelations[sector1]?.[sector2] || 
                           sectorCorrelations[sector2]?.[sector1] || 
                           0.2 + Math.random() * 0.4;
        }
        
        // Add some randomness
        const correlation = Math.max(-1, Math.min(1, baseCorrelation + (Math.random() - 0.5) * 0.3));
        matrix[i][j] = Number(correlation.toFixed(2));
        
        correlations.push({
          symbol1: symbols[i],
          symbol2: symbols[j],
          correlation: matrix[i][j]
        });
      }
    }
  }

  return { matrix, symbols, correlations };
};

const getCorrelationColor = (value: number): string => {
  if (value >= 0.7) return 'bg-red-500';
  if (value >= 0.5) return 'bg-orange-500';
  if (value >= 0.3) return 'bg-yellow-500';
  if (value >= 0) return 'bg-green-500';
  if (value >= -0.3) return 'bg-cyan-500';
  if (value >= -0.5) return 'bg-blue-500';
  return 'bg-purple-500';
};

const getCorrelationLabel = (value: number): string => {
  if (value >= 0.7) return 'High Positive';
  if (value >= 0.5) return 'Moderate Positive';
  if (value >= 0.3) return 'Low Positive';
  if (value >= 0) return 'Negligible';
  if (value >= -0.3) return 'Low Negative';
  if (value >= -0.5) return 'Moderate Negative';
  return 'High Negative';
};

export const CorrelationMatrix = () => {
  const { activePortfolio } = usePortfolio();
  const [sortBy, setSortBy] = useState<'symbol' | 'correlation'>('correlation');
  const [filterThreshold, setFilterThreshold] = useState<string>('all');

  const holdings = activePortfolio?.holdings || [];
  
  const { matrix, symbols, correlations } = useMemo(
    () => generateCorrelationMatrix(holdings), 
    [holdings]
  );

  const sortedCorrelations = useMemo(() => {
    let filtered = [...correlations];
    
    // Apply threshold filter
    if (filterThreshold === 'high') {
      filtered = filtered.filter(c => Math.abs(c.correlation) >= 0.7);
    } else if (filterThreshold === 'moderate') {
      filtered = filtered.filter(c => Math.abs(c.correlation) >= 0.5);
    } else if (filterThreshold === 'low') {
      filtered = filtered.filter(c => Math.abs(c.correlation) < 0.3);
    }
    
    // Sort
    if (sortBy === 'correlation') {
      filtered.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    } else {
      filtered.sort((a, b) => a.symbol1.localeCompare(b.symbol1));
    }
    
    return filtered;
  }, [correlations, sortBy, filterThreshold]);

  // Calculate portfolio diversification metrics
  const diversificationMetrics = useMemo(() => {
    if (correlations.length === 0) return { avgCorrelation: 0, highCorrelationPairs: 0, diversificationScore: 100 };
    
    const avgCorrelation = correlations.reduce((sum, c) => sum + Math.abs(c.correlation), 0) / correlations.length;
    const highCorrelationPairs = correlations.filter(c => Math.abs(c.correlation) >= 0.7).length;
    const totalPairs = correlations.length;
    
    // Diversification score: lower average correlation = better diversification
    const diversificationScore = Math.max(0, Math.min(100, (1 - avgCorrelation) * 100));
    
    return { avgCorrelation, highCorrelationPairs, totalPairs, diversificationScore };
  }, [correlations]);

  if (holdings.length < 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GitBranch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Need More Holdings</h3>
          <p className="text-muted-foreground">Add at least 2 holdings to see correlation analysis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-primary" />
          Portfolio Correlation Matrix
        </h2>
        <p className="text-muted-foreground">Understand how your holdings move together</p>
      </div>

      {/* Diversification Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`${diversificationMetrics.diversificationScore >= 70 ? 'border-emerald-500/30 bg-emerald-500/5' : diversificationMetrics.diversificationScore >= 50 ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Diversification Score</p>
                <p className="text-3xl font-bold">{diversificationMetrics.diversificationScore.toFixed(0)}</p>
              </div>
              {diversificationMetrics.diversificationScore >= 70 ? (
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              ) : diversificationMetrics.diversificationScore >= 50 ? (
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Correlation</p>
                <p className="text-2xl font-bold">{diversificationMetrics.avgCorrelation.toFixed(2)}</p>
              </div>
              <BarChart2 className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Correlation Pairs</p>
                <p className="text-2xl font-bold text-orange-500">{diversificationMetrics.highCorrelationPairs}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pairs Analyzed</p>
                <p className="text-2xl font-bold">{diversificationMetrics.totalPairs}</p>
              </div>
              <Shuffle className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            Correlation Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {[
              { range: '0.7 to 1.0', label: 'High Positive', color: 'bg-red-500', meaning: 'Move together strongly' },
              { range: '0.5 to 0.7', label: 'Moderate Positive', color: 'bg-orange-500', meaning: 'Often move together' },
              { range: '0.3 to 0.5', label: 'Low Positive', color: 'bg-yellow-500', meaning: 'Slight tendency together' },
              { range: '0 to 0.3', label: 'Negligible', color: 'bg-green-500', meaning: 'Little relationship' },
              { range: '-0.3 to 0', label: 'Low Negative', color: 'bg-cyan-500', meaning: 'Slight inverse tendency' },
              { range: '-0.5 to -0.3', label: 'Moderate Negative', color: 'bg-blue-500', meaning: 'Often move opposite' },
              { range: '-1.0 to -0.5', label: 'High Negative', color: 'bg-purple-500', meaning: 'Move opposite strongly' },
            ].map(item => (
              <TooltipProvider key={item.label}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50">
                      <div className={`w-3 h-3 rounded ${item.color}`} />
                      <span className="text-xs">{item.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.range}: {item.meaning}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Correlation Matrix Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Correlation Heatmap</CardTitle>
          <CardDescription>Hover over cells to see correlation values</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-fit">
            <div className="flex">
              <div className="w-16" />
              {symbols.map(symbol => (
                <div key={`header-${symbol}`} className="w-12 text-center">
                  <span className="text-xs font-medium transform -rotate-45 inline-block origin-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    {symbol}
                  </span>
                </div>
              ))}
            </div>
            {symbols.map((symbol, i) => (
              <div key={`row-${symbol}`} className="flex items-center">
                <div className="w-16 text-xs font-medium truncate pr-2">{symbol}</div>
                {matrix[i]?.map((correlation, j) => (
                  <TooltipProvider key={`cell-${i}-${j}`}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          className={`w-12 h-8 flex items-center justify-center text-xs text-white font-medium ${getCorrelationColor(correlation)} ${i === j ? 'opacity-50' : ''}`}
                        >
                          {correlation.toFixed(1)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">{symbols[i]} ↔ {symbols[j]}</p>
                        <p>Correlation: {correlation.toFixed(3)}</p>
                        <p className="text-xs text-muted-foreground">{getCorrelationLabel(correlation)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Correlation Pairs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Correlation Pairs</CardTitle>
              <CardDescription>Detailed view of asset correlations</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterThreshold} onValueChange={setFilterThreshold}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pairs</SelectItem>
                  <SelectItem value="high">High (≥0.7)</SelectItem>
                  <SelectItem value="moderate">Moderate (≥0.5)</SelectItem>
                  <SelectItem value="low">Low (&lt;0.3)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === 'correlation' ? 'symbol' : 'correlation')}
              >
                Sort: {sortBy === 'correlation' ? 'Correlation' : 'Symbol'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {sortedCorrelations.slice(0, 50).map((pair, index) => (
              <div
                key={`${pair.symbol1}-${pair.symbol2}-${index}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getCorrelationColor(pair.correlation)}`} />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pair.symbol1}</Badge>
                    <span className="text-muted-foreground">↔</span>
                    <Badge variant="outline">{pair.symbol2}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{getCorrelationLabel(pair.correlation)}</span>
                  <span className={`font-bold ${pair.correlation >= 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                    {pair.correlation.toFixed(3)}
                  </span>
                  {pair.correlation >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-orange-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-blue-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Diversification Recommendations */}
      {diversificationMetrics.highCorrelationPairs > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              Diversification Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedCorrelations.filter(c => c.correlation >= 0.7).slice(0, 5).map((pair, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>{pair.symbol1}</strong> and <strong>{pair.symbol2}</strong> have high correlation ({pair.correlation.toFixed(2)}). 
                    Consider reducing exposure to one of these.
                  </span>
                </div>
              ))}
              {sortedCorrelations.filter(c => c.correlation >= 0.7).length > 5 && (
                <p className="text-sm text-muted-foreground mt-2">
                  +{sortedCorrelations.filter(c => c.correlation >= 0.7).length - 5} more highly correlated pairs
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CorrelationMatrix;
