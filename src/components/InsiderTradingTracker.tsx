import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { UserCheck, Info, ShieldCheck } from 'lucide-react';

const InsiderTradingTracker = () => (
  <div className="space-y-6 p-6">
    <header>
      <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3"><span className="p-2 bg-primary/10 rounded-xl"><UserCheck className="w-6 h-6 text-primary" /></span>Insider Trading Tracker</h1>
      <p className="text-muted-foreground">Reported insider transactions with filing dates and source documents.</p>
    </header>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Regulatory filing data required</CardTitle>
        <CardDescription>Insider activity must be sourced from verified regulatory filings. Portfolio holdings and share prices cannot determine who traded, the transaction date, or the reported share count.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>No buys, sells, dollar totals, or significance scores are displayed until a filings provider is connected. A complete implementation should retain filing links, transaction codes, and amended filing history.</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default InsiderTradingTracker;
