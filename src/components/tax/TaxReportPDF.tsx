import { Button } from '../ui/button';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { SellWithPL } from './SellTransactionsTable';

interface Props {
  sells: SellWithPL[];
  taxYear: string;
  capitalGains: {
    shortTermGains: number;
    shortTermLosses: number;
    shortTermNet: number;
    shortTermCount: number;
    longTermGains: number;
    longTermLosses: number;
    longTermNet: number;
    longTermCount: number;
  };
  portfolioName: string;
}

export const TaxReportPDF = ({ sells, taxYear, capitalGains, portfolioName }: Props) => {
  
  const generatePDF = () => {
    // Create PDF content as HTML that will be converted
    const shortTermSells = sells.filter(s => !s.isLongTerm);
    const longTermSells = sells.filter(s => s.isLongTerm);
    const washSales = sells.filter(s => s.isWashSale);
    
    const totalWashSaleDisallowed = washSales.reduce((sum, s) => sum + (s.washSaleDisallowed || 0), 0);
    
    // Net gains after wash sale adjustments
    const adjustedShortTermNet = capitalGains.shortTermNet + 
      washSales.filter(s => !s.isLongTerm).reduce((sum, s) => sum + (s.washSaleDisallowed || 0), 0);
    const adjustedLongTermNet = capitalGains.longTermNet + 
      washSales.filter(s => s.isLongTerm).reduce((sum, s) => sum + (s.washSaleDisallowed || 0), 0);

    const formatMoney = (val: number) => {
      const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return val < 0 ? `(${formatted})` : formatted;
    };

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule D - Capital Gains Tax Report ${taxYear}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1a1a1a; padding: 20px; }
    .header { text-align: center; border-bottom: 3px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
    .header h2 { font-size: 14px; color: #666; }
    .header p { font-size: 10px; color: #888; margin-top: 5px; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-header { background: #f0f0f0; padding: 8px 12px; font-weight: bold; font-size: 12px; border: 1px solid #ccc; border-bottom: none; }
    .section-header.short-term { background: #fef3c7; border-color: #f59e0b; }
    .section-header.long-term { background: #dbeafe; border-color: #3b82f6; }
    .section-header.wash-sale { background: #fee2e2; border-color: #ef4444; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f8f8f8; font-weight: 600; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    .summary-box { background: #f8fafc; border: 2px solid #1a1a1a; padding: 15px; margin-top: 20px; }
    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
    .summary-row:last-child { border-bottom: none; }
    .summary-row.total { font-weight: bold; font-size: 13px; border-top: 2px solid #1a1a1a; padding-top: 10px; margin-top: 10px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 9px; color: #666; text-align: center; }
    .wash-sale-badge { background: #fecaca; color: #991b1b; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; }
    .page-break { page-break-before: always; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SCHEDULE D - Capital Gains and Losses</h1>
    <h2>Tax Year ${taxYear}</h2>
    <p>Portfolio: ${portfolioName} | Generated: ${format(new Date(), 'MMMM d, yyyy')}</p>
  </div>

  <!-- Summary Box -->
  <div class="summary-box">
    <div class="summary-row">
      <span>Short-Term Capital Gains (${capitalGains.shortTermCount} trades)</span>
      <span class="${capitalGains.shortTermGains >= 0 ? 'positive' : 'negative'}">$${formatMoney(capitalGains.shortTermGains)}</span>
    </div>
    <div class="summary-row">
      <span>Short-Term Capital Losses</span>
      <span class="negative">($${formatMoney(Math.abs(capitalGains.shortTermLosses))})</span>
    </div>
    <div class="summary-row">
      <span><strong>Net Short-Term Gain/Loss (Line 7)</strong></span>
      <span class="${capitalGains.shortTermNet >= 0 ? 'positive' : 'negative'}"><strong>$${formatMoney(capitalGains.shortTermNet)}</strong></span>
    </div>
    <div class="summary-row">
      <span>Long-Term Capital Gains (${capitalGains.longTermCount} trades)</span>
      <span class="${capitalGains.longTermGains >= 0 ? 'positive' : 'negative'}">$${formatMoney(capitalGains.longTermGains)}</span>
    </div>
    <div class="summary-row">
      <span>Long-Term Capital Losses</span>
      <span class="negative">($${formatMoney(Math.abs(capitalGains.longTermLosses))})</span>
    </div>
    <div class="summary-row">
      <span><strong>Net Long-Term Gain/Loss (Line 15)</strong></span>
      <span class="${capitalGains.longTermNet >= 0 ? 'positive' : 'negative'}"><strong>$${formatMoney(capitalGains.longTermNet)}</strong></span>
    </div>
    ${washSales.length > 0 ? `
    <div class="summary-row" style="background: #fee2e2; margin: 5px -15px; padding: 5px 15px;">
      <span>⚠️ Wash Sale Loss Disallowed</span>
      <span class="negative">($${formatMoney(totalWashSaleDisallowed)})</span>
    </div>
    ` : ''}
    <div class="summary-row total">
      <span>NET CAPITAL GAIN/LOSS (Line 16)</span>
      <span class="${(capitalGains.shortTermNet + capitalGains.longTermNet) >= 0 ? 'positive' : 'negative'}">
        $${formatMoney(capitalGains.shortTermNet + capitalGains.longTermNet)}
      </span>
    </div>
  </div>

  <!-- Part I: Short-Term Capital Gains -->
  <div class="section">
    <div class="section-header short-term">Part I — Short-Term Capital Gains and Losses (Assets Held One Year or Less)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 15%">Date Acquired</th>
          <th style="width: 15%">Date Sold</th>
          <th style="width: 12%">Description</th>
          <th class="text-right" style="width: 14%">Proceeds</th>
          <th class="text-right" style="width: 14%">Cost Basis</th>
          <th class="text-right" style="width: 14%">Gain/(Loss)</th>
          <th class="text-center" style="width: 8%">Days</th>
          <th class="text-center" style="width: 8%">Wash</th>
        </tr>
      </thead>
      <tbody>
        ${shortTermSells.map(s => `
        <tr${s.isWashSale ? ' style="background: #fef2f2;"' : ''}>
          <td>${format(new Date(s.purchaseDate), 'MM/dd/yyyy')}</td>
          <td>${format(new Date(s.date), 'MM/dd/yyyy')}</td>
          <td>${s.symbol} (${s.shares.toFixed(4)} sh)</td>
          <td class="text-right">$${formatMoney(s.total)}</td>
          <td class="text-right">$${formatMoney(s.costBasis)}</td>
          <td class="text-right ${s.profitLoss >= 0 ? 'positive' : 'negative'}">$${formatMoney(s.profitLoss)}</td>
          <td class="text-center">${s.holdingDays}</td>
          <td class="text-center">${s.isWashSale ? '<span class="wash-sale-badge">W</span>' : ''}</td>
        </tr>
        `).join('')}
        ${shortTermSells.length === 0 ? '<tr><td colspan="8" class="text-center">No short-term transactions</td></tr>' : ''}
        <tr style="font-weight: bold; background: #fef3c7;">
          <td colspan="3">Total Short-Term</td>
          <td class="text-right">$${formatMoney(shortTermSells.reduce((s, t) => s + t.total, 0))}</td>
          <td class="text-right">$${formatMoney(shortTermSells.reduce((s, t) => s + t.costBasis, 0))}</td>
          <td class="text-right ${capitalGains.shortTermNet >= 0 ? 'positive' : 'negative'}">$${formatMoney(capitalGains.shortTermNet)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Part II: Long-Term Capital Gains -->
  <div class="section">
    <div class="section-header long-term">Part II — Long-Term Capital Gains and Losses (Assets Held More Than One Year)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 15%">Date Acquired</th>
          <th style="width: 15%">Date Sold</th>
          <th style="width: 12%">Description</th>
          <th class="text-right" style="width: 14%">Proceeds</th>
          <th class="text-right" style="width: 14%">Cost Basis</th>
          <th class="text-right" style="width: 14%">Gain/(Loss)</th>
          <th class="text-center" style="width: 8%">Days</th>
          <th class="text-center" style="width: 8%">Wash</th>
        </tr>
      </thead>
      <tbody>
        ${longTermSells.map(s => `
        <tr${s.isWashSale ? ' style="background: #fef2f2;"' : ''}>
          <td>${format(new Date(s.purchaseDate), 'MM/dd/yyyy')}</td>
          <td>${format(new Date(s.date), 'MM/dd/yyyy')}</td>
          <td>${s.symbol} (${s.shares.toFixed(4)} sh)</td>
          <td class="text-right">$${formatMoney(s.total)}</td>
          <td class="text-right">$${formatMoney(s.costBasis)}</td>
          <td class="text-right ${s.profitLoss >= 0 ? 'positive' : 'negative'}">$${formatMoney(s.profitLoss)}</td>
          <td class="text-center">${s.holdingDays}</td>
          <td class="text-center">${s.isWashSale ? '<span class="wash-sale-badge">W</span>' : ''}</td>
        </tr>
        `).join('')}
        ${longTermSells.length === 0 ? '<tr><td colspan="8" class="text-center">No long-term transactions</td></tr>' : ''}
        <tr style="font-weight: bold; background: #dbeafe;">
          <td colspan="3">Total Long-Term</td>
          <td class="text-right">$${formatMoney(longTermSells.reduce((s, t) => s + t.total, 0))}</td>
          <td class="text-right">$${formatMoney(longTermSells.reduce((s, t) => s + t.costBasis, 0))}</td>
          <td class="text-right ${capitalGains.longTermNet >= 0 ? 'positive' : 'negative'}">$${formatMoney(capitalGains.longTermNet)}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${washSales.length > 0 ? `
  <!-- Wash Sales Section -->
  <div class="section">
    <div class="section-header wash-sale">⚠️ Wash Sale Transactions (IRS Form 8949, Code W)</div>
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Date Sold</th>
          <th>Repurchase Date</th>
          <th class="text-right">Loss Amount</th>
          <th class="text-right">Disallowed</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${washSales.map(s => `
        <tr style="background: #fef2f2;">
          <td><strong>${s.symbol}</strong></td>
          <td>${format(new Date(s.date), 'MM/dd/yyyy')}</td>
          <td>Within 30 days</td>
          <td class="text-right negative">($${formatMoney(Math.abs(s.profitLoss))})</td>
          <td class="text-right negative">($${formatMoney(s.washSaleDisallowed || 0)})</td>
          <td>Loss disallowed; added to cost basis of replacement shares</td>
        </tr>
        `).join('')}
        <tr style="font-weight: bold; background: #fee2e2;">
          <td colspan="3">Total Wash Sale Adjustments</td>
          <td class="text-right negative">($${formatMoney(washSales.reduce((s, t) => s + Math.abs(t.profitLoss), 0))})</td>
          <td class="text-right negative">($${formatMoney(totalWashSaleDisallowed)})</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>This report is for informational purposes only. Consult a tax professional for official tax filings.</p>
    <p>Generated by DividendTracker Pro | ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
  </div>
</body>
</html>
    `;

    // Open print dialog with the HTML content
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Auto-trigger print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const downloadCSV = () => {
    const headers = [
      'Date Acquired',
      'Date Sold',
      'Symbol',
      'Shares',
      'Proceeds',
      'Cost Basis',
      'Gain/Loss',
      'Holding Days',
      'Term',
      'Wash Sale',
      'Disallowed Amount'
    ];

    const rows = sells.map(s => [
      format(new Date(s.purchaseDate), 'MM/dd/yyyy'),
      format(new Date(s.date), 'MM/dd/yyyy'),
      s.symbol,
      s.shares.toFixed(6),
      s.total.toFixed(2),
      s.costBasis.toFixed(2),
      s.profitLoss.toFixed(2),
      s.holdingDays.toString(),
      s.isLongTerm ? 'Long-Term' : 'Short-Term',
      s.isWashSale ? 'Yes' : 'No',
      (s.washSaleDisallowed || 0).toFixed(2)
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Schedule_D_${taxYear}_${portfolioName.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      <Button onClick={generatePDF} className="flex items-center gap-2">
        <FileText className="w-4 h-4" />
        Generate Schedule D PDF
      </Button>
      <Button variant="outline" onClick={downloadCSV} className="flex items-center gap-2">
        <Download className="w-4 h-4" />
        Export CSV
      </Button>
    </div>
  );
};
