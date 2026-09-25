import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface TaxDocument {
  id: string;
  user_id: string;
  tax_year: number;
  document_type: '1099-B' | '1099-DIV' | '1099-INT' | 'K-1' | 'Other';
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_data: Record<string, any>;
  total_proceeds: number | null;
  total_cost_basis: number | null;
  total_gain_loss: number | null;
  short_term_gain_loss: number | null;
  long_term_gain_loss: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useTaxDocuments = (taxYear?: number) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('tax_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (taxYear) {
        query = query.eq('tax_year', taxYear);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments((data || []) as TaxDocument[]);
    } catch (err) {
      console.error('Failed to fetch tax documents:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, taxYear]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    documentType: TaxDocument['document_type'],
    year: number
  ): Promise<TaxDocument | null> => {
    if (!user?.id) return null;

    try {
      // Upload file to storage
      const filePath = `${user.id}/${year}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('tax-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error } = await supabase
        .from('tax_documents')
        .insert({
          user_id: user.id,
          tax_year: year,
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          extraction_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      await fetchDocuments();
      toast.success('Document uploaded successfully');

      // Trigger OCR extraction
      triggerExtraction(data.id);

      return data as TaxDocument;
    } catch (err: any) {
      console.error('Failed to upload document:', err);
      toast.error(err.message || 'Failed to upload document');
      return null;
    }
  };

  const triggerExtraction = async (documentId: string) => {
    try {
      const { error } = await supabase.functions.invoke('extract-tax-document', {
        body: { documentId }
      });

      if (error) {
        console.error('Extraction failed:', error);
      }

      // Refresh after a delay to get updated status
      setTimeout(fetchDocuments, 3000);
    } catch (err) {
      console.error('Failed to trigger extraction:', err);
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (!user?.id) return;

    try {
      const doc = documents.find(d => d.id === documentId);
      if (!doc) return;

      // Delete from storage
      await supabase.storage
        .from('tax-documents')
        .remove([doc.file_path]);

      // Delete record
      const { error } = await supabase
        .from('tax_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      await fetchDocuments();
      toast.success('Document deleted');
    } catch (err: any) {
      console.error('Failed to delete document:', err);
      toast.error(err.message || 'Failed to delete document');
    }
  };

  const updateNotes = async (documentId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('tax_documents')
        .update({ notes })
        .eq('id', documentId);

      if (error) throw error;
      await fetchDocuments();
    } catch (err: any) {
      console.error('Failed to update notes:', err);
      toast.error('Failed to update notes');
    }
  };

  const getDocumentUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('tax-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('Failed to get document URL:', err);
      return null;
    }
  };

  const getSummary = () => {
    const completed = documents.filter(d => d.extraction_status === 'completed');
    return {
      totalProceeds: completed.reduce((sum, d) => sum + (Number(d.total_proceeds) || 0), 0),
      totalCostBasis: completed.reduce((sum, d) => sum + (Number(d.total_cost_basis) || 0), 0),
      totalGainLoss: completed.reduce((sum, d) => sum + (Number(d.total_gain_loss) || 0), 0),
      shortTermGainLoss: completed.reduce((sum, d) => sum + (Number(d.short_term_gain_loss) || 0), 0),
      longTermGainLoss: completed.reduce((sum, d) => sum + (Number(d.long_term_gain_loss) || 0), 0),
      documentCount: documents.length,
      processedCount: completed.length
    };
  };

  return {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    updateNotes,
    getDocumentUrl,
    getSummary,
    refetch: fetchDocuments
  };
};
