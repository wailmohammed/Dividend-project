import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { HeartPulse, Info } from 'lucide-react';

const FinancialHealthScore = () => {
  const holdings = usePortfolio().activePortfolio?.holdings || [];
  const symbols = [...new Set(holdings.map(holding => holding.symbol?.replace('.US', '').toUpperCase()).filter(Boolean))];
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2"><HeartPulse className="w-6 h-6 text-primary" />Financial Health</h2>
        <p className="text-muted-foreground text-sm">Balance sheet, cash flow, profitability, and payout analysis.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Fundamental data required</CardTitle>
          <CardDescription>Financial ratios must come from dated company filings and use consistent definitions before they can support a health score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">{symbols.length ? symbols.slice(0, 30).map(symbol => <Badge key={symbol} variant="outline">{symbol}</Badge>) : <p className="text-sm text-muted-foreground">Add holdings to prepare this analysis.</p>}{symbols.length > 30 && <Badge variant="secondary">+{symbols.length - 30} more</Badge>}</div>
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Scores, grades, and risk labels are hidden until verified filings data is connected. Ticker-derived ratios cannot represent a company’s financial health. The enabled version should display source, fiscal period, and missing-data coverage per metric.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialHealthScore;
