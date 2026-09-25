import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface QuarterlyTaxPayment {
  id: string;
  user_id: string;
  tax_year: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  estimated_amount: number;
  amount_paid: number;
  payment_date: string | null;
  confirmation_number: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useQuarterlyTaxPayments = (taxYear: number = new Date().getFullYear()) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<QuarterlyTaxPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quarterly_tax_payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('tax_year', taxYear)
        .order('quarter');

      if (error) throw error;
      setPayments((data || []) as QuarterlyTaxPayment[]);
    } catch (err) {
      console.error('Failed to fetch quarterly tax payments:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, taxYear]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const upsertPayment = async (
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
    data: {
      estimated_amount?: number;
      amount_paid?: number;
      payment_date?: string | null;
      confirmation_number?: string | null;
      payment_method?: string | null;
      notes?: string | null;
    }
  ) => {
    if (!user?.id) return;

    try {
      const existingPayment = payments.find(p => p.quarter === quarter);
      
      if (existingPayment) {
        const { error } = await supabase
          .from('quarterly_tax_payments')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPayment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('quarterly_tax_payments')
          .insert({
            user_id: user.id,
            tax_year: taxYear,
            quarter,
            ...data
          });

        if (error) throw error;
      }

      await fetchPayments();
      toast.success(`${quarter} payment updated`);
    } catch (err: any) {
      console.error('Failed to save payment:', err);
      toast.error(err.message || 'Failed to save payment');
      throw err;
    }
  };

  const recordPayment = async (
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
    amount: number,
    paymentDate: string,
    confirmationNumber?: string,
    paymentMethod?: string,
    notes?: string
  ) => {
    return upsertPayment(quarter, {
      amount_paid: amount,
      payment_date: paymentDate,
      confirmation_number: confirmationNumber || null,
      payment_method: paymentMethod || null,
      notes: notes || null
    });
  };

  const updateEstimatedAmount = async (quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', amount: number) => {
    return upsertPayment(quarter, { estimated_amount: amount });
  };

  const getPaymentForQuarter = (quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    return payments.find(p => p.quarter === quarter);
  };

  const getTotalEstimated = () => payments.reduce((sum, p) => sum + Number(p.estimated_amount), 0);
  const getTotalPaid = () => payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const getBalance = () => getTotalEstimated() - getTotalPaid();

  return {
    payments,
    loading,
    upsertPayment,
    recordPayment,
    updateEstimatedAmount,
    getPaymentForQuarter,
    getTotalEstimated,
    getTotalPaid,
    getBalance,
    refetch: fetchPayments
  };
};
