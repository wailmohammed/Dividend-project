import React, { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateXIRR, calculateTWR, annualize, simpleTotalReturn, type CashFlow, type ValuePoint } from '@/utils/returns';

const XIRRPerformanceCard: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { snapshots } = usePortfolioSnapshots(activePortfolio?.id as string | undefined);

  const cashflows = useMemo<CashFlow[]>(() => {
    const transactions = activePortfolio?.transactions || [];
    const flows: CashFlow[] = [];
    transactions.forEach((t: any) => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return;
      const amount = t.totalValue || (t.shares || 0) * (t.price || 0);
      // Trades move cash within a portfolio; only contributions and withdrawals
      // are external flows for a portfolio-level money-weighted return.
      if (String(t.type) === 'DEPOSIT') flows.push({ date, amount: -Math.abs(amount) });
      else if (String(t.type) === 'WITHDRAWAL') flows.push({ date, amount: Math.abs(amount) });
    });
    return flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activePortfolio]);

  const xirr = useMemo(() => {
    if (!activePortfolio) return null;
    const flows = [...cashflows];
    const endingValue = Number(activePortfolio.totalValue) + Number(activePortfolio.cashBalance || 0);
    if (endingValue > 0) flows.push({ date: new Date(), amount: endingValue });
    return calculateXIRR(flows);
  }, [activePortfolio, cashflows]);

  const { twr, twrAnnualized, twrSource } = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const valuations: ValuePoint[] = (snapshots || []).map(s => ({
      date: new Date(s.snapshot_date),
      value: Number(s.total_value) + Number(s.cash_balance || 0),
    }));

    const endingValue = Number(activePortfolio?.totalValue || 0) + Number(activePortfolio?.cashBalance || 0);
    if (endingValue > 0) {
      valuations.push({ date: new Date(), value: endingValue });
    }

    const chained = calculateTWR(valuations, cashflows);
    if (chained !== null && valuations.length >= 2) {
      const days = (valuations[valuations.length - 1].date.getTime() - valuations[0].date.getTime()) / 86400000;
      return { twr: chained, twrAnnualized: annualize(chained, days), twrSource: 'chain-linked' as const };
    }

    const totalCost = holdings.reduce((s: number, h: any) => s + (h.shares || 0) * (h.avgPrice || 0), 0);
    const totalValue = holdings.reduce((s: number, h: any) => s + (h.shares || 0) * (h.currentPrice || 0), 0);
    return { twr: simpleTotalReturn(totalCost, totalValue), twrAnnualized: null, twrSource: 'cost-basis' as const };
  }, [activePortfolio, snapshots, cashflows]);

  const renderValue = (value: number | null) =>
    value !== null ? (
      <div className={`text-xl font-bold flex items-center gap-1 ${value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
        {value >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        {value.toFixed(1)}%
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">—</p>
    );

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-foreground">Performance Metrics</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>XIRR</strong> (money-weighted) accounts for the timing and size of your cash flows.{' '}
                <strong>TWR</strong> (time-weighted) chain-links sub-period returns between cash flows, so it is the
                fair number to compare against an index.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">XIRR (Money-Weighted)</p>
          {renderValue(xirr)}
          {xirr !== null && <Badge variant="secondary" className="text-[10px] mt-1">Annualized</Badge>}
          {xirr === null && <p className="text-[10px] text-muted-foreground mt-1">Add contribution history to calculate</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">TWR (Time-Weighted)</p>
          {renderValue(twr)}
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="secondary" className="text-[10px]">
              {twrSource === 'chain-linked' ? 'Chain-linked' : 'Cost basis'}
            </Badge>
            {twrAnnualized !== null && (
              <Badge variant="outline" className="text-[10px]">{twrAnnualized.toFixed(1)}% / yr</Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default XIRRPerformanceCard;
