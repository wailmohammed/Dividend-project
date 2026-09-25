import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { FileText, Printer, Info, Calculator, ArrowRight, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { SellWithPL } from './SellTransactionsTable';

interface Props {
  sells: SellWithPL[];
  taxYear: string;
  portfolioName: string;
}

export const ScheduleDSummary = ({ sells, taxYear, portfolioName }: Props) => {
  const [priorYearCarryover, setPriorYearCarryover] = useState<string>('0');
  
  // Separate short-term and long-term
  const shortTermSells = sells.filter(s => !s.isLongTerm);
  const longTermSells = sells.filter(s => s.isLongTerm);
  const washSales = sells.filter(s => s.isWashSale);

  // Calculate Form 8949 totals
  const shortTermProceeds = shortTermSells.reduce((sum, s) => sum + s.total, 0);
  const shortTermCostBasis = shortTermSells.reduce((sum, s) => sum + s.costBasis, 0);
  const shortTermWashAdjustment = shortTermSells
    .filter(s => s.isWashSale)
    .reduce((sum, s) => sum + (s.washSaleDisallowed || 0), 0);
  const shortTermGainLoss = shortTermSells.reduce((sum, s) => sum + s.profitLoss, 0);

  const longTermProceeds = longTermSells.reduce((sum, s) => sum + s.total, 0);
  const longTermCostBasis = longTermSells.reduce((sum, s) => sum + s.costBasis, 0);
  const longTermWashAdjustment = longTermSells
    .filter(s => s.isWashSale)
    .reduce((sum, s) => sum + (s.washSaleDisallowed || 0), 0);
  const longTermGainLoss = longTermSells.reduce((sum, s) => sum + s.profitLoss, 0);

  // Prior year carryover (negative = loss carryover)
  const carryover = parseFloat(priorYearCarryover) || 0;

  // Net short-term and long-term
  const netShortTerm = shortTermGainLoss;
  const netLongTerm = longTermGainLoss;

  // Apply carryover logic per IRS rules
  // Carryover losses first offset same-type gains, then opposite type
  let shortTermAfterCarryover = netShortTerm;
  let longTermAfterCarryover = netLongTerm;
  let remainingCarryover = carryover;

  if (carryover < 0) {
    // Apply short-term carryover loss first
    if (shortTermAfterCarryover > 0) {
      const stOffset = Math.min(shortTermAfterCarryover, Math.abs(remainingCarryover));
      shortTermAfterCarryover -= stOffset;
      remainingCarryover += stOffset;
    }
    // Then apply to long-term
    if (remainingCarryover < 0 && longTermAfterCarryover > 0) {
      const ltOffset = Math.min(longTermAfterCarryover, Math.abs(remainingCarryover));
      longTermAfterCarryover -= ltOffset;
      remainingCarryover += ltOffset;
    }
  }

  // Total net gain/loss
  const totalNetGainLoss = shortTermAfterCarryover + longTermAfterCarryover;

  // Capital loss limitation ($3,000 per year)
  const ANNUAL_LOSS_LIMIT = 3000;
  const deductibleLoss = totalNetGainLoss < 0 
    ? Math.max(totalNetGainLoss, -ANNUAL_LOSS_LIMIT) 
    : totalNetGainLoss;
  const newCarryover = totalNetGainLoss < -ANNUAL_LOSS_LIMIT 
    ? totalNetGainLoss + ANNUAL_LOSS_LIMIT 
    : 0;

  const formatMoney = (val: number) => {
    const formatted = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val < 0 ? `(${formatted})` : formatted;
  };

  const generateScheduleDHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schedule D - Capital Gains and Losses (${taxYear})</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.4; color: #000; padding: 20px; background: #fff; }
    .form-container { max-width: 8.5in; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #000; padding-bottom: 15px; }
    .header h1 { font-size: 18px; font-weight: bold; }
    .header h2 { font-size: 12px; margin-top: 5px; }
    .header p { font-size: 9px; color: #666; margin-top: 3px; }
    .taxpayer-info { border: 1px solid #000; padding: 10px; margin-bottom: 15px; background: #fafafa; }
    .part-header { background: #000; color: #fff; padding: 8px 12px; font-weight: bold; font-size: 11px; margin: 20px 0 10px 0; }
    .part-header.short-term { background: #b45309; }
    .part-header.long-term { background: #1d4ed8; }
    .part-header.summary { background: #059669; }
    .line-item { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    .line-item:hover { background: #f9fafb; }
    .line-item .label { flex: 1; }
    .line-item .line-number { width: 30px; font-weight: bold; color: #666; }
    .line-item .amount { width: 120px; text-align: right; font-family: 'Courier New', monospace; }
    .line-item.subtotal { background: #f3f4f6; font-weight: bold; }
    .line-item.total { background: #000; color: #fff; font-weight: bold; font-size: 12px; }
    .line-item.negative .amount { color: #dc2626; }
    .line-item.positive .amount { color: #059669; }
    .section-box { border: 1px solid #ccc; margin: 15px 0; }
    .instructions { font-size: 8px; color: #666; padding: 8px 12px; background: #fffbeb; border-top: 1px dashed #ccc; }
    .carryover-box { border: 2px solid #dc2626; padding: 15px; margin: 20px 0; background: #fef2f2; }
    .carryover-box h4 { color: #dc2626; margin-bottom: 8px; }
    .wash-sale-summary { border: 2px solid #f59e0b; padding: 12px; margin: 15px 0; background: #fffbeb; }
    .footer { margin-top: 30px; font-size: 8px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 15px; }
    @media print {
      body { padding: 0.25in; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h1>SCHEDULE D (Form 1040)</h1>
      <h2>Capital Gains and Losses</h2>
      <p>Department of the Treasury — Internal Revenue Service</p>
      <p>▶ Attach to Form 1040, 1040-SR, or 1040-NR.</p>
      <p>▶ Go to www.irs.gov/ScheduleD for instructions and the latest information.</p>
    </div>

    <div class="taxpayer-info">
      <p><strong>Name(s) shown on return:</strong> [Your Name]</p>
      <p><strong>Your social security number:</strong> [XXX-XX-XXXX]</p>
      <p><strong>Tax Year:</strong> ${taxYear} | <strong>Portfolio:</strong> ${portfolioName}</p>
    </div>

    <!-- Part I: Short-Term -->
    <div class="part-header short-term">Part I — Short-Term Capital Gains and Losses (Assets Held One Year or Less)</div>
    <div class="section-box">
      <div class="line-item">
        <span class="line-number">1b</span>
        <span class="label">Totals from Form(s) 8949 with Box A checked</span>
        <span class="amount">$${formatMoney(shortTermProceeds)} / $${formatMoney(shortTermCostBasis)}</span>
      </div>
      <div class="line-item">
        <span class="line-number">2</span>
        <span class="label">Totals from Form(s) 8949 with Box B checked</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">3</span>
        <span class="label">Totals from Form(s) 8949 with Box C checked</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">4</span>
        <span class="label">Short-term gain from Form 6252, installment sales</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">5</span>
        <span class="label">Net short-term gain or (loss) from partnerships, S corps, estates, trusts</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">6</span>
        <span class="label">Short-term capital loss carryover from prior year</span>
        <span class="amount">${carryover < 0 ? '$' + formatMoney(carryover) : '—'}</span>
      </div>
      <div class="line-item subtotal ${netShortTerm >= 0 ? 'positive' : 'negative'}">
        <span class="line-number">7</span>
        <span class="label"><strong>Net short-term capital gain or (loss).</strong> Combine lines 1a–6 in column (h).</span>
        <span class="amount"><strong>$${formatMoney(shortTermAfterCarryover)}</strong></span>
      </div>
      <div class="instructions">
        Enter on Form 1040 or 1040-SR, line 7. If a gain, also enter on Schedule 1 (Form 1040), line 4.
      </div>
    </div>

    <!-- Part II: Long-Term -->
    <div class="part-header long-term">Part II — Long-Term Capital Gains and Losses (Assets Held More Than One Year)</div>
    <div class="section-box">
      <div class="line-item">
        <span class="line-number">8b</span>
        <span class="label">Totals from Form(s) 8949 with Box D checked</span>
        <span class="amount">$${formatMoney(longTermProceeds)} / $${formatMoney(longTermCostBasis)}</span>
      </div>
      <div class="line-item">
        <span class="line-number">9</span>
        <span class="label">Totals from Form(s) 8949 with Box E checked</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">10</span>
        <span class="label">Totals from Form(s) 8949 with Box F checked</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">11</span>
        <span class="label">Gain from Form 4797, sales of business property</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">12</span>
        <span class="label">Net long-term gain or (loss) from partnerships, S corps, estates, trusts</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">13</span>
        <span class="label">Capital gain distributions</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item">
        <span class="line-number">14</span>
        <span class="label">Long-term capital loss carryover from prior year</span>
        <span class="amount">—</span>
      </div>
      <div class="line-item subtotal ${netLongTerm >= 0 ? 'positive' : 'negative'}">
        <span class="line-number">15</span>
        <span class="label"><strong>Net long-term capital gain or (loss).</strong> Combine lines 8a–14 in column (h).</span>
        <span class="amount"><strong>$${formatMoney(longTermAfterCarryover)}</strong></span>
      </div>
    </div>

    <!-- Part III: Summary -->
    <div class="part-header summary">Part III — Summary</div>
    <div class="section-box">
      <div class="line-item">
        <span class="line-number">16</span>
        <span class="label">Combine lines 7 and 15 and enter the result</span>
        <span class="amount"><strong>$${formatMoney(totalNetGainLoss)}</strong></span>
      </div>
      <div class="instructions">
        • If line 16 is a <strong>gain</strong>, enter the amount on Form 1040, line 7, or Form 1040-SR, line 7.<br/>
        • If line 16 is a <strong>loss</strong>, skip lines 17–20 below. Complete the Capital Loss Carryover Worksheet.
      </div>
      <div class="line-item">
        <span class="line-number">17</span>
        <span class="label">Are lines 15 and 16 both gains?</span>
        <span class="amount">${netLongTerm > 0 && totalNetGainLoss > 0 ? 'Yes ☑' : 'No ☐'}</span>
      </div>
      <div class="line-item">
        <span class="line-number">21</span>
        <span class="label">If line 16 is a loss, enter here and on Form 1040 the <strong>smaller</strong> of: (a) the loss on line 16, or (b) ($3,000)</span>
        <span class="amount">${totalNetGainLoss < 0 ? '$' + formatMoney(deductibleLoss) : '—'}</span>
      </div>
    </div>

    ${newCarryover < 0 ? `
    <div class="carryover-box">
      <h4>⚠️ Capital Loss Carryover to ${parseInt(taxYear) + 1}</h4>
      <p>Your net capital loss exceeds the $3,000 annual deduction limit.</p>
      <p><strong>Amount to carry forward: $${formatMoney(newCarryover)}</strong></p>
      <p style="font-size: 9px; margin-top: 8px;">Complete the Capital Loss Carryover Worksheet in the Schedule D instructions to determine how much is short-term vs. long-term carryover.</p>
    </div>
    ` : ''}

    ${washSales.length > 0 ? `
    <div class="wash-sale-summary">
      <h4 style="color: #b45309;">⚠️ Wash Sale Adjustments Applied</h4>
      <p>${washSales.length} transaction(s) with wash sale adjustments (Code W on Form 8949).</p>
      <p>Total wash sale disallowed: <strong>$${formatMoney(shortTermWashAdjustment + longTermWashAdjustment)}</strong></p>
    </div>
    ` : ''}

    <!-- Form 8949 Summary -->
    <div class="section-box" style="margin-top: 20px;">
      <div class="line-item" style="background: #f3f4f6;">
        <span class="label"><strong>Form 8949 Aggregation</strong></span>
        <span class="amount"><strong>Proceeds / Cost Basis / Gain(Loss)</strong></span>
      </div>
      <div class="line-item">
        <span class="label">Short-Term (Part I) — ${shortTermSells.length} transaction(s)</span>
        <span class="amount">$${formatMoney(shortTermProceeds)} / $${formatMoney(shortTermCostBasis)} / $${formatMoney(shortTermGainLoss)}</span>
      </div>
      <div class="line-item">
        <span class="label">Long-Term (Part II) — ${longTermSells.length} transaction(s)</span>
        <span class="amount">$${formatMoney(longTermProceeds)} / $${formatMoney(longTermCostBasis)} / $${formatMoney(longTermGainLoss)}</span>
      </div>
      <div class="line-item total">
        <span class="label">Total</span>
        <span class="amount">$${formatMoney(shortTermProceeds + longTermProceeds)} / $${formatMoney(shortTermCostBasis + longTermCostBasis)} / $${formatMoney(shortTermGainLoss + longTermGainLoss)}</span>
      </div>
    </div>

    <div class="footer">
      <p>This summary is for informational purposes only. Consult a tax professional for official filings.</p>
      <p>Generated by DividendTracker Pro | ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Schedule D Summary
        </CardTitle>
        <CardDescription>
          Aggregated capital gains and losses with carryover calculations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prior Year Carryover Input */}
        <div className="p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-primary" />
            <Label className="font-semibold">Prior Year Capital Loss Carryover</Label>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              placeholder="0"
              value={priorYearCarryover}
              onChange={(e) => setPriorYearCarryover(e.target.value)}
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">
              Enter negative for losses (e.g., -5000)
            </span>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Short-Term Summary */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-amber-500">Part I</Badge>
              <span className="font-semibold">Short-Term</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transactions</span>
                <span>{shortTermSells.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Proceeds</span>
                <span>${shortTermProceeds.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cost Basis</span>
                <span>${shortTermCostBasis.toLocaleString()}</span>
              </div>
              {shortTermWashAdjustment > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Wash Sale Adj.</span>
                  <span>+${shortTermWashAdjustment.toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Net Gain/Loss (Line 7)</span>
                <span className={netShortTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  ${formatMoney(shortTermAfterCarryover)}
                </span>
              </div>
            </div>
          </div>

          {/* Long-Term Summary */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-blue-500">Part II</Badge>
              <span className="font-semibold">Long-Term</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transactions</span>
                <span>{longTermSells.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Proceeds</span>
                <span>${longTermProceeds.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cost Basis</span>
                <span>${longTermCostBasis.toLocaleString()}</span>
              </div>
              {longTermWashAdjustment > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Wash Sale Adj.</span>
                  <span>+${longTermWashAdjustment.toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Net Gain/Loss (Line 15)</span>
                <span className={netLongTerm >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  ${formatMoney(longTermAfterCarryover)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Part III Summary */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-emerald-500">Part III</Badge>
            <span className="font-semibold">Summary (Line 16)</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Line 7 (Short-Term)</span>
                <ArrowRight className="w-4 h-4" />
                <span className="text-sm text-muted-foreground">Line 15 (Long-Term)</span>
                <ArrowRight className="w-4 h-4" />
                <span className="font-semibold">Line 16</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={shortTermAfterCarryover >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  ${formatMoney(shortTermAfterCarryover)}
                </span>
                <span>+</span>
                <span className={longTermAfterCarryover >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                  ${formatMoney(longTermAfterCarryover)}
                </span>
                <span>=</span>
                <span className={`text-xl font-bold ${totalNetGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${formatMoney(totalNetGainLoss)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loss Limitation & Carryover */}
        {totalNetGainLoss < 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-red-600 dark:text-red-400">Capital Loss Limitation</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Net Loss</span>
                <span className="text-red-500">${formatMoney(totalNetGainLoss)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Deduction Limit</span>
                <span>($3,000)</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Deductible This Year (Line 21)</span>
                <span className="text-red-500">${formatMoney(deductibleLoss)}</span>
              </div>
              {newCarryover < 0 && (
                <div className="flex justify-between font-bold text-amber-600">
                  <span>Carryover to {parseInt(taxYear) + 1}</span>
                  <span>${formatMoney(newCarryover)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Schedule D Notes</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Short-term gains are taxed at ordinary income rates (up to 37%)</li>
              <li>• Long-term gains qualify for preferential rates (0%, 15%, or 20%)</li>
              <li>• Capital losses exceeding $3,000 carry forward to future years indefinitely</li>
              <li>• Carryover losses offset gains of the same type first, then opposite type</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={generateScheduleDHTML} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Generate Schedule D PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
