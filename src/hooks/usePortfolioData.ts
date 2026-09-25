import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface DbPortfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cash_balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface DbHolding {
  id: string;
  portfolio_id: string;
  symbol: string;
  name: string;
  shares: number;
  avg_price: number;
  current_price: number | null;
  asset_type: 'Stock' | 'ETF' | 'Crypto' | 'Cash';
  sector: string | null;
  country: string;
  dividend_yield: number;
  expense_ratio: number | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTransaction {
  id: string;
  portfolio_id: string;
  holding_id: string | null;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL';
  symbol: string;
  shares: number | null;
  price: number;
  total_value: number;
  fees: number;
  notes: string | null;
  transaction_date: string;
  created_at: string;
}

export const usePortfolioData = () => {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<DbPortfolio[]>([]);
  const [holdings, setHoldings] = useState<DbHolding[]>([]);
  const [transactions, setTransactions] = useState<DbTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolios = useCallback(async () => {
    if (!user?.id || user.id === 'demo-user') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPortfolios(data || []);
    } catch (err: any) {
      console.error('Failed to fetch portfolios:', err);
      setError(err.message);
    }
  }, [user?.id]);

  const fetchHoldings = useCallback(async (portfolioId?: string) => {
    if (!user?.id || user.id === 'demo-user') return;

    try {
      let query = supabase.from('holdings').select('*');
      if (portfolioId) {
        query = query.eq('portfolio_id', portfolioId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      setHoldings((data || []) as unknown as DbHolding[]);
    } catch (err: any) {
      console.error('Failed to fetch holdings:', err);
    }
  }, [user?.id]);

  const fetchTransactions = useCallback(async (portfolioId?: string) => {
    if (!user?.id || user.id === 'demo-user') return;

    try {
      let query = supabase.from('transactions').select('*');
      if (portfolioId) {
        query = query.eq('portfolio_id', portfolioId);
      }

      const { data, error } = await query.order('transaction_date', { ascending: false });
      if (error) throw error;
      setTransactions((data || []) as unknown as DbTransaction[]);
    } catch (err: any) {
      console.error('Failed to fetch transactions:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPortfolios();
      await fetchHoldings();
      await fetchTransactions();
      setLoading(false);
    };
    loadData();
  }, [fetchPortfolios, fetchHoldings, fetchTransactions]);

  // Create portfolio
  const createPortfolio = async (name: string, description?: string) => {
    if (!user?.id || user.id === 'demo-user') return null;

    const { data, error } = await supabase
      .from('portfolios')
      .insert({ user_id: user.id, name, description })
      .select()
      .single();

    if (error) throw error;
    await fetchPortfolios();
    return data;
  };

  // Add holding
  const addHolding = async (portfolioId: string, holding: Omit<DbHolding, 'id' | 'portfolio_id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('holdings')
      .insert({ portfolio_id: portfolioId, ...holding })
      .select()
      .single();

    if (error) throw error;
    await fetchHoldings(portfolioId);
    return data;
  };

  // Add transaction
  const addTransaction = async (transaction: Omit<DbTransaction, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;
    await fetchTransactions(transaction.portfolio_id);
    return data;
  };

  // Update holding
  const updateHolding = async (holdingId: string, updates: Partial<DbHolding>) => {
    const { error } = await supabase
      .from('holdings')
      .update(updates)
      .eq('id', holdingId);

    if (error) throw error;
    await fetchHoldings();
  };

  // Delete holding
  const deleteHolding = async (holdingId: string) => {
    const { error } = await supabase
      .from('holdings')
      .delete()
      .eq('id', holdingId);

    if (error) throw error;
    await fetchHoldings();
  };

  // Delete portfolio
  const deletePortfolio = async (portfolioId: string) => {
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId);

    if (error) throw error;
    await fetchPortfolios();
  };

  return {
    portfolios,
    holdings,
    transactions,
    loading,
    error,
    createPortfolio,
    addHolding,
    addTransaction,
    updateHolding,
    deleteHolding,
    deletePortfolio,
    refetch: () => {
      fetchPortfolios();
      fetchHoldings();
      fetchTransactions();
    }
  };
};
