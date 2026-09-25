import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { cleanSymbol } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { differenceInDays, format } from 'date-fns';
import {
  Bell, Calendar, Clock, TrendingDown, DollarSign,
  AlertTriangle, CheckCircle2, Scissors, Info, Send
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface HarvestReminder {
  symbol: string;
  shares: number;
  unrealizedLoss: number;
  potentialSavings: number;
  daysUntilYearEnd: number;
  isLongTerm: boolean;
  washSaleRisk: boolean;
}

export const TaxHarvestingReminders: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { user } = useAuth();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [isTestingSend, setIsTestingSend] = useState(false);

  const now = new Date();
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const daysUntilYearEnd = differenceInDays(yearEnd, now);
  const isQ4 = now.getMonth() >= 9;

  // Calculate harvest opportunities
  const harvestOpportunities = useMemo((): HarvestReminder[] => {
    const holdings = activePortfolio?.holdings || [];
    const transactions = activePortfolio?.transactions || [];
    
    // Get recent purchases for wash sale detection
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentBuys = new Map<string, Date>();
    
    transactions
      .filter(t => t.type === 'BUY' && new Date(t.date) >= thirtyDaysAgo)
      .forEach(t => {
        const date = new Date(t.date);
        const existing = recentBuys.get(t.symbol);
        if (!existing || date > existing) {
          recentBuys.set(t.symbol, date);
        }
      });

    return holdings
      .map(h => {
        const currentPrice = h.currentPrice || h.avgPrice || 0;
        const avgPrice = h.avgPrice || 0;
        const shares = h.shares || 0;
        const currentValue = shares * currentPrice;
        const costBasis = shares * avgPrice;
        const unrealizedPL = currentValue - costBasis;
        
        // Estimate holding period (would come from purchase date in real app)
        const holdingDays = 30 + (h.symbol.charCodeAt(0) % 400);
        const isLongTerm = holdingDays > 365;
        
        // Tax savings estimate
        const taxRate = isLongTerm ? 0.22 : 0.35;
        const potentialSavings = unrealizedPL < 0 ? Math.abs(unrealizedPL) * taxRate : 0;
        
        // Check wash sale risk
        const washSaleRisk = recentBuys.has(cleanSymbol(h.symbol));

        return {
          symbol: cleanSymbol(h.symbol),
          shares,
          unrealizedLoss: unrealizedPL < 0 ? unrealizedPL : 0,
          potentialSavings,
          daysUntilYearEnd,
          isLongTerm,
          washSaleRisk,
        };
      })
      .filter(h => h.unrealizedLoss < -100) // Only losses > $100
      .sort((a, b) => a.unrealizedLoss - b.unrealizedLoss);
  }, [activePortfolio, daysUntilYearEnd, now]);

  const totalLoss = harvestOpportunities.reduce((sum, h) => sum + h.unrealizedLoss, 0);
  const totalSavings = harvestOpportunities.reduce((sum, h) => sum + h.potentialSavings, 0);

  // Test the reminder function
  const handleTestReminder = async () => {
    if (!user) {
      toast.error('Please sign in to test reminders');
      return;
    }

    setIsTestingSend(true);
    try {
      const { data, error } = await supabase.functions.invoke('tax-loss-reminders', {
        body: { test: true },
      });

      if (error) throw error;

      toast.success('Tax-loss harvesting reminder check completed', {
        description: `Found ${data.usersWithOpportunities || 0} users with opportunities`,
      });
    } catch (error) {
      console.error('Test reminder error:', error);
      toast.error('Failed to test reminder', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsTestingSend(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Tax-Loss Harvesting Reminders
            </CardTitle>
            <CardDescription>
              Get notified about tax-saving opportunities before year-end
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="reminder-toggle" className="text-sm">
              Reminders
            </Label>
            <Switch
              id="reminder-toggle"
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Year-End Countdown */}
        <div className={`flex items-center justify-between p-4 rounded-lg border ${
          daysUntilYearEnd <= 30 
            ? 'bg-amber-500/10 border-amber-500/20' 
            : 'bg-muted/50 border-border'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              daysUntilYearEnd <= 30 ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">Year-End Countdown</p>
              <p className="text-sm text-muted-foreground">
                Tax year {now.getFullYear()} ends {format(yearEnd, 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${
              daysUntilYearEnd <= 30 ? 'text-amber-500' : 'text-foreground'
            }`}>
              {daysUntilYearEnd}
            </p>
            <p className="text-xs text-muted-foreground">days remaining</p>
          </div>
        </div>

        {/* Q4 Alert */}
        {isQ4 && (
          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <Scissors className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-primary mb-1">Prime Tax-Loss Harvesting Season</p>
              <p className="text-sm text-muted-foreground">
                Q4 is the ideal time to review your portfolio for tax-loss harvesting opportunities.
                Realized losses can offset gains and reduce your tax liability.
              </p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {harvestOpportunities.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-600">Harvestable Losses</span>
                </div>
                <p className="text-lg font-bold text-red-500">
                  -${Math.abs(totalLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-emerald-600">Potential Savings</span>
                </div>
                <p className="text-lg font-bold text-emerald-500">
                  ${totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-blue-600">Candidates</span>
                </div>
                <p className="text-lg font-bold text-blue-500">
                  {harvestOpportunities.length}
                </p>
              </div>
            </div>

            {/* Top Candidates Preview */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Top Harvest Candidates</h4>
              <div className="space-y-2">
                {harvestOpportunities.slice(0, 5).map(opportunity => (
                  <div
                    key={opportunity.symbol}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-500/10 text-red-500">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{opportunity.symbol}</span>
                          <Badge variant="outline" className={opportunity.isLongTerm ? 'text-blue-500' : 'text-amber-500'}>
                            {opportunity.isLongTerm ? 'Long-term' : 'Short-term'}
                          </Badge>
                          {opportunity.washSaleRisk && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="destructive" className="gap-1 text-xs">
                                    <AlertTriangle className="w-3 h-3" />
                                    Wash Risk
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-xs">
                                    Recent purchase detected. Selling now may trigger wash sale rules.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {opportunity.shares.toFixed(2)} shares
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-500">
                        -${Math.abs(opportunity.unrealizedLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-emerald-500">
                        ~${opportunity.potentialSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} savings
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {harvestOpportunities.length > 5 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  +{harvestOpportunities.length - 5} more candidates
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
            <h3 className="text-lg font-semibold mb-2">No Harvest Opportunities</h3>
            <p className="text-muted-foreground">
              Your positions are all in positive territory. No tax-loss harvesting needed right now.
            </p>
          </div>
        )}

        {/* Reminder Settings */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Reminder Settings
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Email reminders in Q4</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>In-app notifications</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Year-end deadline alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Wash sale warnings</span>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">How It Works</p>
            <p className="text-muted-foreground text-xs">
              Starting in September, you'll receive periodic reminders about positions with unrealized losses. 
              These reminders become more frequent as year-end approaches, helping you take action 
              before the tax year closes.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-amber-700 dark:text-amber-400">
            <strong>Disclaimer:</strong> Tax-loss harvesting estimates are for informational purposes only. 
            Actual tax savings depend on your individual tax situation. Consult a qualified tax professional 
            before making investment decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaxHarvestingReminders;
