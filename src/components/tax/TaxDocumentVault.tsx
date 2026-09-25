import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileSearch
} from 'lucide-react';
import { format } from 'date-fns';
import { useTaxDocuments, TaxDocument } from '@/hooks/useTaxDocuments';

const DOCUMENT_TYPES = [
  { value: '1099-B', label: '1099-B (Broker Transactions)' },
  { value: '1099-DIV', label: '1099-DIV (Dividends)' },
  { value: '1099-INT', label: '1099-INT (Interest)' },
  { value: 'K-1', label: 'Schedule K-1 (Partnership)' },
  { value: 'Other', label: 'Other Tax Document' }
];

interface TaxDocumentVaultProps {
  taxYear?: number;
}

export const TaxDocumentVault: React.FC<TaxDocumentVaultProps> = ({
  taxYear = new Date().getFullYear()
}) => {
  const { 
    documents, 
    loading, 
    uploadDocument, 
    deleteDocument, 
    updateNotes,
    getDocumentUrl,
    getSummary,
    refetch 
  } = useTaxDocuments(taxYear);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<TaxDocument['document_type']>('1099-B');
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<TaxDocument | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summary = getSummary();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await uploadDocument(selectedFile, documentType, taxYear);
      setUploadDialogOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (doc: TaxDocument) => {
    const url = await getDocumentUrl(doc.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const getStatusIcon = (status: TaxDocument['extraction_status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: TaxDocument['extraction_status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      processing: 'secondary',
      failed: 'destructive',
      pending: 'outline'
    };

    return (
      <Badge variant={variants[status] || 'outline'} className="gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Proceeds</p>
                <p className="text-2xl font-bold">${summary.totalProceeds.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cost Basis</p>
                <p className="text-2xl font-bold">${summary.totalCostBasis.toLocaleString()}</p>
              </div>
              <FileText className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${summary.totalGainLoss >= 0 ? 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20' : 'from-red-500/10 to-red-600/5 border-red-500/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Gain/Loss</p>
                <p className={`text-2xl font-bold ${summary.totalGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summary.totalGainLoss >= 0 ? '+' : ''}${summary.totalGainLoss.toLocaleString()}
                </p>
              </div>
              {summary.totalGainLoss >= 0 ? (
                <TrendingUp className="w-8 h-8 text-emerald-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{summary.processedCount}/{summary.documentCount}</p>
                <p className="text-xs text-muted-foreground">Processed</p>
              </div>
              <FileSearch className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gain/Loss Breakdown */}
      {summary.processedCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-muted-foreground mb-1">Short-Term Gains/Losses</p>
                <p className={`text-xl font-bold ${summary.shortTermGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summary.shortTermGainLoss >= 0 ? '+' : ''}${summary.shortTermGainLoss.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Taxed at ordinary income rates</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-muted-foreground mb-1">Long-Term Gains/Losses</p>
                <p className={`text-xl font-bold ${summary.longTermGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {summary.longTermGainLoss >= 0 ? '+' : ''}${summary.longTermGainLoss.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Preferential capital gains rates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Tax Document Vault - {taxYear}
              </CardTitle>
              <CardDescription>
                Upload 1099-B and other tax forms for automatic data extraction
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Tax Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <Select value={documentType} onValueChange={(v) => setDocumentType(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>File (PDF, Image, or Scanned Document)</Label>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileSelect}
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                    </div>
                    <Alert>
                      <FileSearch className="w-4 h-4" />
                      <AlertDescription>
                        Documents will be automatically processed to extract transaction data for reconciliation.
                      </AlertDescription>
                    </Alert>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        'Upload & Extract'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No documents uploaded yet</p>
              <p className="text-sm">Upload your 1099-B and other tax forms to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proceeds</TableHead>
                  <TableHead>Gain/Loss</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.file_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.document_type}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(doc.extraction_status)}</TableCell>
                    <TableCell>
                      {doc.total_proceeds 
                        ? `$${Number(doc.total_proceeds).toLocaleString()}` 
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {doc.total_gain_loss !== null ? (
                        <span className={Number(doc.total_gain_loss) >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                          {Number(doc.total_gain_loss) >= 0 ? '+' : ''}
                          ${Number(doc.total_gain_loss).toLocaleString()}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDocument(doc)}
                          title="View Document"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSelectedDoc(doc); setDetailsOpen(true); }}
                          title="View Details"
                        >
                          <FileSearch className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDocument(doc.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Document Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">File Name</p>
                  <p className="font-medium">{selectedDoc.file_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Document Type</p>
                  <p className="font-medium">{selectedDoc.document_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tax Year</p>
                  <p className="font-medium">{selectedDoc.tax_year}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedDoc.extraction_status)}
                </div>
              </div>

              {selectedDoc.extraction_status === 'completed' && selectedDoc.extracted_data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground">Total Proceeds</p>
                      <p className="font-bold">${Number(selectedDoc.total_proceeds || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground">Cost Basis</p>
                      <p className="font-bold">${Number(selectedDoc.total_cost_basis || 0).toLocaleString()}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground">Net Gain/Loss</p>
                      <p className={`font-bold ${Number(selectedDoc.total_gain_loss || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {Number(selectedDoc.total_gain_loss || 0) >= 0 ? '+' : ''}
                        ${Number(selectedDoc.total_gain_loss || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {(selectedDoc.extracted_data as any)?.transactions && (
                    <div>
                      <p className="font-medium mb-2">Extracted Transactions</p>
                      <div className="max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Proceeds</TableHead>
                              <TableHead>Cost</TableHead>
                              <TableHead>Gain/Loss</TableHead>
                              <TableHead>Term</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {((selectedDoc.extracted_data as any).transactions || []).map((tx: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-sm">{tx.description}</TableCell>
                                <TableCell>${tx.proceeds?.toLocaleString()}</TableCell>
                                <TableCell>${tx.costBasis?.toLocaleString()}</TableCell>
                                <TableCell className={tx.gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                  {tx.gainLoss >= 0 ? '+' : ''}${tx.gainLoss?.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={tx.isShortTerm ? 'secondary' : 'default'}>
                                    {tx.isShortTerm ? 'Short' : 'Long'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedDoc.extraction_status === 'failed' && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Failed to extract data from this document. Please ensure it's a valid tax form.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
