import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Users, Info, Building2 } from 'lucide-react';

const ManagementProfileViewer = () => (
  <div className="space-y-6 p-6">
    <header>
      <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3"><span className="p-2 bg-primary/10 rounded-xl"><Users className="w-6 h-6 text-primary" /></span>Management Profiles</h1>
      <p className="text-muted-foreground">Company leadership, board composition, and disclosed ownership.</p>
    </header>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Verified company data required</CardTitle>
        <CardDescription>Executive roles, board seats, compensation, and ownership change over time and need reliable filings or company disclosures with reporting periods.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>No sample biographies, compensation figures, or ownership amounts are shown until a verified source is connected. Disclosed compensation should identify its fiscal year and currency.</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default ManagementProfileViewer;
