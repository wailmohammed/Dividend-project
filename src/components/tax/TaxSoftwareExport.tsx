import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Download, FileText, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { SellWithPL } from './SellTransactionsTable';

interface Props {
  sells: SellWithPL[];
  taxYear: string;
  portfolioName: string;
}

// TXF Record Types for TurboTax
const TXF_RECORD_TYPES = {
  SHORT_TERM_COVERED: 321, // Short-term basis reported to IRS
  SHORT_TERM_NOT_COVERED: 323, // Short-term basis not reported
  LONG_TERM_COVERED: 711, // Long-term basis reported to IRS
  LONG_TERM_NOT_COVERED: 713, // Long-term basis not reported
};

export const TaxSoftwareExport = ({ sells, taxYear, portfolioName }: Props) => {
  const [basisReported, setBasisReported] = useState<boolean>(true);

  const shortTermSells = sells.filter(s => !s.isLongTerm);
  const longTermSells = sells.filter(s => s.isLongTerm);
  const washSaleCount = sells.filter(s => s.isWashSale).length;

  // Generate TurboTax TXF format
  const generateTXF = (): string => {
    let txfContent = `V042\nADividendTracker Pro\nD${format(new Date(), 'MM/dd/yyyy')}\n^\n`;

    sells.forEach(sell => {
      const recordType = sell.isLongTerm
        ? (basisReported ? TXF_RECORD_TYPES.LONG_TERM_COVERED : TXF_RECORD_TYPES.LONG_TERM_NOT_COVERED)
        : (basisReported ? TXF_RECORD_TYPES.SHORT_TERM_COVERED : TXF_RECORD_TYPES.SHORT_TERM_NOT_COVERED);

      // Adjust for wash sales
      const adjustedCostBasis = sell.isWashSale 
        ? sell.costBasis + (sell.washSaleDisallowed || 0)
        : sell.costBasis;

      // TXF format fields
      txfContent += `TD\n`;
      txfContent += `N${recordType}\n`;
      txfContent += `C1\n`;
      txfContent += `L1\n`;
      txfContent += `P${sell.symbol} (${sell.shares.toFixed(4)} shares)\n`;
      txfContent += `D${format(new Date(sell.purchaseDate), 'MM/dd/yyyy')}\n`;
      txfContent += `D${format(new Date(sell.date), 'MM/dd/yyyy')}\n`;
      txfContent += `$${adjustedCostBasis.toFixed(2)}\n`;
      txfContent += `$${sell.total.toFixed(2)}\n`;
      if (sell.isWashSale) {
        txfContent += `$${(sell.washSaleDisallowed || 0).toFixed(2)}\n`;
        txfContent += `XW\n`; // Wash sale indicator
      }
      txfContent += `^\n`;
    });

    return txfContent;
  };

  // Generate H&R Block format (CSV with specific columns)
  const generateHRBlock = (): string => {
    const headers = [
      'Description of Property',
      'Date Acquired',
      'Date Sold',
      'Sales Price',
      'Cost or Other Basis',
      'Adjustment Code',
      'Adjustment Amount',
      'Gain or Loss',
      'Short/Long Term',
      'Basis Reported to IRS'
    ];

    const rows = sells.map(sell => {
      const adjustmentAmount = sell.isWashSale ? (sell.washSaleDisallowed || 0) : 0;
      const adjustedGainLoss = sell.profitLoss + adjustmentAmount;

      return [
        `${sell.symbol} (${sell.shares.toFixed(4)} shares)`,
        format(new Date(sell.purchaseDate), 'MM/dd/yyyy'),
        format(new Date(sell.date), 'MM/dd/yyyy'),
        sell.total.toFixed(2),
        sell.costBasis.toFixed(2),
        sell.isWashSale ? 'W' : '',
        adjustmentAmount.toFixed(2),
        adjustedGainLoss.toFixed(2),
        sell.isLongTerm ? 'Long-Term' : 'Short-Term',
        basisReported ? 'Yes' : 'No'
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  };

  // Generate generic tax software CSV (compatible with most platforms)
  const generateGenericCSV = (): string => {
    const headers = [
      'Security',
      'Shares',
      'Date Acquired',
      'Date Sold',
      'Proceeds',
      'Cost Basis',
      'Wash Sale Disallowed',
      'Gain/Loss',
      'Term',
      'Holding Days',
      'Wash Sale'
    ];

    const rows = sells.map(sell => [
      sell.symbol,
      sell.shares.toFixed(6),
      format(new Date(sell.purchaseDate), 'yyyy-MM-dd'),
      format(new Date(sell.date), 'yyyy-MM-dd'),
      sell.total.toFixed(2),
      sell.costBasis.toFixed(2),
      (sell.washSaleDisallowed || 0).toFixed(2),
      sell.profitLoss.toFixed(2),
      sell.isLongTerm ? 'LONG' : 'SHORT',
      sell.holdingDays.toString(),
      sell.isWashSale ? 'YES' : 'NO'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTXF = () => {
    const content = generateTXF();
    downloadFile(content, `TurboTax_${taxYear}_${portfolioName.replace(/\s+/g, '_')}.txf`, 'text/plain');
  };

  const handleDownloadHRBlock = () => {
    const content = generateHRBlock();
    downloadFile(content, `HRBlock_${taxYear}_${portfolioName.replace(/\s+/g, '_')}.csv`, 'text/csv');
  };

  const handleDownloadGeneric = () => {
    const content = generateGenericCSV();
    downloadFile(content, `CapitalGains_${taxYear}_${portfolioName.replace(/\s+/g, '_')}.csv`, 'text/csv');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Tax Software Export
        </CardTitle>
        <CardDescription>
          Export your capital gains data for TurboTax, H&R Block, and other tax software
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transaction Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/30 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
            <p className="text-lg font-bold">{sells.length}</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-600 mb-1">Short-Term</p>
            <p className="text-lg font-bold">{shortTermSells.length}</p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-600 mb-1">Long-Term</p>
            <p className="text-lg font-bold">{longTermSells.length}</p>
          </div>
          {washSaleCount > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-600 mb-1">Wash Sales</p>
              <p className="text-lg font-bold">{washSaleCount}</p>
            </div>
          )}
        </div>

        {/* Basis Reporting Option */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Basis Reported to IRS</p>
              <p className="text-sm text-muted-foreground">
                Was your cost basis reported on Form 1099-B?
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={basisReported ? 'default' : 'outline'}
                onClick={() => setBasisReported(true)}
              >
                Yes (Box A/D)
              </Button>
              <Button
                size="sm"
                variant={!basisReported ? 'default' : 'outline'}
                onClick={() => setBasisReported(false)}
              >
                No (Box B/E)
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Export Options */}
        <div className="space-y-4">
          <h4 className="font-semibold">Export Formats</h4>
          
          {/* TurboTax TXF */}
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">TurboTax (TXF)</span>
                  <Badge variant="secondary">.txf</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Native import format for TurboTax Desktop & Online
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600">Includes wash sale adjustments</span>
                </div>
              </div>
            </div>
            <Button onClick={handleDownloadTXF} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>

          {/* H&R Block */}
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">H&R Block</span>
                  <Badge variant="secondary">.csv</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Formatted CSV for H&R Block import wizard
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600">Form 8949 compatible columns</span>
                </div>
              </div>
            </div>
            <Button onClick={handleDownloadHRBlock} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>

          {/* Generic CSV */}
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Generic CSV</span>
                  <Badge variant="secondary">.csv</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Universal format for TaxAct, FreeTaxUSA, Excel, accountants
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600">Complete transaction details</span>
                </div>
              </div>
            </div>
            <Button onClick={handleDownloadGeneric} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Wash Sale Warning */}
        {washSaleCount > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                Wash Sale Adjustments Included
              </p>
              <p className="text-muted-foreground text-xs">
                {washSaleCount} transaction(s) have wash sale adjustments (Code W). These exports include 
                the disallowed loss amounts that will be added to the cost basis of replacement shares. 
                Verify with your tax professional.
              </p>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Import Instructions</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li><strong>TurboTax:</strong> File → Import → From Accounting Software → TXF file</li>
              <li><strong>H&R Block:</strong> Income → Investment Income → Import → CSV file</li>
              <li><strong>TaxAct:</strong> Federal → Investment Income → Import from file</li>
              <li><strong>Accountant:</strong> Provide the Generic CSV for manual entry</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
