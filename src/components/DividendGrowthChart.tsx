import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, DollarSign, Info } from 'lucide-react';

interface DividendGrowthChartProps {
  symbol: string;
  dividendYield?: number;
  currentPrice?: number;
}

export const DividendGrowthChart: React.FC<DividendGrowthChartProps> = ({ symbol, dividendYield }) => {
  const hasYield = typeof dividendYield === 'number' && Number.isFinite(dividendYield) && dividendYield >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Dividend History · {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="w-4 h-4" />Yield on file</div>
            <div className="text-2xl font-bold text-foreground">{hasYield ? `${dividendYield.toFixed(2)}%` : '—'}</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="w-4 h-4" />Payment history</div>
            <div className="text-2xl font-bold text-foreground">Unavailable</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground">Dividend growth rate</div>
            <div className="text-2xl font-bold text-foreground">—</div>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
          <Badge variant="outline">Historical payments not connected</Badge>
          <p className="text-sm text-muted-foreground flex items-start justify-center gap-2 max-w-2xl mx-auto">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            A current yield does not establish past dividend growth or quarterly payments. Connect a verified dividend history source or record payments in the ledger to display a history chart for {symbol}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DividendGrowthChart;
