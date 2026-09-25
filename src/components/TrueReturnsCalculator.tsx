import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { Calculator, Info } from 'lucide-react';

export const TrueReturnsCalculator = () => {
  const holdings = usePortfolio().activePortfolio?.holdings || [];
  const positions = useMemo(() => holdings.map(holding => {
    const shares = Number(holding.shares) || 0;
    const basisPerShare = Number(holding.avgPrice) || 0;
    const currentPrice = Number(holding.currentPrice) || 0;
    const invested = shares * basisPerShare;
    const value = shares * currentPrice;
    const gain = invested > 0 && currentPrice > 0 ? value - invested : null;
    const returnPct = gain !== null && invested > 0 ? gain / invested * 100 : null;
    return { symbol: cleanSymbol(holding.symbol), name: holding.name, shares, basisPerShare, currentPrice, invested, value, gain, returnPct };
  }).sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity)), [holdings]);

  const priced = positions.filter(position => position.gain !== null);
  const totals = priced.reduce((sum, position) => ({ invested: sum.invested + position.invested, value: sum.value + position.value }), { invested: 0, value: 0 });
  const totalGain = totals.value - totals.invested;
  const totalReturn = totals.invested > 0 ? totalGain / totals.invested * 100 : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Calculator className="w-6 h-6 text-primary" />Portfolio Returns</h1>
        <p className="text-muted-foreground">Unrealized price return from recorded cost basis and current holding prices.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Cost basis</p><p className="text-xl font-bold">${totals.invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Current value · priced holdings</p><p className="text-xl font-bold">${totals.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Unrealized price return</p><p className={`text-xl font-bold ${totalGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>{totalReturn === null ? '—' : `${totalGain >= 0 ? '+' : '−'}$${Math.abs(totalGain).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%)`}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position Returns</CardTitle>
          <CardDescription>Cost basis is shares × average purchase price. Positions without a current price are marked unavailable.</CardDescription>
        </CardHeader>
        <CardContent>
          {positions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-3 px-2">Holding</th><th className="text-right py-3 px-2">Cost basis</th><th className="text-right py-3 px-2">Current value</th><th className="text-right py-3 px-2">Unrealized gain/loss</th><th className="text-right py-3 px-2">Return</th></tr></thead>
                <tbody>{positions.map(position => <tr key={position.symbol} className="border-b border-border">
                  <td className="py-3 px-2"><span className="font-semibold">{position.symbol}</span><span className="block text-xs text-muted-foreground">{position.name}</span></td>
                  <td className="py-3 px-2 text-right">${position.invested.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="py-3 px-2 text-right">{position.currentPrice > 0 ? `$${position.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                  <td className="py-3 px-2 text-right">{position.gain === null ? <Badge variant="outline">Price unavailable</Badge> : `${position.gain >= 0 ? '+' : '−'}$${Math.abs(position.gain).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</td>
                  <td className="py-3 px-2 text-right">{position.returnPct === null ? '—' : `${position.returnPct >= 0 ? '+' : ''}${position.returnPct.toFixed(2)}%`}</td>
                </tr>)}</tbody>
              </table>
            </div>
          ) : <p className="py-8 text-center text-sm text-muted-foreground">Add holdings with cost basis to view returns.</p>}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>This is unrealized price return only. Realized trades, cash flows, dividends, taxes, fees, and annualized or money-weighted returns are excluded until their dated ledger records are connected.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrueReturnsCalculator;
