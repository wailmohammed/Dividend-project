import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { Snowflake, Plus, Info } from 'lucide-react';
import { toast } from 'sonner';

const SnowflakeScreener = () => (
  <div className="space-y-6 p-6">
    <header>
      <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3"><span className="p-2 bg-primary/10 rounded-xl"><Snowflake className="w-6 h-6 text-primary" /></span>Snowflake Screener</h1>
      <p className="text-muted-foreground">Compare stocks across valuation, future growth, past performance, financial health, and dividends.</p>
    </header>
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2"><Plus className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Search a company</span></div>
        <div className="max-w-md"><StockSearchAutocomplete onSelect={(symbol) => toast.info(`Verified fundamentals for ${symbol} are not available yet.`)} placeholder="Search a ticker or company name" /></div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" />Fundamentals provider required</CardTitle>
        <CardDescription>Quality factor scores need financial statements and clear scoring rules. No fabricated prices, market caps, or snowflake scores are shown.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Connect verified valuation, growth, historical performance, balance sheet, and dividend data to enable filtering. Each factor should include its source and reporting date.</div>
      </CardContent>
    </Card>
  </div>
);

export default SnowflakeScreener;
