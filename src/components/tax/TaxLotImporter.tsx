import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ParsedTaxLot {
  symbol: string;
  shares: number;
  costBasis: number;
  purchaseDate: string;
  isValid: boolean;
  error?: string;
}

export const TaxLotImporter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedLots, setParsedLots] = useState<ParsedTaxLot[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { activePortfolio } = usePortfolio();

  const parseCSV = useCallback((content: string): ParsedTaxLot[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Find column indices
    const symbolIdx = headers.findIndex(h => ['symbol', 'ticker', 'stock'].includes(h));
    const sharesIdx = headers.findIndex(h => ['shares', 'quantity', 'qty'].includes(h));
    const costBasisIdx = headers.findIndex(h => ['cost basis', 'cost_basis', 'costbasis', 'cost', 'price', 'purchase price'].includes(h));
    const dateIdx = headers.findIndex(h => ['date', 'purchase date', 'purchase_date', 'acquired', 'acquisition date'].includes(h));

    const lots: ParsedTaxLot[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV properly handling quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const symbol = symbolIdx >= 0 ? values[symbolIdx]?.replace(/"/g, '').toUpperCase() : '';
      const sharesStr = sharesIdx >= 0 ? values[sharesIdx]?.replace(/[",]/g, '') : '';
      const costBasisStr = costBasisIdx >= 0 ? values[costBasisIdx]?.replace(/[$",]/g, '') : '';
      const dateStr = dateIdx >= 0 ? values[dateIdx]?.replace(/"/g, '') : '';

      const shares = parseFloat(sharesStr);
      const costBasis = parseFloat(costBasisStr);
      
      // Parse date
      let purchaseDate = '';
      let isValidDate = false;
      if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          purchaseDate = parsed.toISOString().split('T')[0];
          isValidDate = true;
        }
      }

      let error: string | undefined;
      if (!symbol) error = 'Missing symbol';
      else if (isNaN(shares) || shares <= 0) error = 'Invalid shares';
      else if (isNaN(costBasis) || costBasis < 0) error = 'Invalid cost basis';
      else if (!isValidDate) error = 'Invalid date';

      lots.push({
        symbol,
        shares,
        costBasis,
        purchaseDate,
        isValid: !error,
        error
      });
    }

    return lots;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedLots(parsed);
      setIsProcessing(false);
    };
    reader.readAsText(selectedFile);
  }, [parseCSV, toast]);

  const handleImport = async () => {
    if (!user || !activePortfolio) {
      toast({
        title: 'Error',
        description: 'Please select a portfolio first',
        variant: 'destructive'
      });
      return;
    }

    const validLots = parsedLots.filter(lot => lot.isValid);
    if (validLots.length === 0) {
      toast({
        title: 'No valid lots',
        description: 'Please fix the errors before importing',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);

    try {
      const lotsToInsert = validLots.map(lot => ({
        user_id: user.id,
        portfolio_id: activePortfolio.id,
        symbol: lot.symbol,
        shares: lot.shares,
        cost_basis: lot.costBasis,
        purchase_date: lot.purchaseDate,
        lot_type: 'buy',
        is_closed: false
      }));

      const { error } = await supabase
        .from('tax_lots')
        .insert(lotsToInsert);

      if (error) throw error;

      toast({
        title: 'Import successful',
        description: `Imported ${validLots.length} tax lots`
      });

      // Reset state
      setFile(null);
      setParsedLots([]);
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'Symbol,Shares,Cost Basis,Purchase Date\nAAPL,100,15000.00,2023-01-15\nMSFT,50,12500.00,2023-03-20\nGOOG,25,35000.00,2022-06-10';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tax_lots_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFile = () => {
    setFile(null);
    setParsedLots([]);
  };

  const validCount = parsedLots.filter(l => l.isValid).length;
  const invalidCount = parsedLots.filter(l => !l.isValid).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Tax Lots from CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-6">
          {!file ? (
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-primary hover:underline">Click to upload</span>
                <span className="text-muted-foreground"> or drag and drop</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFile}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="text-center py-4 text-muted-foreground">
            Processing file...
          </div>
        )}

        {parsedLots.length > 0 && (
          <>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalidCount} errors
                </Badge>
              )}
            </div>

            {invalidCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Some rows have errors and will be skipped during import.
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead>Purchase Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedLots.slice(0, 50).map((lot, idx) => (
                    <TableRow key={idx} className={!lot.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {lot.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-destructive">{lot.error}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{lot.symbol || '-'}</TableCell>
                      <TableCell className="text-right">{isNaN(lot.shares) ? '-' : lot.shares}</TableCell>
                      <TableCell className="text-right">
                        {isNaN(lot.costBasis) ? '-' : `$${lot.costBasis.toLocaleString()}`}
                      </TableCell>
                      <TableCell>{lot.purchaseDate || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedLots.length > 50 && (
              <p className="text-sm text-muted-foreground text-center">
                Showing first 50 of {parsedLots.length} rows
              </p>
            )}

            <Button 
              onClick={handleImport} 
              disabled={validCount === 0 || isImporting}
              className="w-full"
            >
              {isImporting ? 'Importing...' : `Import ${validCount} Tax Lots`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
