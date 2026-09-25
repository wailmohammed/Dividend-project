import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, TrendingUp, Calendar, DollarSign, AlertCircle, CheckCircle, Sparkles, Bell, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { useTaxLots } from '@/hooks/useTaxLots';
import { useStockPrices } from '@/hooks/useStockPrices';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, addDays, subDays } from 'date-fns';

interface LotAnalysis {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  unrealizedLoss: number;
  purchaseDate: Date;
  daysHeld: number;
  daysToLongTerm: number;
  longTermDate: Date;
  estimatedShortTermTax: number;
  estimatedLongTermTax: number;
  taxSavingsIfWait: number;
  progressToLongTerm: number;
  recommendation: 'wait' | 'harvest_now' | 'already_long_term';
  recommendationReason: string;
  washSaleRisk: boolean;
  recentSaleDate?: Date;
}

// 2024 Tax rates
const SHORT_TERM_RATE = 0.35; // Assume 35% marginal rate
const LONG_TERM_RATE = 0.20; // 20% for high earners

export const TaxBracketOptimizer: React.FC = () => {
  const { taxLots } = useTaxLots();
  const { activePortfolio } = usePortfolio();
  const { user } = useAuth();
  const { toast } = useToast();
  const symbols = useMemo(() => [...new Set(taxLots.map(l => l.symbol))], [taxLots]);
  const { prices } = useStockPrices(symbols);
  const [testingNotification, setTestingNotification] = useState(false);
  
  const isDemoMode = !user || user.id === 'demo-user';

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    prices.forEach(p => {
      map[p.symbol] = p.price;
    });
    return map;
  }, [prices]);

  // Detect recent sales for wash sale risk
  const recentSales = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);
    
    return taxLots
      .filter(lot => lot.is_closed && lot.sale_date)
      .filter(lot => {
        const saleDate = new Date(lot.sale_date!);
        return saleDate >= thirtyDaysAgo && lot.realized_gain_loss !== null && lot.realized_gain_loss < 0;
      })
      .map(lot => ({
        symbol: lot.symbol,
        saleDate: new Date(lot.sale_date!),
        loss: Math.abs(lot.realized_gain_loss || 0)
      }));
  }, [taxLots]);

  const recentSalesBySymbol = useMemo(() => {
    const map: Record<string, { saleDate: Date; loss: number }> = {};
    recentSales.forEach(sale => {
      if (!map[sale.symbol] || sale.saleDate > map[sale.symbol].saleDate) {
        map[sale.symbol] = { saleDate: sale.saleDate, loss: sale.loss };
      }
    });
    return map;
  }, [recentSales]);

  const analysis = useMemo((): LotAnalysis[] => {
    const today = new Date();
    const oneYear = 365;

    return taxLots
      .filter(lot => !lot.is_closed)
      .map(lot => {
        const currentPrice = priceMap[lot.symbol] || 0;
        const costPerShare = lot.cost_basis / lot.shares;
        const unrealizedLoss = (currentPrice - costPerShare) * lot.shares;
        const purchaseDate = new Date(lot.purchase_date);
        const daysHeld = differenceInDays(today, purchaseDate);
        const daysToLongTerm = Math.max(0, oneYear - daysHeld);
        const longTermDate = addDays(purchaseDate, oneYear);
        const progressToLongTerm = Math.min(100, (daysHeld / oneYear) * 100);

        // Calculate tax impact if loss is realized
        const absLoss = Math.abs(unrealizedLoss);
        const estimatedShortTermTax = absLoss * SHORT_TERM_RATE;
        const estimatedLongTermTax = absLoss * LONG_TERM_RATE;
        const taxSavingsIfWait = estimatedShortTermTax - estimatedLongTermTax;

        // Check for wash sale risk
        const recentSale = recentSalesBySymbol[lot.symbol];
        const washSaleRisk = !!recentSale;

        let recommendation: 'wait' | 'harvest_now' | 'already_long_term';
        let recommendationReason: string;

        if (unrealizedLoss >= 0) {
          // Position is at gain, not relevant for loss harvesting
          recommendation = 'already_long_term';
          recommendationReason = 'Position is at a gain, not a harvesting candidate';
        } else if (daysHeld >= oneYear) {
          recommendation = 'already_long_term';
          recommendationReason = 'Already qualifies for long-term treatment';
        } else if (daysToLongTerm <= 30) {
          recommendation = 'wait';
          recommendationReason = `Only ${daysToLongTerm} days until long-term status. Consider waiting to maximize tax savings.`;
        } else if (daysToLongTerm <= 90) {
          recommendation = 'wait';
          recommendationReason = `${daysToLongTerm} days to long-term. Waiting could save ~$${taxSavingsIfWait.toFixed(0)} in taxes.`;
        } else {
          recommendation = 'harvest_now';
          recommendationReason = `${daysToLongTerm} days to long-term. Short-term loss can still offset short-term gains at higher rates.`;
        }

        return {
          id: lot.id,
          symbol: lot.symbol,
          shares: lot.shares,
          costBasis: lot.cost_basis,
          currentPrice,
          unrealizedLoss,
          purchaseDate,
          daysHeld,
          daysToLongTerm,
          longTermDate,
          estimatedShortTermTax,
          estimatedLongTermTax,
          taxSavingsIfWait,
          progressToLongTerm,
          recommendation,
          recommendationReason,
          washSaleRisk,
          recentSaleDate: recentSale?.saleDate,
        };
      })
      .filter(lot => lot.unrealizedLoss < 0) // Only show losing positions
      .sort((a, b) => a.daysToLongTerm - b.daysToLongTerm); // Sort by closest to long-term
  }, [taxLots, priceMap, recentSalesBySymbol]);

  const lotsApproachingLongTerm = analysis.filter(l => l.recommendation === 'wait');
  const lotsRecommendedNow = analysis.filter(l => l.recommendation === 'harvest_now');
  const lotsWithWashRisk = analysis.filter(l => l.washSaleRisk);
  const totalPotentialSavings = lotsApproachingLongTerm.reduce((sum, l) => sum + l.taxSavingsIfWait, 0);
  const totalWaitLosses = lotsApproachingLongTerm.reduce((sum, l) => sum + Math.abs(l.unrealizedLoss), 0);

  const handleTestNotification = async () => {
    if (!user) {
      toast({ title: 'Please log in first', variant: 'destructive' });
      return;
    }

    setTestingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke('tax-status-notifications', {
        body: { testMode: true, userId: user.id }
      });

      if (error) throw error;

      toast({
        title: 'Test notification sent',
        description: data?.message || 'Check your email and in-app notifications.'
      });
    } catch (error) {
      console.error('Error testing notification:', error);
      toast({
        title: 'Failed to send test notification',
        description: 'Check the console for details.',
        variant: 'destructive'
      });
    } finally {
      setTestingNotification(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="bg-primary/10 border-primary/30">
          <Eye className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Demo Mode</AlertTitle>
          <AlertDescription>
            You're viewing sample data. Log in to see your real tax lots with wash sale detection and countdown to long-term status.
          </AlertDescription>
        </Alert>
      )}

      {/* Wash Sale Risk Alert */}
      {lotsWithWashRisk.length > 0 && (
        <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">Wash Sale Risk Detected</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              {lotsWithWashRisk.length} position{lotsWithWashRisk.length > 1 ? 's' : ''} may trigger wash sale rules if sold now:
            </p>
            <ul className="list-disc list-inside space-y-1">
              {lotsWithWashRisk.map(lot => (
                <li key={lot.id} className="text-sm">
                  <strong>{lot.symbol}</strong>: You sold this stock at a loss on{' '}
                  {lot.recentSaleDate ? format(lot.recentSaleDate, 'MMM d, yyyy') : 'recently'}.
                  Selling again within 30 days would disallow the loss deduction.
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Positions Approaching Long-Term</p>
                <p className="text-2xl font-bold text-amber-500">{lotsApproachingLongTerm.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ${totalWaitLosses.toLocaleString()} in unrealized losses
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Potential Tax Savings by Waiting</p>
                <p className="text-2xl font-bold text-green-500">${totalPotentialSavings.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Difference between short & long-term rates
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ready for Harvest Now</p>
                <p className="text-2xl font-bold text-blue-500">{lotsRecommendedNow.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Far from long-term status
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wash Sale Risk</p>
                <p className="text-2xl font-bold text-red-500">{lotsWithWashRisk.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recently sold at a loss
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Notification Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Tax Status Notifications
          </CardTitle>
          <CardDescription>
            Get notified when positions approach long-term status or when harvesting opportunities arise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleTestNotification}
              disabled={testingNotification}
              variant="outline"
            >
              {testingNotification ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Test Notification
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Sends a test notification to verify your alert settings are working correctly.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Approaching Long-Term Section */}
      {lotsApproachingLongTerm.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Hold for Long-Term Treatment
            </CardTitle>
            <CardDescription>
              These positions are close to qualifying for long-term capital loss treatment (15-20% tax rate vs 22-37% short-term).
              Consider waiting to maximize your tax benefit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Unrealized Loss</TableHead>
                  <TableHead>Days Held</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Long-Term Date</TableHead>
                  <TableHead>Savings if Wait</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotsApproachingLongTerm.map(lot => (
                  <TableRow key={lot.id} className={lot.washSaleRisk ? 'bg-amber-500/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-bold">{lot.symbol}</div>
                          <div className="text-xs text-muted-foreground">{lot.shares} shares</div>
                        </div>
                        {lot.washSaleRisk && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Wash Risk
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-red-500 font-medium">
                      ${Math.abs(lot.unrealizedLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {lot.daysHeld} days
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{lot.daysToLongTerm} days left</span>
                          <span>{lot.progressToLongTerm.toFixed(0)}%</span>
                        </div>
                        <Progress value={lot.progressToLongTerm} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                        {format(lot.longTermDate, 'MMM d, yyyy')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-500 font-medium">
                      +${lot.taxSavingsIfWait.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Wait</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Harvest Now Section */}
      {lotsRecommendedNow.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Consider Harvesting Now
            </CardTitle>
            <CardDescription>
              These positions are far from long-term status. Short-term losses can offset short-term gains at your marginal rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Unrealized Loss</TableHead>
                  <TableHead>Days Held</TableHead>
                  <TableHead>Days to Long-Term</TableHead>
                  <TableHead>Short-Term Tax Benefit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotsRecommendedNow.map(lot => (
                  <TableRow key={lot.id} className={lot.washSaleRisk ? 'bg-amber-500/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-bold">{lot.symbol}</div>
                          <div className="text-xs text-muted-foreground">{lot.shares} shares</div>
                        </div>
                        {lot.washSaleRisk && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Wash Risk
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-red-500 font-medium">
                      ${Math.abs(lot.unrealizedLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {lot.daysHeld} days
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lot.daysToLongTerm} days</Badge>
                    </TableCell>
                    <TableCell className="text-green-500 font-medium">
                      ~${lot.estimatedShortTermTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-blue-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Harvest</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {analysis.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Losing Positions</h3>
            <p className="text-muted-foreground">
              You don't have any positions with unrealized losses to optimize.
              All your open tax lots are currently at a gain or break-even.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tax Rate Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Understanding Tax Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">
                Short-Term Capital Losses (&lt;1 year)
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Taxed at your ordinary income rate: 10% - 37%
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Pro:</strong> Higher tax savings when offsetting short-term gains.
                <br />
                <strong>Con:</strong> If used to offset long-term gains, you lose the rate differential benefit.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">
                Long-Term Capital Losses (≥1 year)
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Taxed at preferential rates: 0%, 15%, or 20%
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Pro:</strong> Best for offsetting long-term gains dollar-for-dollar.
                <br />
                <strong>Con:</strong> Lower tax benefit if offsetting ordinary income (still capped at $3,000/year).
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> The IRS netting rules require you to first offset short-term losses against short-term gains,
              and long-term losses against long-term gains. Any net loss in one category can then offset net gains in the other.
              Up to $3,000 of remaining net loss can offset ordinary income annually.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};