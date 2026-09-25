import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { usePortfolio } from '@/context/PortfolioContext';
import { toast } from 'sonner';

const convertToCSV = (data: any[], headers: string[]): string => {
  if (data.length === 0) return '';
  
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle values that might contain commas or quotes
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

const downloadCSV = (csvContent: string, filename: string) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const CSVExport = () => {
  const { activePortfolio } = usePortfolio();

  const handleExportHoldings = () => {
    if (!activePortfolio?.holdings || activePortfolio.holdings.length === 0) {
      toast.error('No holdings to export');
      return;
    }

    const holdingsData = activePortfolio.holdings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      shares: h.shares,
      avgPrice: h.avgPrice,
      currentPrice: h.currentPrice,
      totalValue: (h.shares * h.currentPrice).toFixed(2),
      gainLoss: ((h.currentPrice - h.avgPrice) * h.shares).toFixed(2),
      gainLossPercent: (((h.currentPrice - h.avgPrice) / h.avgPrice) * 100).toFixed(2),
      assetType: h.assetType,
      sector: h.sector || '',
      country: h.country || '',
      dividendYield: h.dividendYield || ''
    }));

    const headers = ['symbol', 'name', 'shares', 'avgPrice', 'currentPrice', 'totalValue', 'gainLoss', 'gainLossPercent', 'assetType', 'sector', 'country', 'dividendYield'];
    const csvContent = convertToCSV(holdingsData, headers);
    const filename = `${activePortfolio.name.replace(/\s+/g, '_')}_holdings_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    toast.success(`Exported ${holdingsData.length} holdings to CSV`);
  };

  const handleExportTransactions = () => {
    if (!activePortfolio?.transactions || activePortfolio.transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const transactionsData = activePortfolio.transactions.map(t => ({
      date: t.date,
      type: t.type,
      symbol: t.symbol,
      shares: t.shares,
      price: t.price,
      totalValue: t.totalValue
    }));

    const headers = ['date', 'type', 'symbol', 'shares', 'price', 'totalValue'];
    const csvContent = convertToCSV(transactionsData, headers);
    const filename = `${activePortfolio.name.replace(/\s+/g, '_')}_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    toast.success(`Exported ${transactionsData.length} transactions to CSV`);
  };

  const handleExportAll = () => {
    handleExportHoldings();
    setTimeout(() => handleExportTransactions(), 500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export Portfolio Data
        </CardTitle>
        <CardDescription>
          Download your portfolio holdings and transaction history as CSV files
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportHoldings}>
            <Download className="w-4 h-4 mr-2" />
            Export Holdings
          </Button>
          <Button variant="outline" onClick={handleExportTransactions}>
            <Download className="w-4 h-4 mr-2" />
            Export Transactions
          </Button>
          <Button onClick={handleExportAll}>
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
        </p>
      </CardContent>
    </Card>
  );
};
