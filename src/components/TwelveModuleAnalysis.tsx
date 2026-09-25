import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Info, Layers3 } from 'lucide-react';

const modules = [
  'Valuation and assumptions', 'Business growth', 'Historical performance', 'Balance sheet strength',
  'Cash flow quality', 'Dividend sustainability', 'Competitive position', 'Management and governance',
  'Market expectations', 'Risk factors', 'Investment thesis', 'Portfolio fit',
];

const TwelveModuleAnalysis = () => (
  <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-bold flex items-center gap-2"><Layers3 className="h-6 w-6 text-primary" />12-Module Company Analysis</h1>
      <p className="text-muted-foreground">A structured research checklist. No composite recommendation is generated.</p>
    </header>
    <Card>
      <CardHeader>
        <CardTitle>Research data provider required</CardTitle>
        <CardDescription>A credible company report needs sourced financial statements and assumptions for each module. The current app does not have complete verified coverage for this checklist.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{modules.map((module, index) => <div key={module} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><span className="text-sm"><span className="mr-2 text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>{module}</span><Badge variant="outline">Data needed</Badge></div>)}</div>
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0 mt-0.5" /><p>Symbol-seeded scores and automatic buy/sell signals are not used. When data is connected, each module should show its source, period, missing metrics, and calculation before an overall view is presented.</p></div>
      </CardContent>
    </Card>
  </div>
);

export default TwelveModuleAnalysis;
