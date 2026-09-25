import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { TrendingUp, Plus, Info } from 'lucide-react';
import { toast } from 'sonner';

const GrowthForecastVisualizer = () => {
  const handleSelect = (symbol: string) => {
    toast.info(`Verified analyst forecasts for ${symbol} are not available yet.`);
  };

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <span className="p-2 bg-primary/10 rounded-xl"><TrendingUp className="w-6 h-6 text-primary" /></span>
          Growth Forecasts
        </h1>
        <p className="text-muted-foreground">Earnings and revenue projections from a verified analyst data source.</p>
      </header>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Find a company</span>
          </div>
          <div className="max-w-md">
            <StockSearchAutocomplete onSelect={handleSelect} placeholder="Search a ticker or company name" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" />Forecast provider required</CardTitle>
          <CardDescription>
            This screen does not currently have a verified analyst estimates feed. Price targets, consensus ratings, EPS projections, and revenue projections are therefore hidden until a provider is configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Search for a company to check whether forecast data is available. No sample forecasts or generated values are presented as market research.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GrowthForecastVisualizer;
