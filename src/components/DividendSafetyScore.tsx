import { useMemo } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Alert, AlertDescription } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export const DividendSafetyScore = () => {
  const { activePortfolio } = usePortfolio();
  const dividendHoldings = useMemo(() => (activePortfolio?.holdings || [])
    .filter((holding) => Number(holding.dividendYield) > 0)
    .map((holding) => ({
      ...holding,
      marketValue: Number(holding.shares || 0) * Number(holding.currentPrice || 0),
    }))
    .sort((a, b) => b.marketValue - a.marketValue), [activePortfolio?.holdings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" />
          Dividend safety checks
        </CardTitle>
        <CardDescription>Current portfolio data, with unverified safety factors called out clearly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle aria-hidden="true" className="h-4 w-4" />
          <AlertDescription>
            Verified payout ratios, cash-flow coverage, debt metrics, and dividend streaks are not available from the connected data yet. No safety score is shown until those figures can be sourced and dated.
          </AlertDescription>
        </Alert>

        {dividendHoldings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            No holdings with a dividend yield on file.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[580px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Holding</th>
                  <th scope="col" className="px-4 py-3 text-right">Yield on file</th>
                  <th scope="col" className="px-4 py-3 text-right">Position value</th>
                  <th scope="col" className="px-4 py-3">Safety data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dividendHoldings.map((holding) => (
                  <tr key={holding.id} className="hover:bg-muted/20">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                      <span>{holding.symbol}</span>
                      <span className="ml-2 font-normal text-muted-foreground">{holding.name}</span>
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(holding.dividendYield).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">${holding.marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-muted-foreground">Awaiting verified fundamentals</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Yield can change with market price and declared dividends. It is not a measure of dividend safety.</p>
      </CardContent>
    </Card>
  );
};
