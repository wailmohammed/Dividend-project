import React from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Target, Info } from 'lucide-react';

interface PortfolioIntrinsicValueProps { compact?: boolean; }

const PortfolioIntrinsicValue: React.FC<PortfolioIntrinsicValueProps> = ({ compact = false }) => {
  const holdings = usePortfolio().activePortfolio?.holdings || [];
  if (compact && holdings.length === 0) return null;
  return (
    <Card>
      <CardHeader className={compact ? 'p-4 pb-2' : undefined}>
        <CardTitle className="flex items-center gap-2 text-base"><Target className="w-5 h-5 text-primary" />Intrinsic Value</CardTitle>
        <CardDescription>Company valuation models require verified financial statements and disclosed assumptions.</CardDescription>
      </CardHeader>
      <CardContent className={compact ? 'p-4 pt-2' : undefined}>
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <Badge variant="outline">Provider valuation unavailable</Badge>
            <p>No intrinsic values or undervalued labels are calculated from sector multipliers. Connect financial statements and a documented DCF or comparable-company model to enable this analysis.</p>
          </div>
        </div>
        {!holdings.length && <p className="mt-3 text-xs text-muted-foreground">Add portfolio holdings to prepare the analysis.</p>}
      </CardContent>
    </Card>
  );
};

export default PortfolioIntrinsicValue;
