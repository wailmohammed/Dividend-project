import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { TaxLot } from '@/hooks/useTaxLots';
import { useWashSaleEnforcement } from '@/hooks/useWashSaleEnforcement';
import { format } from 'date-fns';

interface WashSaleEnforcementPanelProps {
  taxLots: TaxLot[];
}

export const WashSaleEnforcementPanel: React.FC<WashSaleEnforcementPanelProps> = ({ taxLots }) => {
  const { washSaleAdjustments, totalDisallowedLoss, affectedLots } = useWashSaleEnforcement(taxLots);

  if (washSaleAdjustments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            Wash Sale Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-green-500/10 border-green-500/30">
            <AlertTitle className="text-green-600 dark:text-green-400">No Wash Sales Detected</AlertTitle>
            <AlertDescription>
              Your portfolio has no wash sale rule violations within the 61-day window.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Alert */}
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600 dark:text-amber-400">
          Wash Sales Detected
        </AlertTitle>
        <AlertDescription>
          {washSaleAdjustments.length} wash sale{washSaleAdjustments.length > 1 ? 's' : ''} found. 
          Total disallowed loss: <strong>${totalDisallowedLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
          The IRS requires these losses to be added to the cost basis of replacement shares.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disallowed Losses</p>
                <p className="text-2xl font-bold text-amber-600">${totalDisallowedLoss.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wash Sale Events</p>
                <p className="text-2xl font-bold">{washSaleAdjustments.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Affected Lots</p>
                <p className="text-2xl font-bold">{affectedLots.size}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wash Sale Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Wash Sale Adjustments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Loss Sale</TableHead>
                <TableHead>Replacement Purchase</TableHead>
                <TableHead>Disallowed Loss</TableHead>
                <TableHead>Original Cost Basis</TableHead>
                <TableHead>Adjusted Cost Basis</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {washSaleAdjustments.map((adjustment, index) => (
                <TableRow key={index}>
                  <TableCell className="font-bold">{adjustment.originalLot.symbol}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="text-left">
                            <p>{format(new Date(adjustment.originalLot.sale_date!), 'MMM d, yyyy')}</p>
                            <p className="text-xs text-muted-foreground">
                              {adjustment.originalLot.shares} shares @ ${adjustment.originalLot.sale_price?.toFixed(2)}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sale that triggered the wash sale</p>
                          <p>Loss: ${adjustment.originalLot.realized_gain_loss?.toFixed(2)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p>{format(new Date(adjustment.replacementLot.purchase_date), 'MMM d, yyyy')}</p>
                        <p className="text-xs text-muted-foreground">
                          {adjustment.replacementLot.shares} shares @ ${adjustment.replacementLot.cost_basis.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-red-500 font-medium">
                    ${adjustment.disallowedLoss.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    ${adjustment.replacementLot.cost_basis.toFixed(2)}/share
                  </TableCell>
                  <TableCell className="font-medium text-blue-500">
                    ${adjustment.adjustedCostBasis.toFixed(2)}/share
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                      Wash Sale
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Educational Info */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Info className="w-5 h-5" />
            Understanding Wash Sales
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <strong>What is a wash sale?</strong> A wash sale occurs when you sell a security at a loss 
            and buy a "substantially identical" security within 30 days before or after the sale.
          </p>
          <p>
            <strong>Tax Impact:</strong> The loss is disallowed for tax purposes but isn't lost forever. 
            The disallowed loss is added to the cost basis of the replacement shares.
          </p>
          <p>
            <strong>Holding Period:</strong> The holding period of the replacement shares includes the 
            holding period of the original shares, which may help qualify for long-term capital gains treatment.
          </p>
          <p className="text-amber-600 dark:text-amber-400">
            <strong>Form 8949:</strong> Report wash sales with Code "W" in column (f) and the disallowed 
            amount as a positive adjustment in column (g).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
