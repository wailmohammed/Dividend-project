import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import GlobalMarketOverview from '@/components/GlobalMarketOverview';
import { Info, Newspaper, Shield } from 'lucide-react';

const MarketIntelligence = () => (
  <div className="space-y-6">
    <div>
      <h2 className="flex items-center gap-2 text-2xl font-bold"><Newspaper className="h-6 w-6 text-primary" />Market Intelligence</h2>
      <p className="mt-1 text-sm text-muted-foreground">Provider-backed market snapshots and a clear view of missing news coverage.</p>
    </div>
    <GlobalMarketOverview />
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />News and macro coverage</CardTitle><CardDescription>Current events, economic releases, and analyst updates</CardDescription></CardHeader>
      <CardContent className="flex items-start gap-2 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>A dated news, macroeconomic calendar, and licensed consensus feed are not connected. No current headlines, market mood, sector rotation, or trade ideas are generated without those sources.</p></CardContent>
    </Card>
  </div>
);

export default MarketIntelligence;
