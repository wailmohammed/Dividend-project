import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface YearlyData {
  year: number;
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalNet: number;
  transactionCount: number;
}

interface CarryoverLoss {
  year: number;
  shortTermCarryover: number;
  longTermCarryover: number;
  totalCarryover: number;
  usedAgainstIncome: number;
}

interface MultiYearTaxReportPDFProps {
  yearlyData: YearlyData[];
  carryoverData: CarryoverLoss[];
  summary: {
    totalGains: number;
    totalLosses: number;
    netTotal: number;
    totalTransactions: number;
    currentCarryover: number;
    bestYear: YearlyData | null;
    worstYear: YearlyData | null;
  };
  startYear: number;
  endYear: number;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export const MultiYearTaxReportPDF: React.FC<MultiYearTaxReportPDFProps> = ({
  yearlyData,
  carryoverData,
  summary,
  startYear,
  endYear,
  contentRef
}) => {
  const handleExportPDF = async () => {
    if (!contentRef.current) {
      toast({
        title: "Export Failed",
        description: "Could not find report content to export.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Generating PDF",
      description: "Please wait while we generate your report..."
    });

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Multi-Year Capital Gains Report', margin, yPosition);
      yPosition += 10;

      // Subtitle
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(`Tax Years ${startYear} - ${endYear}`, margin, yPosition);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, yPosition);
      yPosition += 15;

      // Summary Section
      pdf.setTextColor(0);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Executive Summary', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      const summaryItems = [
        ['Total Gains:', `$${summary.totalGains.toLocaleString()}`],
        ['Total Losses:', `($${summary.totalLosses.toLocaleString()})`],
        ['Net Result:', `${summary.netTotal >= 0 ? '' : '('}$${Math.abs(summary.netTotal).toLocaleString()}${summary.netTotal < 0 ? ')' : ''}`],
        ['Total Transactions:', summary.totalTransactions.toString()],
        ['Current Carryover:', summary.currentCarryover < 0 ? `$${Math.abs(summary.currentCarryover).toLocaleString()}` : '$0'],
        ['Best Year:', summary.bestYear ? `${summary.bestYear.year} (+$${summary.bestYear.totalNet.toLocaleString()})` : 'N/A'],
        ['Worst Year:', summary.worstYear ? `${summary.worstYear.year} ($${summary.worstYear.totalNet.toLocaleString()})` : 'N/A']
      ];

      summaryItems.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label, margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, margin + 40, yPosition);
        yPosition += 6;
      });

      yPosition += 10;

      // Yearly Breakdown Table
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Year-by-Year Breakdown', margin, yPosition);
      yPosition += 8;

      // Table headers
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      const headers = ['Year', 'ST Gains', 'ST Losses', 'LT Gains', 'LT Losses', 'Net Total', 'Trades'];
      const colWidths = [18, 28, 28, 28, 28, 28, 18];
      let xPos = margin;

      headers.forEach((header, i) => {
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[i];
      });
      yPosition += 2;

      // Table line
      pdf.setDrawColor(200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      yearlyData.forEach(row => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = margin;
        }

        xPos = margin;
        const rowData = [
          row.year.toString(),
          `+$${row.shortTermGains.toLocaleString()}`,
          `-$${row.shortTermLosses.toLocaleString()}`,
          `+$${row.longTermGains.toLocaleString()}`,
          `-$${row.longTermLosses.toLocaleString()}`,
          `${row.totalNet >= 0 ? '+' : ''}$${row.totalNet.toLocaleString()}`,
          row.transactionCount.toString()
        ];

        rowData.forEach((cell, i) => {
          pdf.text(cell, xPos, yPosition);
          xPos += colWidths[i];
        });
        yPosition += 5;
      });

      yPosition += 10;

      // Check if we need a new page for carryover section
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = margin;
      }

      // Carryover Tracking Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Capital Loss Carryover Tracking', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100);
      pdf.text('IRS allows up to $3,000 per year to offset ordinary income. Unused losses carry forward.', margin, yPosition);
      yPosition += 8;

      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);

      const carryHeaders = ['Year', 'ST Carryover', 'LT Carryover', 'Used vs Income', 'Remaining'];
      const carryColWidths = [18, 35, 35, 35, 35];
      xPos = margin;

      carryHeaders.forEach((header, i) => {
        pdf.text(header, xPos, yPosition);
        xPos += carryColWidths[i];
      });
      yPosition += 2;

      pdf.setDrawColor(200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;

      pdf.setFont('helvetica', 'normal');
      carryoverData.forEach(row => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }

        xPos = margin;
        const rowData = [
          row.year.toString(),
          row.shortTermCarryover < 0 ? `$${Math.abs(row.shortTermCarryover).toLocaleString()}` : '$0',
          row.longTermCarryover < 0 ? `$${Math.abs(row.longTermCarryover).toLocaleString()}` : '$0',
          row.usedAgainstIncome > 0 ? `$${row.usedAgainstIncome.toLocaleString()}` : '$0',
          row.totalCarryover < 0 ? `$${Math.abs(row.totalCarryover).toLocaleString()}` : '$0'
        ];

        rowData.forEach((cell, i) => {
          pdf.text(cell, xPos, yPosition);
          xPos += carryColWidths[i];
        });
        yPosition += 5;
      });

      // Final note if carryover exists
      if (summary.currentCarryover < 0) {
        yPosition += 10;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(180, 100, 0);
        pdf.text(`Note: You have $${Math.abs(summary.currentCarryover).toLocaleString()} in unused capital losses.`, margin, yPosition);
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100);
        pdf.text('This loss will carry forward to future tax years to offset capital gains or ordinary income.', margin, yPosition);
      }

      // Footer on each page
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
          `Page ${i} of ${totalPages} | This report is for informational purposes only. Consult a tax professional for advice.`,
          margin,
          pageHeight - 10
        );
      }

      // Save the PDF
      pdf.save(`multi-year-tax-report-${startYear}-${endYear}.pdf`);

      toast({
        title: "PDF Exported",
        description: `Multi-year tax report for ${startYear}-${endYear} has been downloaded.`
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Button onClick={handleExportPDF} variant="outline" className="gap-2">
      <FileDown className="w-4 h-4" />
      Export PDF
    </Button>
  );
};
