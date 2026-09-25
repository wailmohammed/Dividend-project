import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Globe, CalendarClock, Info } from 'lucide-react';

export const EconomicEventsCalendar = () => (
  <div className="space-y-6">
    <header>
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Economic Events Calendar</h2>
      <p className="text-sm text-muted-foreground">Scheduled macroeconomic releases with source and published values.</p>
    </header>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Calendar feed required</CardTitle>
        <CardDescription>Official release dates, consensus forecasts, prior values, and actual results must come from a dated economic calendar source. This app has no verified calendar feed connected.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>No event dates or economic figures are shown until a source is configured. Calendar time zones, revisions, and actual release timestamps should be included when the feed is connected.</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default EconomicEventsCalendar;
