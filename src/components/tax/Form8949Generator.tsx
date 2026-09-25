import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { FileText, Download, AlertTriangle, Info, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { SellWithPL } from './SellTransactionsTable';

interface Props {
  sells: SellWithPL[];
  taxYear: string;
  portfolioName: string;
}

// IRS Form 8949 Adjustment Codes
const ADJUSTMENT_CODES = {
  B: 'Basis reported to IRS is incorrect',
  D: 'Disallowed wash sale loss',
  W: 'Wash sale disallowed',
  H: 'Holding period adjusted',
  M: 'Multiple codes apply',
  O: 'Other adjustment',
};

interface Form8949Entry {
  description: string; // (a) Description of property
  dateAcquired: string; // (b) Date acquired
  dateSold: string; // (c) Date sold
  proceeds: number; // (d) Proceeds (sales price)
  costBasis: number; // (e) Cost or other basis
  adjustmentCode: string; // (f) Code(s) from instructions
  adjustmentAmount: number; // (g) Amount of adjustment
  gainOrLoss: number; // (h) Gain or (loss)
  symbol: string;
  shares: number;
  isWashSale: boolean;
}

export const Form8949Generator = ({ sells, taxYear, portfolioName }: Props) => {
  const [basisReportingType, setBasisReportingType] = useState<'A' | 'B' | 'C'>('A');

  // Transform sells into Form 8949 entries
  const generateEntries = (): { shortTerm: Form8949Entry[]; longTerm: Form8949Entry[] } => {
    const shortTerm: Form8949Entry[] = [];
    const longTerm: Form8949Entry[] = [];

    sells.forEach(sell => {
      const entry: Form8949Entry = {
        description: `${sell.symbol} (${sell.shares.toFixed(4)} shares)`,
        dateAcquired: format(new Date(sell.purchaseDate), 'MM/dd/yyyy'),
        dateSold: format(new Date(sell.date), 'MM/dd/yyyy'),
        proceeds: sell.total,
        costBasis: sell.costBasis,
        adjustmentCode: sell.isWashSale ? 'W' : '',
        adjustmentAmount: sell.isWashSale ? (sell.washSaleDisallowed || 0) : 0,
        gainOrLoss: sell.isWashSale 
          ? sell.profitLoss + (sell.washSaleDisallowed || 0) // Adjusted gain/loss after wash sale
          : sell.profitLoss,
        symbol: sell.symbol,
        shares: sell.shares,
        isWashSale: sell.isWashSale || false,
      };

      if (sell.isLongTerm) {
        longTerm.push(entry);
      } else {
        shortTerm.push(entry);
      }
    });

    return { shortTerm, longTerm };
  };

  const entries = generateEntries();
  const washSaleCount = sells.filter(s => s.isWashSale).length;
  const totalWashSaleAdjustment = sells
    .filter(s => s.isWashSale)
    .reduce((sum, s) => sum + (s.washSaleDisallowed || 0), 0);

  // Calculate totals for each part
  const calculateTotals = (entries: Form8949Entry[]) => ({
    proceeds: entries.reduce((sum, e) => sum + e.proceeds, 0),
    costBasis: entries.reduce((sum, e) => sum + e.costBasis, 0),
    adjustments: entries.reduce((sum, e) => sum + e.adjustmentAmount, 0),
    gainOrLoss: entries.reduce((sum, e) => sum + e.gainOrLoss, 0),
  });

  const shortTermTotals = calculateTotals(entries.shortTerm);
  const longTermTotals = calculateTotals(entries.longTerm);

  const formatMoney = (val: number) => {
    const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `(${formatted})` : formatted;
  };

  const generateForm8949HTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Form 8949 - Sales and Other Dispositions of Capital Assets (${taxYear})</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.3; color: #000; padding: 15px; background: #fff; }
    .form-container { max-width: 8.5in; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .header h1 { font-size: 16px; font-weight: bold; }
    .header h2 { font-size: 12px; margin-top: 3px; }
    .header p { font-size: 9px; color: #666; margin-top: 5px; }
    .taxpayer-info { border: 1px solid #000; padding: 8px; margin-bottom: 15px; }
    .taxpayer-info p { margin: 3px 0; }
    .checkbox-group { margin: 10px 0; padding: 8px; border: 1px solid #000; background: #f9f9f9; }
    .checkbox-label { display: flex; align-items: center; margin: 5px 0; font-size: 9px; }
    .checkbox { width: 12px; height: 12px; border: 1px solid #000; margin-right: 5px; display: inline-flex; align-items: center; justify-content: center; }
    .checkbox.checked::after { content: '✓'; font-size: 10px; }
    .part-header { background: #000; color: #fff; padding: 5px 10px; font-weight: bold; font-size: 11px; margin: 15px 0 5px 0; }
    .part-header.short-term { background: #b45309; }
    .part-header.long-term { background: #1d4ed8; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 15px; }
    th, td { border: 1px solid #000; padding: 4px 3px; text-align: left; }
    th { background: #e5e5e5; font-weight: bold; font-size: 8px; }
    .col-a { width: 20%; }
    .col-b, .col-c { width: 10%; }
    .col-d, .col-e, .col-g, .col-h { width: 12%; text-align: right; }
    .col-f { width: 5%; text-align: center; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals-row { font-weight: bold; background: #f0f0f0; }
    .wash-sale { background: #fef2f2; }
    .wash-sale-code { color: #dc2626; font-weight: bold; }
    .adjustment-note { font-size: 8px; color: #666; padding: 5px; border: 1px dashed #ccc; margin: 10px 0; }
    .summary-box { border: 2px solid #000; padding: 10px; margin-top: 15px; background: #fafafa; }
    .summary-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #ccc; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row.total { font-weight: bold; font-size: 11px; margin-top: 5px; padding-top: 5px; border-top: 2px solid #000; }
    .footer { margin-top: 20px; font-size: 8px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
    .code-legend { margin-top: 15px; padding: 8px; border: 1px solid #ccc; background: #f9f9f9; font-size: 8px; }
    .code-legend h4 { font-size: 9px; margin-bottom: 5px; }
    .page-break { page-break-before: always; }
    @media print {
      body { padding: 0.25in; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h1>Form 8949</h1>
      <h2>Sales and Other Dispositions of Capital Assets</h2>
      <p>Department of the Treasury — Internal Revenue Service</p>
      <p>▶ Go to www.irs.gov/Form8949 for instructions and the latest information.</p>
      <p>▶ File with your Schedule D to list your transactions for lines 1b, 2, 3, 8b, 9, and 10.</p>
    </div>

    <div class="taxpayer-info">
      <p><strong>Name(s) shown on return:</strong> [Your Name]</p>
      <p><strong>Social Security Number:</strong> [XXX-XX-XXXX]</p>
      <p><strong>Tax Year:</strong> ${taxYear}</p>
      <p><strong>Portfolio:</strong> ${portfolioName}</p>
    </div>

    <!-- Basis Reporting Checkbox -->
    <div class="checkbox-group">
      <p><strong>Check Box A, B, or C below. Check only one box.</strong></p>
      <p style="font-size: 8px; color: #666; margin-bottom: 5px;">Check the box that describes how you received your 1099-B (or substitute statement).</p>
      <label class="checkbox-label">
        <div class="checkbox ${basisReportingType === 'A' ? 'checked' : ''}"></div>
        <strong>(A)</strong> Short-term transactions reported on Form(s) 1099-B showing basis was reported to the IRS
      </label>
      <label class="checkbox-label">
        <div class="checkbox ${basisReportingType === 'B' ? 'checked' : ''}"></div>
        <strong>(B)</strong> Short-term transactions reported on Form(s) 1099-B showing basis was <strong>not</strong> reported to the IRS
      </label>
      <label class="checkbox-label">
        <div class="checkbox"></div>
        <strong>(C)</strong> Short-term transactions not reported to you on Form 1099-B
      </label>
    </div>

    <!-- Part I: Short-Term -->
    <div class="part-header short-term">PART I — Short-Term Capital Gains and Losses (Assets Held One Year or Less)</div>
    
    ${entries.shortTerm.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th class="col-a">(a) Description of property<br/>(Example: 100 shares XYZ Co.)</th>
          <th class="col-b">(b) Date acquired<br/>(Mo., day, yr.)</th>
          <th class="col-c">(c) Date sold<br/>(Mo., day, yr.)</th>
          <th class="col-d">(d) Proceeds<br/>(sales price)</th>
          <th class="col-e">(e) Cost or<br/>other basis</th>
          <th class="col-f">(f) Code</th>
          <th class="col-g">(g) Adjustment<br/>to gain or loss</th>
          <th class="col-h">(h) Gain or (loss)<br/>Subtract (e) from (d)<br/>and combine with (g)</th>
        </tr>
      </thead>
      <tbody>
        ${entries.shortTerm.map(e => `
        <tr class="${e.isWashSale ? 'wash-sale' : ''}">
          <td>${e.description}</td>
          <td class="text-center">${e.dateAcquired}</td>
          <td class="text-center">${e.dateSold}</td>
          <td class="text-right">$${formatMoney(e.proceeds)}</td>
          <td class="text-right">$${formatMoney(e.costBasis)}</td>
          <td class="text-center ${e.isWashSale ? 'wash-sale-code' : ''}">${e.adjustmentCode}</td>
          <td class="text-right">${e.adjustmentAmount !== 0 ? '$' + formatMoney(e.adjustmentAmount) : ''}</td>
          <td class="text-right">$${formatMoney(e.gainOrLoss)}</td>
        </tr>
        `).join('')}
        <tr class="totals-row">
          <td colspan="3"><strong>2. Totals.</strong> Add columns (d), (e), (g), and (h)</td>
          <td class="text-right"><strong>$${formatMoney(shortTermTotals.proceeds)}</strong></td>
          <td class="text-right"><strong>$${formatMoney(shortTermTotals.costBasis)}</strong></td>
          <td></td>
          <td class="text-right"><strong>${shortTermTotals.adjustments !== 0 ? '$' + formatMoney(shortTermTotals.adjustments) : ''}</strong></td>
          <td class="text-right"><strong>$${formatMoney(shortTermTotals.gainOrLoss)}</strong></td>
        </tr>
      </tbody>
    </table>
    ` : '<p style="padding: 10px; color: #666;">No short-term transactions for this period.</p>'}

    <!-- Part II: Long-Term -->
    <div class="part-header long-term">PART II — Long-Term Capital Gains and Losses (Assets Held More Than One Year)</div>
    
    ${entries.longTerm.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th class="col-a">(a) Description of property</th>
          <th class="col-b">(b) Date acquired</th>
          <th class="col-c">(c) Date sold</th>
          <th class="col-d">(d) Proceeds</th>
          <th class="col-e">(e) Cost basis</th>
          <th class="col-f">(f) Code</th>
          <th class="col-g">(g) Adjustment</th>
          <th class="col-h">(h) Gain/(loss)</th>
        </tr>
      </thead>
      <tbody>
        ${entries.longTerm.map(e => `
        <tr class="${e.isWashSale ? 'wash-sale' : ''}">
          <td>${e.description}</td>
          <td class="text-center">${e.dateAcquired}</td>
          <td class="text-center">${e.dateSold}</td>
          <td class="text-right">$${formatMoney(e.proceeds)}</td>
          <td class="text-right">$${formatMoney(e.costBasis)}</td>
          <td class="text-center ${e.isWashSale ? 'wash-sale-code' : ''}">${e.adjustmentCode}</td>
          <td class="text-right">${e.adjustmentAmount !== 0 ? '$' + formatMoney(e.adjustmentAmount) : ''}</td>
          <td class="text-right">$${formatMoney(e.gainOrLoss)}</td>
        </tr>
        `).join('')}
        <tr class="totals-row">
          <td colspan="3"><strong>2. Totals.</strong> Add columns (d), (e), (g), and (h)</td>
          <td class="text-right"><strong>$${formatMoney(longTermTotals.proceeds)}</strong></td>
          <td class="text-right"><strong>$${formatMoney(longTermTotals.costBasis)}</strong></td>
          <td></td>
          <td class="text-right"><strong>${longTermTotals.adjustments !== 0 ? '$' + formatMoney(longTermTotals.adjustments) : ''}</strong></td>
          <td class="text-right"><strong>$${formatMoney(longTermTotals.gainOrLoss)}</strong></td>
        </tr>
      </tbody>
    </table>
    ` : '<p style="padding: 10px; color: #666;">No long-term transactions for this period.</p>'}

    <!-- Wash Sale Summary -->
    ${washSaleCount > 0 ? `
    <div class="adjustment-note">
      <strong>⚠️ Wash Sale Adjustments (Code W):</strong><br/>
      ${washSaleCount} transaction(s) flagged as wash sales with total disallowed loss of <strong>$${formatMoney(totalWashSaleAdjustment)}</strong>.<br/>
      The disallowed loss has been added to the cost basis of replacement shares.
    </div>
    ` : ''}

    <!-- Summary Box -->
    <div class="summary-box">
      <h4 style="margin-bottom: 8px; font-size: 11px;">Summary for Schedule D</h4>
      <div class="summary-row">
        <span>Short-Term Net Gain/(Loss) — Enter on Schedule D, Line 1b, 2, or 3</span>
        <span><strong>$${formatMoney(shortTermTotals.gainOrLoss)}</strong></span>
      </div>
      <div class="summary-row">
        <span>Long-Term Net Gain/(Loss) — Enter on Schedule D, Line 8b, 9, or 10</span>
        <span><strong>$${formatMoney(longTermTotals.gainOrLoss)}</strong></span>
      </div>
      <div class="summary-row total">
        <span>Total Net Capital Gain/(Loss)</span>
        <span><strong>$${formatMoney(shortTermTotals.gainOrLoss + longTermTotals.gainOrLoss)}</strong></span>
      </div>
    </div>

    <!-- Code Legend -->
    <div class="code-legend">
      <h4>Adjustment Codes Reference:</h4>
      <p><strong>W</strong> - Wash sale. Your loss is disallowed because you acquired substantially identical stock within 30 days before or after the sale.</p>
      <p><strong>B</strong> - Basis as reported to you on Form 1099-B is incorrect.</p>
      <p><strong>D</strong> - Market discount.</p>
      <p><strong>H</strong> - Short-term gain or loss on a contract or straddle.</p>
      <p><strong>M</strong> - Multiple codes apply. Enter more than one code in column (f).</p>
    </div>

    <div class="footer">
      <p>This form is generated for informational purposes only. Please verify all information with your tax professional.</p>
      <p>Generated by DividendTracker Pro | Tax Year ${taxYear} | ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
    </div>
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const downloadCSV = () => {
    const allEntries = [...entries.shortTerm, ...entries.longTerm];
    
    const headers = [
      'Description',
      'Date Acquired',
      'Date Sold',
      'Proceeds',
      'Cost Basis',
      'Adjustment Code',
      'Adjustment Amount',
      'Gain/Loss',
      'Term',
      'Wash Sale'
    ];

    const rows = allEntries.map(e => [
      e.description,
      e.dateAcquired,
      e.dateSold,
      e.proceeds.toFixed(2),
      e.costBasis.toFixed(2),
      e.adjustmentCode,
      e.adjustmentAmount.toFixed(2),
      e.gainOrLoss.toFixed(2),
      entries.shortTerm.includes(e) ? 'Short-Term' : 'Long-Term',
      e.isWashSale ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Form_8949_${taxYear}_${portfolioName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          IRS Form 8949 Generator
        </CardTitle>
        <CardDescription>
          Generate Form 8949 with wash sale adjustments and proper codes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">About Form 8949</p>
            <p className="text-muted-foreground text-xs">
              Form 8949 reports sales and exchanges of capital assets. Each transaction is listed with 
              acquisition date, sale date, proceeds, cost basis, and any adjustments (like wash sales). 
              Totals from this form transfer to Schedule D.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-600 mb-1">Short-Term Transactions</p>
            <p className="text-lg font-bold">{entries.shortTerm.length}</p>
          </div>
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-600 mb-1">Long-Term Transactions</p>
            <p className="text-lg font-bold">{entries.longTerm.length}</p>
          </div>
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-xs text-red-600 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Wash Sales
            </p>
            <p className="text-lg font-bold">{washSaleCount}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Wash Sale Adjustments</p>
            <p className="text-lg font-bold text-red-500">
              ${totalWashSaleAdjustment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Basis Reporting Type Selector */}
        <div className="flex items-center gap-4">
          <Label htmlFor="basis-type" className="shrink-0">1099-B Basis Reporting:</Label>
          <Select value={basisReportingType} onValueChange={(v: 'A' | 'B' | 'C') => setBasisReportingType(v)}>
            <SelectTrigger id="basis-type" className="w-[300px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">(A) Basis reported to IRS</SelectItem>
              <SelectItem value="B">(B) Basis NOT reported to IRS</SelectItem>
              <SelectItem value="C">(C) Not reported on 1099-B</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Preview */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 p-3 border-b">
            <h4 className="font-medium">Summary for Schedule D</h4>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Short-Term Net (Line 1b/2/3)</span>
              <span className={`font-medium ${shortTermTotals.gainOrLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                ${formatMoney(shortTermTotals.gainOrLoss)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Long-Term Net (Line 8b/9/10)</span>
              <span className={`font-medium ${longTermTotals.gainOrLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                ${formatMoney(longTermTotals.gainOrLoss)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium">Total Net Capital Gain/Loss</span>
              <span className={`font-bold ${(shortTermTotals.gainOrLoss + longTermTotals.gainOrLoss) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                ${formatMoney(shortTermTotals.gainOrLoss + longTermTotals.gainOrLoss)}
              </span>
            </div>
          </div>
        </div>

        {/* Wash Sale Warning */}
        {washSaleCount > 0 && (
          <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-700 dark:text-red-400 mb-1">
                {washSaleCount} Wash Sale{washSaleCount > 1 ? 's' : ''} Detected
              </p>
              <p className="text-muted-foreground text-xs">
                Transactions marked with code "W" have disallowed losses of ${totalWashSaleAdjustment.toLocaleString(undefined, { maximumFractionDigits: 2 })}. 
                These losses are added to the cost basis of replacement shares and will be recovered when those shares are sold.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={generateForm8949HTML} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Generate Form 8949 PDF
          </Button>
          <Button variant="outline" onClick={downloadCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV for TurboTax
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-amber-700 dark:text-amber-400">
            <strong>Disclaimer:</strong> This form is generated for informational purposes only. 
            Please verify all information with your tax professional or CPA before filing. 
            Tax laws are complex and this tool may not account for all scenarios.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
