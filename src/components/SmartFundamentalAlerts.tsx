import { useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Activity, AlertTriangle, BarChart3, DollarSign, Info, TrendingUp, Users, Zap } from 'lucide-react';

const feedRequirements = [
  { label: 'Earnings estimate changes', source: 'Dated analyst estimate revisions', icon: BarChart3 },
  { label: 'Valuation shifts', source: 'Historical fundamentals and valuation multiples', icon: TrendingUp },
  { label: 'Insider activity', source: 'Regulatory insider transaction filings', icon: Users },
  { label: 'Dividend policy changes', source: 'Issuer announcements and dividend history', icon: DollarSign },
  { label: 'Analyst rating changes', source: 'Timestamped analyst consensus feed', icon: Activity },
  { label: 'Revenue growth shifts', source: 'Reported financial statements by fiscal period', icon: Zap },
];

export const SmartFundamentalAlerts: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const symbols = useMemo(() => [...new Set((activePortfolio?.holdings || []).map(holding => cleanSymbol(holding.symbol)))], [activePortfolio?.holdings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><AlertTriangle className="h-6 w-6 text-primary" />Smart Fundamental Alerts</h1>
        <p className="mt-1 text-muted-foreground">Monitoring status for {symbols.length ? `${symbols.length} portfolio symbols` : 'your portfolio'}.</p>
      </div>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Fundamental-event monitoring is not active because no dated financial events provider is connected. This page will not create alerts or claim that an event occurred until a source is configured.</AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Data feeds required</CardTitle>
          <CardDescription>Each event type needs an authoritative source and a published timestamp before the app can trigger it reliably.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedRequirements.map(({ label, source, icon: Icon }) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-muted-foreground" /><div><p className="font-medium">{label}</p><p className="text-sm text-muted-foreground">Needs {source.toLowerCase()}.</p></div></div>
              <Badge variant="outline">Feed unavailable</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{symbols.length ? `Tracked portfolio symbols: ${symbols.join(', ')}.` : 'Add holdings to see which symbols would be monitored after a provider is connected.'}</p>
    </div>
  );
};

export default SmartFundamentalAlerts;
