import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Info, Layers3 } from 'lucide-react';

export const SectorRotationAnalysis = () => {
  const holdings = usePortfolio().activePortfolio?.holdings || [];
  const { sectors, totalValue, missingPriceCount } = useMemo(() => {
    const values = new Map<string, number>();
    let total = 0;
    let missing = 0;
    holdings.forEach(holding => {
      const shares = Number(holding.shares) || 0;
      const price = Number(holding.currentPrice) || 0;
      if (shares <= 0 || price <= 0) { missing++; return; }
      const value = shares * price;
      const sector = holding.sector?.trim() || 'Unclassified';
      values.set(sector, (values.get(sector) || 0) + value);
      total += value;
    });
    return {
      totalValue: total,
      missingPriceCount: missing,
      sectors: [...values.entries()].map(([sector, value]) => ({ sector, value, weight: total > 0 ? value / total * 100 : 0 })).sort((a, b) => b.value - a.value),
    };
  }, [holdings]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Layers3 className="w-6 h-6 text-primary" />Sector Allocation</h2>
        <p className="text-muted-foreground">Current portfolio exposure by sector, based on holding prices on file.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio exposure</CardTitle>
          <CardDescription>Allocation shows current holdings only. No market-cycle, momentum, or buy/sell forecast is inferred.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sectors.length ? sectors.map(({ sector, value, weight }) => (
            <div key={sector} className="space-y-1.5">
              <div className="flex justify-between gap-4 text-sm"><span className="font-medium">{sector}</span><span className="text-muted-foreground">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {weight.toFixed(1)}%</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(weight, 100)}%` }} /></div>
            </div>
          )) : <p className="py-8 text-center text-sm text-muted-foreground">Add holdings with current prices to view sector allocation.</p>}
          {totalValue > 0 && <p className="text-xs text-muted-foreground">Priced holdings: ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>}
          {missingPriceCount > 0 && <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p>{missingPriceCount} holding{missingPriceCount === 1 ? '' : 's'} without a current price are excluded from these weights.</p></div>}
        </CardContent>
      </Card>
    </div>
  );
};
