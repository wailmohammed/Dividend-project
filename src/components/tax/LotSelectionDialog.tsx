import React, { useState, useMemo, useEffect } from 'react';
import { TaxLot } from '@/hooks/useTaxLots';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowDownUp, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign,
  Info,
  CheckCircle2
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { useUserSettings, CostBasisMethod } from '@/hooks/useUserSettings';

export type LotSelectionMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'LOFO' | 'AVGCOST' | 'SPECIFIC';

interface LotSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  sharesToSell: number;
  salePrice: number;
  availableLots: TaxLot[];
  currentPrice: number;
  onConfirm: (selectedLots: { lotId: string; shares: number }[], method: LotSelectionMethod) => void;
}

interface LotWithSelection extends TaxLot {
  selected: boolean;
  sharesToSell: number;
  potentialGainLoss: number;
  isLongTerm: boolean;
  holdingDays: number;
}

export const LotSelectionDialog: React.FC<LotSelectionDialogProps> = ({
  open,
  onOpenChange,
  symbol,
  sharesToSell,
  salePrice,
  availableLots,
  currentPrice,
  onConfirm
}) => {
  const { settings } = useUserSettings();
  const [method, setMethod] = useState<LotSelectionMethod>('FIFO');
  const [specificLots, setSpecificLots] = useState<Record<string, number>>({});

  // Use the user's default cost basis method when dialog opens
  useEffect(() => {
    if (open && settings?.default_cost_basis_method) {
      setMethod(settings.default_cost_basis_method as LotSelectionMethod);
    }
  }, [open, settings?.default_cost_basis_method]);

  // Enhance lots with calculated fields
  const enhancedLots = useMemo((): LotWithSelection[] => {
    return availableLots
      .filter(lot => !lot.is_closed && lot.shares > 0)
      .map(lot => {
        const holdingDays = differenceInDays(new Date(), new Date(lot.purchase_date));
        const isLongTerm = holdingDays >= 365;
        const potentialGainLoss = (currentPrice - lot.cost_basis) * lot.shares;
        
        return {
          ...lot,
          selected: false,
          sharesToSell: 0,
          potentialGainLoss,
          isLongTerm,
          holdingDays
        };
      });
  }, [availableLots, currentPrice]);

  // Calculate average cost basis for AVGCOST method
  const averageCostBasis = useMemo(() => {
    const totalCost = enhancedLots.reduce((sum, lot) => sum + (lot.cost_basis * lot.shares), 0);
    const totalShares = enhancedLots.reduce((sum, lot) => sum + lot.shares, 0);
    return totalShares > 0 ? totalCost / totalShares : 0;
  }, [enhancedLots]);

  // Apply selection method to determine which lots to sell
  const selectedLots = useMemo(() => {
    if (method === 'SPECIFIC') {
      return Object.entries(specificLots)
        .filter(([_, shares]) => shares > 0)
        .map(([lotId, shares]) => {
          const lot = enhancedLots.find(l => l.id === lotId);
          return { lotId, shares, lot };
        });
    }

    // For AVGCOST, we select lots FIFO but use average cost for tax calculation
    let sortedLots = [...enhancedLots];
    
    switch (method) {
      case 'FIFO': // First In, First Out - oldest first
      case 'AVGCOST': // Average Cost - uses FIFO order but average cost basis
        sortedLots.sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime());
        break;
      case 'LIFO': // Last In, First Out - newest first
        sortedLots.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
        break;
      case 'HIFO': // Highest In, First Out - highest cost basis first (minimize gains)
        sortedLots.sort((a, b) => b.cost_basis - a.cost_basis);
        break;
      case 'LOFO': // Lowest In, First Out - lowest cost basis first (maximize gains, useful for tax gain harvesting)
        sortedLots.sort((a, b) => a.cost_basis - b.cost_basis);
        break;
    }

    // Allocate shares to sell across lots
    let remainingShares = sharesToSell;
    const result: { lotId: string; shares: number; lot: LotWithSelection }[] = [];

    for (const lot of sortedLots) {
      if (remainingShares <= 0) break;
      
      const sharesToTake = Math.min(lot.shares, remainingShares);
      if (sharesToTake > 0) {
        // For AVGCOST, override the lot's cost basis with average
        const lotWithCostBasis = method === 'AVGCOST' 
          ? { ...lot, cost_basis: averageCostBasis, potentialGainLoss: (currentPrice - averageCostBasis) * lot.shares }
          : lot;
        result.push({ lotId: lot.id, shares: sharesToTake, lot: lotWithCostBasis });
        remainingShares -= sharesToTake;
      }
    }

    return result;
  }, [method, enhancedLots, sharesToSell, specificLots, averageCostBasis, currentPrice]);

  // Calculate tax implications of selected lots
  const taxSummary = useMemo(() => {
    let shortTermGains = 0;
    let longTermGains = 0;
    let totalShares = 0;

    selectedLots.forEach(({ shares, lot }) => {
      if (!lot) return;
      const gainLoss = (salePrice - lot.cost_basis) * shares;
      totalShares += shares;
      
      if (lot.isLongTerm) {
        longTermGains += gainLoss;
      } else {
        shortTermGains += gainLoss;
      }
    });

    return {
      shortTermGains,
      longTermGains,
      totalGains: shortTermGains + longTermGains,
      totalShares,
      shortTermTax: shortTermGains * 0.32, // Estimate at 32% bracket
      longTermTax: longTermGains * 0.15,   // Long-term at 15%
      totalEstimatedTax: (shortTermGains * 0.32) + (longTermGains * 0.15)
    };
  }, [selectedLots, salePrice]);

  const handleSpecificLotChange = (lotId: string, shares: number) => {
    setSpecificLots(prev => ({
      ...prev,
      [lotId]: Math.max(0, shares)
    }));
  };

  const totalAvailableShares = enhancedLots.reduce((sum, lot) => sum + lot.shares, 0);
  const specificTotalShares = Object.values(specificLots).reduce((sum, shares) => sum + shares, 0);

  const handleConfirm = () => {
    const lotsToSell = selectedLots.map(({ lotId, shares }) => ({ lotId, shares }));
    onConfirm(lotsToSell, method);
    onOpenChange(false);
  };

  const methodDescriptions: Record<LotSelectionMethod, string> = {
    FIFO: 'First In, First Out - Sells oldest shares first. Default IRS method.',
    LIFO: 'Last In, First Out - Sells newest shares first. Can defer long-term gains.',
    HIFO: 'Highest In, First Out - Sells highest cost shares first. Minimizes taxable gains.',
    LOFO: 'Lowest In, First Out - Sells lowest cost shares first. Useful for tax gain harvesting.',
    AVGCOST: 'Average Cost - Uses weighted average cost basis. Common for mutual funds.',
    SPECIFIC: 'Choose exactly which lots to sell for maximum tax control.'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownUp className="w-5 h-5" />
            Tax Lot Selection for {symbol}
          </DialogTitle>
          <DialogDescription>
            Choose which tax lots to sell for optimal tax treatment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sale Summary */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Shares to Sell</p>
                  <p className="text-xl font-bold">{sharesToSell}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sale Price</p>
                  <p className="text-xl font-bold">${salePrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Lots</p>
                  <p className="text-xl font-bold">{enhancedLots.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection Method */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Selection Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as LotSelectionMethod)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(['FIFO', 'LIFO', 'HIFO', 'LOFO', 'AVGCOST', 'SPECIFIC'] as LotSelectionMethod[]).map((m) => (
                    <div key={m} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => setMethod(m)}>
                      <RadioGroupItem value={m} id={m} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={m} className="font-semibold cursor-pointer">{m}</Label>
                        <p className="text-xs text-muted-foreground mt-1">{methodDescriptions[m]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Specific Lot Selection */}
          {method === 'SPECIFIC' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Specific Lots</CardTitle>
                <CardDescription>
                  Enter the number of shares to sell from each lot. 
                  Total: {specificTotalShares} / {sharesToSell} shares
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Cost Basis</TableHead>
                      <TableHead>Gain/Loss</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Shares to Sell</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enhancedLots.map((lot) => {
                      const sharesToSellFromLot = specificLots[lot.id] || 0;
                      const gainLoss = (currentPrice - lot.cost_basis) * sharesToSellFromLot;
                      
                      return (
                        <TableRow key={lot.id}>
                          <TableCell>{new Date(lot.purchase_date).toLocaleDateString()}</TableCell>
                          <TableCell>{lot.shares}</TableCell>
                          <TableCell>${lot.cost_basis.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={lot.potentialGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                              {lot.potentialGainLoss >= 0 ? '+' : ''}${lot.potentialGainLoss.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={lot.isLongTerm ? 'default' : 'secondary'}>
                              {lot.isLongTerm ? 'Long' : 'Short'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={lot.shares}
                              value={sharesToSellFromLot || ''}
                              onChange={(e) => handleSpecificLotChange(lot.id, parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Selected Lots Preview */}
          {method !== 'SPECIFIC' && selectedLots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Lots to be Sold ({method})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Cost Basis</TableHead>
                      <TableHead>Gain/Loss</TableHead>
                      <TableHead>Term</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLots.map(({ lotId, shares, lot }) => {
                      if (!lot) return null;
                      const gainLoss = (salePrice - lot.cost_basis) * shares;
                      
                      return (
                        <TableRow key={lotId}>
                          <TableCell>{new Date(lot.purchase_date).toLocaleDateString()}</TableCell>
                          <TableCell>{shares}</TableCell>
                          <TableCell>${lot.cost_basis.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                              {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={lot.isLongTerm ? 'default' : 'secondary'}>
                              {lot.isLongTerm ? 'Long-Term' : 'Short-Term'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Tax Impact Summary */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Estimated Tax Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <p className="text-xs text-muted-foreground">Short-Term Gains</p>
                  <p className={`font-bold ${taxSummary.shortTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {taxSummary.shortTermGains >= 0 ? '+' : ''}${taxSummary.shortTermGains.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">~${Math.abs(taxSummary.shortTermTax).toFixed(0)} tax</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <p className="text-xs text-muted-foreground">Long-Term Gains</p>
                  <p className={`font-bold ${taxSummary.longTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {taxSummary.longTermGains >= 0 ? '+' : ''}${taxSummary.longTermGains.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">~${Math.abs(taxSummary.longTermTax).toFixed(0)} tax</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <p className="text-xs text-muted-foreground">Total Gain/Loss</p>
                  <p className={`font-bold ${taxSummary.totalGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {taxSummary.totalGains >= 0 ? '+' : ''}${taxSummary.totalGains.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <p className="text-xs text-muted-foreground">Est. Tax Liability</p>
                  <p className="font-bold text-primary">
                    ${taxSummary.totalEstimatedTax.toFixed(0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning if not enough shares */}
          {taxSummary.totalShares < sharesToSell && (
            <Alert variant="destructive">
              <Info className="w-4 h-4" />
              <AlertDescription>
                You've only selected {taxSummary.totalShares} shares but need {sharesToSell}. 
                Please select more lots or adjust the quantity.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={taxSummary.totalShares < sharesToSell}
            >
              Confirm Sale with {method}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
