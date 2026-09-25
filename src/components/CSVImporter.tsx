import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, ShieldAlert, Wand2 } from 'lucide-react';

interface ParsedHolding {
  symbol: string;
  name: string;
  shares: number;
  avgPrice: number;
  assetType: 'Stock' | 'ETF' | 'Crypto';
  sector?: string;
}

interface SkippedRow {
  row: number;
  symbol: string;
  reasons: string[];
}

interface FixedRow {
  row: number;
  symbol: string;
  field: string;
  before: string;
  after: string;
}

interface ParseResult {
  holdings: ParsedHolding[];
  skipped: SkippedRow[];
  fixed: FixedRow[];
}

interface CSVImporterProps {
  onImport: (holdings: ParsedHolding[]) => void;
}


type BrokerFormat = 'trading212' | 'binance' | 'degiro' | 'etoro' | 'vanguard' | 'generic';

const BROKER_FORMATS: Record<BrokerFormat, {
  name: string;
  columns: { symbol: string; name: string; shares: string; price: string };
  skipRows?: number;
}> = {
  trading212: {
    name: 'Trading 212',
    columns: { symbol: 'Ticker', name: 'Name', shares: 'Shares', price: 'Average cost' },
    skipRows: 0
  },
  binance: {
    name: 'Binance',
    columns: { symbol: 'Coin', name: 'Coin', shares: 'Total', price: 'Avg Buy Price' },
    skipRows: 0
  },
  degiro: {
    name: 'Degiro',
    columns: { symbol: 'Symbol', name: 'Product', shares: 'Quantity', price: 'Average Price' },
    skipRows: 0
  },
  etoro: {
    name: 'eToro',
    columns: { symbol: 'Asset Name', name: 'Asset Name', shares: 'Units', price: 'Open Rate' },
    skipRows: 0
  },
  vanguard: {
    name: 'Vanguard',
    columns: { symbol: 'Symbol', name: 'Investment Name', shares: 'Shares', price: 'Share Price' },
    skipRows: 3
  },
  generic: {
    name: 'Generic CSV',
    columns: { symbol: 'symbol', name: 'name', shares: 'shares', price: 'price' },
    skipRows: 0
  }
};

export const CSVImporter = ({ onImport }: CSVImporterProps) => {
  const [selectedBroker, setSelectedBroker] = useState<BrokerFormat>('trading212');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedHolding[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [fixedRows, setFixedRows] = useState<FixedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseCSV = useCallback((content: string, format: BrokerFormat): ParseResult => {
    const lines = content.trim().split('\n');
    const config = BROKER_FORMATS[format];
    const skipRows = config.skipRows || 0;
    
    if (lines.length <= skipRows) {
      throw new Error('CSV file is empty or has insufficient data');
    }

    const headerLine = lines[skipRows];
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Find column indices
    const findColumn = (name: string): number => {
      const index = headers.findIndex(h => 
        h.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(h.toLowerCase())
      );
      return index;
    };

    const symbolIdx = findColumn(config.columns.symbol);
    const nameIdx = findColumn(config.columns.name);
    const sharesIdx = findColumn(config.columns.shares);
    const priceIdx = findColumn(config.columns.price);
    const sectorIdx = findColumn('sector');

    if (symbolIdx === -1 || sharesIdx === -1) {
      throw new Error(`Could not find required columns. Expected: ${config.columns.symbol}, ${config.columns.shares}`);
    }

    const holdings: ParsedHolding[] = [];
    const skipped: SkippedRow[] = [];
    const fixed: FixedRow[] = [];
    const seen = new Map<string, number>();

    for (let i = skipRows + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle CSV with quoted fields
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

      const rowNumber = i + 1;
      const rawSymbol = values[symbolIdx]?.replace(/"/g, '').trim() || '';
      const symbol = rawSymbol.toUpperCase();
      const rawName = values[nameIdx !== -1 ? nameIdx : symbolIdx]?.replace(/"/g, '').trim() || '';
      const sharesRaw = values[sharesIdx]?.replace(/[^0-9.-]/g, '') || '';
      const shares = parseFloat(sharesRaw);
      const priceRaw = priceIdx !== -1 ? (values[priceIdx]?.replace(/[^0-9.-]/g, '') || '') : '';
      const avgPrice = priceIdx !== -1 ? parseFloat(priceRaw) : 0;
      const sector = sectorIdx !== -1 ? values[sectorIdx]?.replace(/"/g, '').trim() : '';

      // ---- Validation: flag & skip bad rows ----
      const reasons: string[] = [];
      if (!symbol) reasons.push('Missing ticker symbol');
      if (!/^[A-Z0-9.\-:]{1,12}$/.test(symbol) && symbol) reasons.push(`Invalid ticker format "${rawSymbol}"`);
      if (!sharesRaw || Number.isNaN(shares)) reasons.push('Missing or unreadable share quantity');
      else if (shares === 0) reasons.push('0 shares (closed or empty position)');
      else if (shares < 0) reasons.push('Negative share quantity');
      if (priceIdx !== -1 && (Number.isNaN(avgPrice) || avgPrice < 0)) reasons.push('Invalid average price');
      if (symbol && seen.has(symbol)) reasons.push(`Duplicate of row ${seen.get(symbol)}`);

      if (reasons.length > 0) {
        skipped.push({ row: rowNumber, symbol: rawSymbol || '(blank)', reasons });
        continue;
      }

      seen.set(symbol, rowNumber);

      // ---- Auto-fixes: record before/after ----
      if (rawSymbol !== symbol) {
        fixed.push({ row: rowNumber, symbol, field: 'symbol', before: rawSymbol, after: symbol });
      }
      const name = rawName || symbol;
      if (!rawName) {
        fixed.push({ row: rowNumber, symbol, field: 'name', before: '(empty)', after: symbol });
      }

      // Detect asset type
      const isCrypto = format === 'binance' || 
        ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'DOT', 'MATIC', 'LINK'].includes(symbol);
      const isETF = ['VOO', 'VTI', 'SPY', 'QQQ', 'VEA', 'VWO', 'BND', 'AGG', 'SCHD', 'VIG'].includes(symbol);

      if (!sector) {
        fixed.push({ row: rowNumber, symbol, field: 'sector', before: '(missing)', after: 'Unclassified' });
      }

      holdings.push({
        symbol,
        name,
        shares,
        avgPrice: Number.isNaN(avgPrice) ? 0 : avgPrice,
        assetType: isCrypto ? 'Crypto' : isETF ? 'ETF' : 'Stock',
        sector: sector || 'Unclassified'
      });
    }

    return { holdings, skipped, fixed };
  }, []);

  const applyResult = (result: ParseResult) => {
    setParsedData(result.holdings);
    setSkippedRows(result.skipped);
    setFixedRows(result.fixed);
    setParseError(
      result.holdings.length === 0
        ? result.skipped.length > 0
          ? `All ${result.skipped.length} rows failed validation — see the cleanup report below`
          : 'No valid holdings found in the CSV file'
        : null
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);
    setIsProcessing(true);

    try {
      const content = await selectedFile.text();
      applyResult(parseCSV(content, selectedBroker));
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse CSV file');
      setParsedData([]);
      setSkippedRows([]);
      setFixedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBrokerChange = async (value: BrokerFormat) => {
    setSelectedBroker(value);
    
    if (file) {
      setIsProcessing(true);
      try {
        const content = await file.text();
        applyResult(parseCSV(content, value));
      } catch (err: any) {
        setParseError(err.message || 'Failed to parse CSV file');
        setParsedData([]);
        setSkippedRows([]);
        setFixedRows([]);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const downloadReport = () => {
    const rows = [
      ['type', 'row', 'symbol', 'field', 'before', 'after', 'reason'],
      ...skippedRows.map(s => ['skipped', String(s.row), s.symbol, '', '', '', s.reasons.join('; ')]),
      ...fixedRows.map(f => ['fixed', String(f.row), f.symbol, f.field, f.before, f.after, '']),
      ...parsedData.map(h => ['imported', '', h.symbol, 'shares', '', String(h.shares), ''])
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdings-cleanup-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (parsedData.length > 0) {
      onImport(parsedData);
      toast({
        title: 'Import Successful',
        description: `Imported ${parsedData.length} holdings${skippedRows.length ? `, skipped ${skippedRows.length} invalid row(s)` : ''} from ${BROKER_FORMATS[selectedBroker].name}`,
      });
      setFile(null);
      setParsedData([]);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setSkippedRows([]);
    setFixedRows([]);
    setParseError(null);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Import Portfolio from CSV
        </CardTitle>
        <CardDescription>
          Upload your broker export file to automatically import holdings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Broker Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Broker Format</label>
          <Select value={selectedBroker} onValueChange={(v) => handleBrokerChange(v as BrokerFormat)}>
            <SelectTrigger>
              <SelectValue placeholder="Select broker format" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BROKER_FORMATS).map(([key, { name }]) => (
                <SelectItem key={key} value={key}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Upload CSV File</label>
          {!file ? (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click to upload or drag and drop</span>
              <span className="text-xs text-muted-foreground mt-1">CSV files only</span>
              <Input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Parse Status */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Processing file...
          </div>
        )}

        {parseError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {parseError}
          </div>
        )}

        {/* Preview */}
        {parsedData.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                Found {parsedData.length} holdings
              </div>
              <Badge variant="secondary">{BROKER_FORMATS[selectedBroker].name}</Badge>
            </div>

            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-right p-2">Shares</th>
                    <th className="text-right p-2">Avg Price</th>
                    <th className="text-center p-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 10).map((holding, idx) => (
                    <tr key={idx} className="border-t border-border/50">
                      <td className="p-2 font-mono font-medium">{holding.symbol}</td>
                      <td className="p-2 text-muted-foreground truncate max-w-[150px]">{holding.name}</td>
                      <td className="p-2 text-right">{holding.shares.toFixed(2)}</td>
                      <td className="p-2 text-right">${holding.avgPrice.toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className="text-xs">{holding.assetType}</Badge>
                      </td>
                    </tr>
                  ))}
                  {parsedData.length > 10 && (
                    <tr className="border-t">
                      <td colSpan={5} className="p-2 text-center text-muted-foreground">
                        +{parsedData.length - 10} more holdings...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Button onClick={handleImport} className="w-full">
              Import {parsedData.length} Holdings
            </Button>
          </div>
        )}

        {/* Auto cleanup report */}
        {(skippedRows.length > 0 || fixedRows.length > 0) && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Cleanup report
              </div>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                Download CSV
              </Button>
            </div>

            {skippedRows.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-destructive">
                  {skippedRows.length} row(s) skipped
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {skippedRows.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Badge variant="outline" className="font-mono shrink-0">Row {s.row}</Badge>
                      <span className="font-mono font-medium shrink-0">{s.symbol}</span>
                      <span className="text-muted-foreground">{s.reasons.join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fixedRows.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium flex items-center gap-1">
                  <Wand2 className="w-3 h-3 text-primary" />
                  {fixedRows.length} field(s) auto-corrected
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {fixedRows.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono shrink-0">Row {f.row}</Badge>
                      <span className="font-mono font-medium shrink-0">{f.symbol}</span>
                      <span className="text-muted-foreground">
                        {f.field}: <span className="line-through">{f.before}</span> → {f.after}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
};