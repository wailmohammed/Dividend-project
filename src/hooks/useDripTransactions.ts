import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

export interface DripTransaction {
  id: string;
  user_id: string;
  portfolio_id: string;
  holding_id: string | null;
  symbol: string;
  dividend_amount: number;
  shares_purchased: number;
  purchase_price: number;
  purchase_date: string;
  created_at: string;
}

export const useDripTransactions = (portfolioId?: string) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<DripTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
    if (!user?.id || isDemoMode) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let query = supabase
        .from('drip_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (portfolioId) {
        if (!UUID_RE.test(portfolioId)) {
          setTransactions([]);
          setLoading(false);
          return;
        }
        query = query.eq('portfolio_id', portfolioId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions((data as DripTransaction[]) || []);
    } catch (error: any) {
      console.error('Failed to fetch DRIP transactions:', error?.message || error?.code || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id, portfolioId]);

  const addTransaction = useCallback(async (
    portfolioId: string,
    symbol: string,
    dividendAmount: number,
    sharesPurchased: number,
    purchasePrice: number,
    purchaseDate?: Date,
    holdingId?: string
  ) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('drip_transactions')
        .insert({
          user_id: user.id,
          portfolio_id: portfolioId,
          holding_id: holdingId || null,
          symbol: symbol.toUpperCase(),
          dividend_amount: dividendAmount,
          shares_purchased: sharesPurchased,
          purchase_price: purchasePrice,
          purchase_date: (purchaseDate || new Date()).toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      
      setTransactions(prev => [data as DripTransaction, ...prev]);
      toast.success(`DRIP transaction recorded for ${symbol}`);
      return data;
    } catch (error) {
      console.error('Failed to add DRIP transaction:', error);
      toast.error('Failed to record DRIP transaction');
      return null;
    }
  }, [user?.id]);

  const deleteTransaction = useCallback(async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('drip_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
      
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      toast.success('Transaction deleted');
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast.error('Failed to delete transaction');
    }
  }, []);

  // Calculate compound growth statistics
  const stats = useCallback(() => {
    if (transactions.length === 0) {
      return {
        totalDividendsReinvested: 0,
        totalSharesPurchased: 0,
        averagePurchasePrice: 0,
        currentValue: 0,
        totalGain: 0,
      };
    }

    const totalDividendsReinvested = transactions.reduce((sum, t) => sum + Number(t.dividend_amount), 0);
    const totalSharesPurchased = transactions.reduce((sum, t) => sum + Number(t.shares_purchased), 0);
    const totalCost = transactions.reduce((sum, t) => sum + (Number(t.shares_purchased) * Number(t.purchase_price)), 0);
    const averagePurchasePrice = totalSharesPurchased > 0 ? totalCost / totalSharesPurchased : 0;

    return {
      totalDividendsReinvested,
      totalSharesPurchased,
      averagePurchasePrice,
      currentValue: 0, // Would need current prices to calculate
      totalGain: 0,
    };
  }, [transactions]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    addTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
    stats: stats(),
  };
};
