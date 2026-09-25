import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { usePortfolioAlerts, PortfolioAlert } from '@/hooks/usePortfolioAlerts';
import { Upload, FileJson, AlertCircle, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface ImportedAlert {
  symbol: string;
  type?: string;
  alert_type?: string;
  threshold?: number;
  threshold_percent?: number;
  notes?: string;
}

interface PortfolioAlertsImportProps {
  onImportComplete?: () => void;
}

export const PortfolioAlertsImport: React.FC<PortfolioAlertsImportProps> = ({ onImportComplete }) => {
  const { createAlert } = usePortfolioAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [parsedAlerts, setParsedAlerts] = useState<ImportedAlert[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAlertType = (type: string): PortfolioAlert['alert_type'] | null => {
    const validTypes: PortfolioAlert['alert_type'][] = ['price_movement', 'dividend_cut', 'earnings_surprise', 'dividend_increase'];
    if (validTypes.includes(type as PortfolioAlert['alert_type'])) {
      return type as PortfolioAlert['alert_type'];
    }
    return null;
  };

  const parseJSON = (input: string) => {
    setParseError(null);
    setParsedAlerts([]);

    if (!input.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(input);
      const alerts = Array.isArray(parsed) ? parsed : [parsed];
      
      // Validate structure
      const validAlerts: ImportedAlert[] = [];
      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        if (!alert.symbol || typeof alert.symbol !== 'string') {
          setParseError(`Alert ${i + 1}: Missing or invalid symbol`);
          return;
        }
        
        const alertType = alert.type || alert.alert_type;
        if (alertType && !validateAlertType(alertType)) {
          setParseError(`Alert ${i + 1}: Invalid alert type "${alertType}". Valid types: price_movement, dividend_cut, dividend_increase, earnings_surprise`);
          return;
        }
        
        validAlerts.push({
          symbol: alert.symbol.toUpperCase(),
          type: alertType || 'price_movement',
          threshold: alert.threshold ?? alert.threshold_percent,
          notes: alert.notes,
        });
      }
      
      setParsedAlerts(validAlerts);
    } catch (err) {
      setParseError('Invalid JSON format. Please check your input.');
    }
  };

  const handleInputChange = (value: string) => {
    setJsonInput(value);
    parseJSON(value);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);
      parseJSON(content);
    };
    reader.onerror = () => {
      setParseError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedAlerts.length === 0) return;

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const alert of parsedAlerts) {
      try {
        const alertType = validateAlertType(alert.type || 'price_movement');
        if (!alertType) {
          failCount++;
          continue;
        }

        await createAlert(
          alert.symbol,
          alertType,
          alert.threshold,
          alert.notes
        );
        successCount++;
      } catch (err) {
        console.error('Failed to import alert:', err);
        failCount++;
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      toast.success(`Imported ${successCount} alert(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setIsOpen(false);
      setJsonInput('');
      setParsedAlerts([]);
      onImportComplete?.();
    } else {
      toast.error('Failed to import alerts');
    }
  };

  const clearAll = () => {
    setJsonInput('');
    setParsedAlerts([]);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            Import Alert Configuration
          </DialogTitle>
          <DialogDescription>
            Paste JSON configuration or upload a file to import alerts
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload JSON File</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or paste JSON</span>
            </div>
          </div>

          {/* JSON Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>JSON Configuration</Label>
              {jsonInput && (
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 px-2">
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <Textarea
              value={jsonInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={`[
  {
    "symbol": "AAPL",
    "type": "price_movement",
    "threshold": 5,
    "notes": "Monitor for earnings"
  }
]`}
              className="font-mono text-xs h-48"
            />
          </div>

          {/* Parse Error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedAlerts.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                {parsedAlerts.length} alert(s) ready to import
              </Label>
              <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-1">
                {parsedAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                    <span className="font-medium">{alert.symbol}</span>
                    <span className="text-muted-foreground">{alert.type}</span>
                    {alert.threshold && (
                      <span className="text-xs text-muted-foreground">±{alert.threshold}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Button */}
          <Button 
            onClick={handleImport} 
            className="w-full" 
            disabled={parsedAlerts.length === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import {parsedAlerts.length > 0 ? `${parsedAlerts.length} Alert(s)` : 'Alerts'}
              </>
            )}
          </Button>

          {/* Format Help */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Expected format:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code>symbol</code> (required): Stock ticker</li>
              <li><code>type</code>: price_movement, dividend_cut, dividend_increase, earnings_surprise</li>
              <li><code>threshold</code>: Percentage for price alerts</li>
              <li><code>notes</code>: Optional notes</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioAlertsImport;
