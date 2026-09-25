import React, { useState, useMemo } from 'react';
import { useTaxDocuments, TaxDocument } from '@/hooks/useTaxDocuments';
import { useTaxLots, TaxLot } from '@/hooks/useTaxLots';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  FileSearch, 
  RefreshCw,
  ArrowRight,
  X,
  Check,
  HelpCircle,
  Download,
  Plus
} from 'lucide-react';

interface ExtractedTransaction {
  symbol: string;
  shares: number;
  proceeds: number;
  cost_basis: number;
  gain_loss: number;
  sale_date?: string;
  acquisition_date?: string;
  is_short_term?: boolean;
}

interface ReconciliationResult {
  status: 'matched' | 'discrepancy' | 'missing_in_lots' | 'missing_in_docs';
  documentTransaction?: ExtractedTransaction;
  taxLot?: TaxLot;
  discrepancies?: {
    field: string;
    documentValue: number | string;
    taxLotValue: number | string;
    difference?: number;
  }[];
}

export const TaxDocumentReconciliation: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [selectedMissingLots, setSelectedMissingLots] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  
  const { documents, loading: docsLoading, refetch } = useTaxDocuments(selectedYear);
  const { taxLots, loading: lotsLoading, addClosedTaxLot, refetch: refetchLots } = useTaxLots(activePortfolio?.id);

  const years = useMemo(() => {
    const yrs: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      yrs.push(y);
    }
    return yrs;
  }, [currentYear]);

  // Get extracted transactions from all completed 1099-B documents
  const extractedTransactions = useMemo((): ExtractedTransaction[] => {
    const transactions: ExtractedTransaction[] = [];
    
    documents
      .filter(d => d.document_type === '1099-B' && d.extraction_status === 'completed')
      .forEach(doc => {
        const data = doc.extracted_data as any;
        if (data?.transactions && Array.isArray(data.transactions)) {
          data.transactions.forEach((t: any) => {
            transactions.push({
              symbol: t.symbol || t.description || 'Unknown',
              shares: Number(t.shares) || 0,
              proceeds: Number(t.proceeds) || 0,
              cost_basis: Number(t.cost_basis) || 0,
              gain_loss: Number(t.gain_loss) || 0,
              sale_date: t.sale_date || t.date_sold,
              acquisition_date: t.acquisition_date || t.date_acquired || t.purchase_date,
              is_short_term: t.is_short_term ?? t.holding_period === 'short'
            });
          });
        }
      });
    
    return transactions;
  }, [documents]);

  // Get closed tax lots for the selected year
  const yearClosedLots = useMemo(() => {
    return taxLots.filter(lot => {
      if (!lot.is_closed || !lot.sale_date) return false;
      const saleYear = new Date(lot.sale_date).getFullYear();
      return saleYear === selectedYear;
    });
  }, [taxLots, selectedYear]);

  // Perform reconciliation
  const reconciliationResults = useMemo((): ReconciliationResult[] => {
    const results: ReconciliationResult[] = [];
    const matchedLotIds = new Set<string>();
    const matchedDocIndices = new Set<number>();

    // Match document transactions to tax lots
    extractedTransactions.forEach((docTx, docIdx) => {
      let bestMatch: TaxLot | null = null;
      let bestScore = 0;

      yearClosedLots.forEach(lot => {
        if (matchedLotIds.has(lot.id)) return;
        
        // Calculate match score
        let score = 0;
        if (lot.symbol.toUpperCase() === docTx.symbol.toUpperCase()) score += 50;
        if (Math.abs(lot.shares - docTx.shares) < 0.01) score += 25;
        
        const lotProceeds = (lot.sale_price || 0) * lot.shares;
        if (Math.abs(lotProceeds - docTx.proceeds) < 1) score += 15;
        
        const lotCostBasis = lot.cost_basis * lot.shares;
        if (Math.abs(lotCostBasis - docTx.cost_basis) < 1) score += 10;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = lot;
        }
      });

      if (bestMatch && bestScore >= 50) {
        matchedLotIds.add(bestMatch.id);
        matchedDocIndices.add(docIdx);

        const lot = bestMatch;
        const lotProceeds = (lot.sale_price || 0) * lot.shares;
        const lotCostBasis = lot.cost_basis * lot.shares;
        const discrepancies: ReconciliationResult['discrepancies'] = [];

        // Check for discrepancies
        if (Math.abs(lot.shares - docTx.shares) >= 0.01) {
          discrepancies.push({
            field: 'Shares',
            documentValue: docTx.shares,
            taxLotValue: lot.shares,
            difference: docTx.shares - lot.shares
          });
        }

        if (Math.abs(lotProceeds - docTx.proceeds) >= 1) {
          discrepancies.push({
            field: 'Proceeds',
            documentValue: docTx.proceeds,
            taxLotValue: lotProceeds,
            difference: docTx.proceeds - lotProceeds
          });
        }

        if (Math.abs(lotCostBasis - docTx.cost_basis) >= 1) {
          discrepancies.push({
            field: 'Cost Basis',
            documentValue: docTx.cost_basis,
            taxLotValue: lotCostBasis,
            difference: docTx.cost_basis - lotCostBasis
          });
        }

        const lotGainLoss = lot.realized_gain_loss || 0;
        if (Math.abs(lotGainLoss - docTx.gain_loss) >= 1) {
          discrepancies.push({
            field: 'Gain/Loss',
            documentValue: docTx.gain_loss,
            taxLotValue: lotGainLoss,
            difference: docTx.gain_loss - lotGainLoss
          });
        }

        results.push({
          status: discrepancies.length > 0 ? 'discrepancy' : 'matched',
          documentTransaction: docTx,
          taxLot: lot,
          discrepancies
        });
      }
    });

    // Add unmatched document transactions
    extractedTransactions.forEach((docTx, idx) => {
      if (!matchedDocIndices.has(idx)) {
        results.push({
          status: 'missing_in_lots',
          documentTransaction: docTx
        });
      }
    });

    // Add unmatched tax lots
    yearClosedLots.forEach(lot => {
      if (!matchedLotIds.has(lot.id)) {
        results.push({
          status: 'missing_in_docs',
          taxLot: lot
        });
      }
    });

    return results;
  }, [extractedTransactions, yearClosedLots]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const matched = reconciliationResults.filter(r => r.status === 'matched').length;
    const discrepancies = reconciliationResults.filter(r => r.status === 'discrepancy').length;
    const missingInLots = reconciliationResults.filter(r => r.status === 'missing_in_lots').length;
    const missingInDocs = reconciliationResults.filter(r => r.status === 'missing_in_docs').length;
    const total = reconciliationResults.length;
    const matchRate = total > 0 ? (matched / total) * 100 : 0;

    // Sum of differences
    let proceedsDiff = 0;
    let costBasisDiff = 0;
    let gainLossDiff = 0;

    reconciliationResults
      .filter(r => r.status === 'discrepancy')
      .forEach(r => {
        r.discrepancies?.forEach(d => {
          if (d.field === 'Proceeds') proceedsDiff += d.difference || 0;
          if (d.field === 'Cost Basis') costBasisDiff += d.difference || 0;
          if (d.field === 'Gain/Loss') gainLossDiff += d.difference || 0;
        });
      });

    return { matched, discrepancies, missingInLots, missingInDocs, total, matchRate, proceedsDiff, costBasisDiff, gainLossDiff };
  }, [reconciliationResults]);

  // Get missing lots from reconciliation results
  const missingInLots = useMemo(() => 
    reconciliationResults.filter(r => r.status === 'missing_in_lots'),
    [reconciliationResults]
  );

  // Handle selecting/deselecting missing lots for import
  const toggleMissingLot = (index: number) => {
    const newSet = new Set(selectedMissingLots);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedMissingLots(newSet);
  };

  const selectAllMissingLots = () => {
    if (selectedMissingLots.size === missingInLots.length) {
      setSelectedMissingLots(new Set());
    } else {
      setSelectedMissingLots(new Set(missingInLots.map((_, i) => i)));
    }
  };

  // Import selected missing lots as closed tax lots
  // Detect purchase date from 1099-B with fallback estimation
  const detectPurchaseDate = (tx: ExtractedTransaction, saleDate: string): string => {
    // Priority 1: Use explicit acquisition date from 1099-B
    if (tx.acquisition_date) {
      // Parse various date formats
      const parsed = new Date(tx.acquisition_date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    
    // Priority 2: Estimate based on holding period indicator
    const saleDateObj = new Date(saleDate);
    
    if (tx.is_short_term === true) {
      // Short-term: less than 1 year, estimate 6 months prior
      const estimated = new Date(saleDateObj.getTime() - 180 * 24 * 60 * 60 * 1000);
      return estimated.toISOString().split('T')[0];
    } else if (tx.is_short_term === false) {
      // Long-term: more than 1 year, estimate 13 months prior
      const estimated = new Date(saleDateObj.getTime() - 400 * 24 * 60 * 60 * 1000);
      return estimated.toISOString().split('T')[0];
    }
    
    // Priority 3: Default to 1 year prior if no indicator
    const defaultEstimate = new Date(saleDateObj.getTime() - 365 * 24 * 60 * 60 * 1000);
    return defaultEstimate.toISOString().split('T')[0];
  };

  // Get date source label for display
  const getDateSourceLabel = (tx: ExtractedTransaction): { label: string; isEstimated: boolean } => {
    if (tx.acquisition_date) {
      const parsed = new Date(tx.acquisition_date);
      if (!isNaN(parsed.getTime())) {
        return { label: '1099-B', isEstimated: false };
      }
    }
    if (tx.is_short_term !== undefined) {
      return { label: tx.is_short_term ? 'Est. (ST)' : 'Est. (LT)', isEstimated: true };
    }
    return { label: 'Est. (1yr)', isEstimated: true };
  };

  const importSelectedLots = async () => {
    if (!activePortfolio || selectedMissingLots.size === 0) return;
    
    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    let estimatedDates = 0;
    let exactDates = 0;

    for (const index of selectedMissingLots) {
      const result = missingInLots[index];
      const tx = result.documentTransaction;
      if (!tx) continue;

      try {
        const saleDate = tx.sale_date || `${selectedYear}-12-31`;
        const purchaseDate = detectPurchaseDate(tx, saleDate);
        const dateSource = getDateSourceLabel(tx);
        
        if (dateSource.isEstimated) {
          estimatedDates++;
        } else {
          exactDates++;
        }

        const costBasisPerShare = tx.shares > 0 ? tx.cost_basis / tx.shares : 0;
        const salePricePerShare = tx.shares > 0 ? tx.proceeds / tx.shares : 0;

        await addClosedTaxLot({
          portfolio_id: activePortfolio.id,
          holding_id: null,
          symbol: tx.symbol.replace(/\s+/g, '').toUpperCase(),
          shares: tx.shares,
          cost_basis: costBasisPerShare,
          purchase_date: purchaseDate,
          sale_date: saleDate,
          sale_price: salePricePerShare,
          realized_gain_loss: tx.gain_loss,
          lot_type: dateSource.isEstimated ? 'imported_1099b_estimated' : 'imported_1099b'
        });
        successCount++;
      } catch (err) {
        console.error('Failed to import lot:', err);
        failCount++;
      }
    }

    setIsImporting(false);
    setSelectedMissingLots(new Set());
    
    if (successCount > 0) {
      const dateInfo = exactDates > 0 
        ? `${exactDates} with exact dates, ${estimatedDates} estimated`
        : `${estimatedDates} with estimated purchase dates`;
      toast.success(`Imported ${successCount} tax lot(s) from 1099-B (${dateInfo})`);
      refetchLots();
    }
    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} lot(s)`);
    }
  };

  const loading = docsLoading || lotsLoading;

  const getStatusIcon = (status: ReconciliationResult['status']) => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'discrepancy':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'missing_in_lots':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'missing_in_docs':
        return <HelpCircle className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusLabel = (status: ReconciliationResult['status']) => {
    switch (status) {
      case 'matched':
        return 'Matched';
      case 'discrepancy':
        return 'Discrepancy';
      case 'missing_in_lots':
        return 'Missing in Tax Lots';
      case 'missing_in_docs':
        return 'Missing in 1099-B';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <FileSearch className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Tax Document Reconciliation</h3>
            <p className="text-sm text-muted-foreground">
              Compare extracted 1099-B data with tracked tax lots
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Matched</span>
            </div>
            <p className="text-2xl font-bold">{summary.matched}</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Discrepancies</span>
            </div>
            <p className="text-2xl font-bold">{summary.discrepancies}</p>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">Missing in Lots</span>
            </div>
            <p className="text-2xl font-bold">{summary.missingInLots}</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">Missing in Docs</span>
            </div>
            <p className="text-2xl font-bold">{summary.missingInDocs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Match Rate Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Reconciliation Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Match Rate</span>
              <span className="font-medium">{summary.matchRate.toFixed(1)}%</span>
            </div>
            <Progress value={summary.matchRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {summary.matched} of {summary.total} transactions fully matched
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Import Missing Lots */}
      {missingInLots.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4 text-red-500" />
              Import Missing Tax Lots
            </CardTitle>
            <CardDescription>
              Quickly create tax lots from 1099-B transactions that are missing from your records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={selectedMissingLots.size === missingInLots.length && missingInLots.length > 0}
                  onCheckedChange={selectAllMissingLots}
                />
                <span className="text-sm">
                  Select All ({missingInLots.length} transaction{missingInLots.length !== 1 ? 's' : ''})
                </span>
              </div>
              <Button 
                onClick={importSelectedLots} 
                disabled={selectedMissingLots.size === 0 || isImporting}
                size="sm"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Import {selectedMissingLots.size} Selected
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-lg border max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Proceeds</TableHead>
                    <TableHead>Cost Basis</TableHead>
                    <TableHead>Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingInLots.map((result, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedMissingLots.has(idx)}
                          onCheckedChange={() => toggleMissingLot(idx)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {result.documentTransaction?.symbol || 'Unknown'}
                      </TableCell>
                      <TableCell>{result.documentTransaction?.shares.toFixed(4)}</TableCell>
                      <TableCell>${result.documentTransaction?.proceeds.toFixed(2)}</TableCell>
                      <TableCell>${result.documentTransaction?.cost_basis.toFixed(2)}</TableCell>
                      <TableCell className={(result.documentTransaction?.gain_loss || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {(result.documentTransaction?.gain_loss || 0) >= 0 ? '+' : ''}
                        ${(result.documentTransaction?.gain_loss || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Note: Purchase dates will be estimated based on the sale date and holding period type. 
              You can edit the imported lots later if needed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Discrepancy Summary */}
      {summary.discrepancies > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Discrepancy Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Proceeds Difference</p>
                <p className={`font-semibold ${summary.proceedsDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summary.proceedsDiff >= 0 ? '+' : ''}${summary.proceedsDiff.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost Basis Difference</p>
                <p className={`font-semibold ${summary.costBasisDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summary.costBasisDiff >= 0 ? '+' : ''}${summary.costBasisDiff.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Gain/Loss Difference</p>
                <p className={`font-semibold ${summary.gainLossDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summary.gainLossDiff >= 0 ? '+' : ''}${summary.gainLossDiff.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {reconciliationResults.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSearch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Data to Reconcile</p>
            <p className="text-sm text-muted-foreground">
              Upload 1099-B documents in the Documents tab, or ensure you have closed tax lots for {selectedYear}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results */}
      {reconciliationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Details</CardTitle>
            <CardDescription>
              Review each transaction and resolve any discrepancies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {reconciliationResults.map((result, idx) => (
                <AccordionItem 
                  key={idx} 
                  value={`item-${idx}`}
                  className={`border rounded-lg px-4 ${
                    result.status === 'matched' ? 'border-emerald-500/30 bg-emerald-500/5' :
                    result.status === 'discrepancy' ? 'border-amber-500/30 bg-amber-500/5' :
                    result.status === 'missing_in_lots' ? 'border-red-500/30 bg-red-500/5' :
                    'border-blue-500/30 bg-blue-500/5'
                  }`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full">
                      {getStatusIcon(result.status)}
                      <span className="font-semibold">
                        {result.documentTransaction?.symbol || result.taxLot?.symbol || 'Unknown'}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        {getStatusLabel(result.status)}
                      </Badge>
                      {result.status === 'discrepancy' && result.discrepancies && (
                        <span className="text-xs text-muted-foreground ml-auto mr-4">
                          {result.discrepancies.length} issue{result.discrepancies.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {result.status === 'matched' && (
                      <div className="pt-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 inline mr-1 text-emerald-500" />
                        All values match between 1099-B and tax lot records.
                      </div>
                    )}

                    {result.status === 'discrepancy' && result.discrepancies && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>1099-B Value</TableHead>
                            <TableHead></TableHead>
                            <TableHead>Tax Lot Value</TableHead>
                            <TableHead>Difference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.discrepancies.map((d, dIdx) => (
                            <TableRow key={dIdx}>
                              <TableCell className="font-medium">{d.field}</TableCell>
                              <TableCell>
                                {typeof d.documentValue === 'number' 
                                  ? `$${d.documentValue.toFixed(2)}`
                                  : d.documentValue}
                              </TableCell>
                              <TableCell>
                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell>
                                {typeof d.taxLotValue === 'number'
                                  ? `$${d.taxLotValue.toFixed(2)}`
                                  : d.taxLotValue}
                              </TableCell>
                              <TableCell className={d.difference && d.difference >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                {d.difference !== undefined && (
                                  <>
                                    {d.difference >= 0 ? '+' : ''}
                                    ${d.difference.toFixed(2)}
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {result.status === 'missing_in_lots' && result.documentTransaction && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                          <p className="text-muted-foreground">
                            This transaction appears in your 1099-B but has no matching tax lot. 
                            You may need to add this lot manually.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/50 rounded-lg p-3">
                          <div>
                            <p className="text-muted-foreground">Shares</p>
                            <p className="font-medium">{result.documentTransaction.shares}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Proceeds</p>
                            <p className="font-medium">${result.documentTransaction.proceeds.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cost Basis</p>
                            <p className="font-medium">${result.documentTransaction.cost_basis.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gain/Loss</p>
                            <p className={`font-medium ${result.documentTransaction.gain_loss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              ${result.documentTransaction.gain_loss.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {result.status === 'missing_in_docs' && result.taxLot && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 text-sm">
                          <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                          <p className="text-muted-foreground">
                            This tax lot has no matching 1099-B transaction. This could be normal if the sale 
                            was from a different broker or if the document hasn't been uploaded yet.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/50 rounded-lg p-3">
                          <div>
                            <p className="text-muted-foreground">Shares</p>
                            <p className="font-medium">{result.taxLot.shares}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Proceeds</p>
                            <p className="font-medium">
                              ${((result.taxLot.sale_price || 0) * result.taxLot.shares).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cost Basis</p>
                            <p className="font-medium">
                              ${(result.taxLot.cost_basis * result.taxLot.shares).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Gain/Loss</p>
                            <p className={`font-medium ${(result.taxLot.realized_gain_loss || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              ${(result.taxLot.realized_gain_loss || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
