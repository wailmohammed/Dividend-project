import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { addDays, format, subDays } from 'date-fns';
import { 
  Info, ArrowRight, Calendar, Clock, TrendingUp, DollarSign, 
  AlertTriangle, MousePointerClick, Timer, ShoppingCart, ArrowDownUp,
  CheckCircle2, XCircle
} from 'lucide-react';

interface CaptureOpportunity {
  symbol: string;
  name: string;
  currentPrice: number;
  dividendYield: number;
  exDate: Date;
  payDate: Date;
  purchaseDate: Date;
  sellDate: Date;
  dividendAmount: number;
  captureYield: number;
  recoveryDays: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export const DividendCaptureStrategy: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<CaptureOpportunity | null>(null);

  // Generate capture opportunities from holdings with dividend yield
  const opportunities = useMemo((): CaptureOpportunity[] => {
    const holdings = activePortfolio?.holdings || [];
    const today = new Date();
    
    return holdings
      .filter(h => (h.dividendYield || 0) > 0)
      .map(h => {
        const dividendYield = h.dividendYield || 0;
        const currentPrice = h.currentPrice || h.avgPrice || 0;
        const quarterlyYield = dividendYield / 4;
        const dividendAmount = (currentPrice * quarterlyYield) / 100;
        
        // Simulate ex-date (randomly 5-25 days from now for demo)
        const daysUntilEx = 5 + Math.floor((h.symbol.charCodeAt(0) % 20));
        const exDate = addDays(today, daysUntilEx);
        const purchaseDate = subDays(exDate, 1);
        
        // Recovery time based on symbol (2-12 days for demo)
        const recoveryDays = 2 + (h.symbol.charCodeAt(0) % 10);
        const sellDate = addDays(exDate, recoveryDays);
        const payDate = addDays(exDate, 30); // Typically ~30 days after ex-date
        
        // Risk assessment based on yield and recovery time
        let riskLevel: 'low' | 'medium' | 'high' = 'medium';
        if (dividendYield > 6 || recoveryDays > 8) riskLevel = 'high';
        if (dividendYield < 3 && recoveryDays < 5) riskLevel = 'low';
        
        return {
          symbol: cleanSymbol(h.symbol),
          name: h.name,
          currentPrice,
          dividendYield,
          exDate,
          payDate,
          purchaseDate,
          sellDate,
          dividendAmount,
          captureYield: quarterlyYield,
          recoveryDays,
          riskLevel,
        };
      })
      .sort((a, b) => a.exDate.getTime() - b.exDate.getTime());
  }, [activePortfolio?.holdings]);

  const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Low Risk</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Medium Risk</Badge>;
      case 'high':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">High Risk</Badge>;
    }
  };

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Capture Opportunities</h3>
          <p className="text-muted-foreground">
            Add dividend-paying stocks to your portfolio to see capture opportunities.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5 text-primary" />
                Dividend Capture Strategy
              </CardTitle>
              <CardDescription>
                Buy before ex-dividend date, sell after price recovers
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowInfoModal(true)}>
              <Info className="w-4 h-4 mr-2" />
              How It Works
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Important Disclaimer</p>
              <p className="text-xs opacity-90">
                Dividend capture involves significant timing risk and tax implications. 
                Non-qualified dividends may be taxed at higher rates. Past recovery patterns don't guarantee future results.
              </p>
            </div>
          </div>

          {/* Upcoming Opportunities */}
          <div className="space-y-3">
            {opportunities.slice(0, 5).map((opp) => (
              <div
                key={opp.symbol}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedOpportunity(opp)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-bold text-lg">{opp.symbol}</span>
                      <span className="text-muted-foreground text-sm ml-2">{opp.name}</span>
                    </div>
                    {getRiskBadge(opp.riskLevel)}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Capture Yield</div>
                    <div className="font-bold text-emerald-500">{opp.captureYield.toFixed(2)}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Ex-Date</div>
                    <div className="font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      {format(opp.exDate, 'MMM d')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Dividend</div>
                    <div className="font-semibold flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-emerald-500" />
                      {opp.dividendAmount.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Recovery</div>
                    <div className="font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      ~{opp.recoveryDays} days
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Annual Yield</div>
                    <div className="font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      {opp.dividendYield.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Strategy Detail Modal */}
      <Dialog open={!!selectedOpportunity} onOpenChange={() => setSelectedOpportunity(null)}>
        <DialogContent className="max-w-2xl">
          {selectedOpportunity && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Capture Strategy for{' '}
                  <span className="text-primary">{selectedOpportunity.symbol}</span>
                </DialogTitle>
                <DialogDescription>
                  Estimated dividend: ${selectedOpportunity.dividendAmount.toFixed(2)} per share
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Timeline */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Step 1: Buy */}
                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Step 1: Buy Before Ex-Date
                    </h4>
                    <div className="bg-emerald-500 rounded-xl p-5 text-white shadow-lg">
                      <div className="text-xs font-medium opacity-90 mb-1">PURCHASE DATE</div>
                      <div className="text-2xl font-bold mb-4">
                        {format(selectedOpportunity.purchaseDate, 'MMM d, yyyy')}
                      </div>
                      <div className="border-t border-white/20 pt-3 flex justify-between items-center text-sm">
                        <span className="opacity-90">Ex-Dividend Date</span>
                        <span className="font-bold">{format(selectedOpportunity.exDate, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Sell */}
                  <div>
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      Step 2: Sell After Recovery
                    </h4>
                    <div className="bg-card border rounded-xl p-5 shadow-sm">
                      <div className="text-xs text-muted-foreground font-bold mb-1">SELL DATE (EST.)</div>
                      <div className="text-2xl font-bold mb-4">
                        {format(selectedOpportunity.sellDate, 'MMM d, yyyy')}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Avg Recovery</div>
                          <div className="font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-primary" />
                            {selectedOpportunity.recoveryDays} Days
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Capture Yield</div>
                          <div className="font-bold text-emerald-500 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {selectedOpportunity.captureYield.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expected Return */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Expected Returns (Per 100 Shares)</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Investment</div>
                      <div className="font-bold">${(selectedOpportunity.currentPrice * 100).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Dividend Income</div>
                      <div className="font-bold text-emerald-500">
                        ${(selectedOpportunity.dividendAmount * 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Capture Return</div>
                      <div className="font-bold text-primary">
                        {selectedOpportunity.captureYield.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Warning */}
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-amber-700 dark:text-amber-400">
                    Stock prices typically drop by approximately the dividend amount on the ex-date. 
                    Recovery time varies and is not guaranteed. Consider transaction costs and tax implications.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Info Modal */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>What's Dividend Capture Strategy?</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 text-sm">
            {/* Process Icons */}
            <div className="flex justify-between items-center gap-2 px-2">
              <div className="flex flex-col items-center text-center gap-2 flex-1">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <MousePointerClick className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-bold">Select Stock</span>
              </div>
              <div className="h-px bg-border flex-1"></div>
              <div className="flex flex-col items-center text-center gap-2 flex-1">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative">
                  <Timer className="w-6 h-6 text-primary" />
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold px-1 rounded-full">
                    24h
                  </span>
                </div>
                <span className="text-xs font-bold">Buy Before Ex-Date</span>
              </div>
              <div className="h-px bg-border flex-1"></div>
              <div className="flex flex-col items-center text-center gap-2 flex-1">
                <div className="bg-emerald-500/10 px-3 py-2 rounded-lg text-emerald-600 font-bold">
                  SELL
                </div>
                <span className="text-xs font-bold">Sell on Recovery</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-2">Strategy Overview</h4>
              <p className="text-muted-foreground">
                Dividend capture is an investing technique that involves purchasing a stock just before 
                the stock goes ex-dividend so that the investor can collect the dividend, then selling 
                shortly after.
              </p>
            </div>

            <div className="bg-muted/50 p-4 rounded-xl">
              <h4 className="font-bold mb-2">The Key: Recovery Time</h4>
              <p className="text-muted-foreground">
                The best way to execute the dividend capture strategy is to find stocks that recover 
                quickly after the dividend amount is deducted from their price. Proper timing is 
                essential to minimize holding risk.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-600 font-bold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Pros
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Quick dividend income</li>
                  <li>• Low capital commitment</li>
                  <li>• Multiple opportunities/year</li>
                </ul>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 font-bold mb-1">
                  <XCircle className="w-4 h-4" />
                  Cons
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Timing risk</li>
                  <li>• Transaction costs</li>
                  <li>• Tax inefficient</li>
                </ul>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DividendCaptureStrategy;
