import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DEMO_TAX_LOTS } from '@/constants/demoTaxLots';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

export interface TaxLot {
  id: string;
  user_id: string;
  portfolio_id: string;
  holding_id: string | null;
  symbol: string;
  shares: number;
  cost_basis: number;
  purchase_date: string;
  sale_date: string | null;
  sale_price: number | null;
  realized_gain_loss: number | null;
  is_closed: boolean;
  lot_type: string;
  created_at: string;
}

export interface TaxSummary {
  totalCostBasis: number;
  totalMarketValue: number;
  unrealizedGains: number;
  unrealizedLosses: number;
  realizedGains: number;
  realizedLosses: number;
  shortTermGains: number;
  longTermGains: number;
}

export const useTaxLots = (portfolioId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [taxLots, setTaxLots] = useState<TaxLot[]>([]);
  const [loading, setLoading] = useState(true);

  // Demo mode is active when: no user OR demo user OR user has explicitly enabled demo mode in settings
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();

  const fetchTaxLots = async () => {
    // In demo mode, return demo data immediately
    if (isDemoMode) {
      setTaxLots(DEMO_TAX_LOTS);
      setLoading(false);
      return;
    }
    
    try {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let query = supabase
        .from('tax_lots')
        .select('*')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (portfolioId) {
        if (!UUID_RE.test(portfolioId)) {
          setTaxLots([]);
          setLoading(false);
          return;
        }
        query = query.eq('portfolio_id', portfolioId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setTaxLots(data?.map(lot => ({
        ...lot,
        shares: Number(lot.shares),
        cost_basis: Number(lot.cost_basis),
        sale_price: lot.sale_price ? Number(lot.sale_price) : null,
        realized_gain_loss: lot.realized_gain_loss ? Number(lot.realized_gain_loss) : null
      })) || []);
    } catch (error) {
      console.error('Error fetching tax lots:', error);
    } finally {
      setLoading(false);
    }
  };
  const addTaxLot = async (lot: Omit<TaxLot, 'id' | 'user_id' | 'created_at' | 'is_closed' | 'sale_date' | 'sale_price' | 'realized_gain_loss'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tax_lots')
        .insert({
          ...lot,
          user_id: user.id,
          is_closed: false
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Tax lot added' });
      await fetchTaxLots();
      return data;
    } catch (error) {
      console.error('Error adding tax lot:', error);
      toast({ title: 'Failed to add tax lot', variant: 'destructive' });
    }
  };

  const addTaxLotsInBulk = async (lots: Array<Omit<TaxLot, 'id' | 'user_id' | 'created_at' | 'is_closed' | 'sale_date' | 'sale_price' | 'realized_gain_loss'>>) => {
    if (!user || lots.length === 0) return { success: 0, failed: 0 };

    try {
      const lotsToInsert = lots.map(lot => ({
        ...lot,
        user_id: user.id,
        is_closed: false
      }));

      const { data, error } = await supabase
        .from('tax_lots')
        .insert(lotsToInsert)
        .select();

      if (error) throw error;

      toast({ title: `${data.length} tax lot(s) imported successfully` });
      await fetchTaxLots();
      return { success: data.length, failed: lots.length - data.length };
    } catch (error) {
      console.error('Error bulk adding tax lots:', error);
      toast({ title: 'Failed to import tax lots', variant: 'destructive' });
      return { success: 0, failed: lots.length };
    }
  };

  const addClosedTaxLot = async (lot: {
    portfolio_id: string;
    holding_id: string | null;
    symbol: string;
    shares: number;
    cost_basis: number;
    purchase_date: string;
    sale_date: string;
    sale_price: number;
    realized_gain_loss: number;
    lot_type: string;
  }) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tax_lots')
        .insert({
          ...lot,
          user_id: user.id,
          is_closed: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Closed tax lot added' });
      await fetchTaxLots();
      return data;
    } catch (error) {
      console.error('Error adding closed tax lot:', error);
      toast({ title: 'Failed to add tax lot', variant: 'destructive' });
    }
  };

  const updateTaxLot = async (lotId: string, updates: Partial<Pick<TaxLot, 'symbol' | 'shares' | 'cost_basis' | 'purchase_date'>>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tax_lots')
        .update(updates)
        .eq('id', lotId);

      if (error) throw error;

      toast({ title: 'Tax lot updated' });
      await fetchTaxLots();
    } catch (error) {
      console.error('Error updating tax lot:', error);
      toast({ title: 'Failed to update tax lot', variant: 'destructive' });
    }
  };

  const closeTaxLot = async (lotId: string, salePrice: number, saleDate: string) => {
    if (!user) return;

    const lot = taxLots.find(l => l.id === lotId);
    if (!lot) return;

    const realizedGainLoss = (salePrice - lot.cost_basis) * lot.shares;

    try {
      const { error } = await supabase
        .from('tax_lots')
        .update({
          sale_date: saleDate,
          sale_price: salePrice,
          realized_gain_loss: realizedGainLoss,
          is_closed: true
        })
        .eq('id', lotId);

      if (error) throw error;

      toast({ title: 'Tax lot closed' });
      await fetchTaxLots();
    } catch (error) {
      console.error('Error closing tax lot:', error);
      toast({ title: 'Failed to close tax lot', variant: 'destructive' });
    }
  };

  const deleteTaxLot = async (lotId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('tax_lots')
        .delete()
        .eq('id', lotId);

      if (error) throw error;

      toast({ title: 'Tax lot deleted' });
      await fetchTaxLots();
    } catch (error) {
      console.error('Error deleting tax lot:', error);
      toast({ title: 'Failed to delete tax lot', variant: 'destructive' });
    }
  };

  const calculateTaxSummary = (currentPrices: Record<string, number>): TaxSummary => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let totalCostBasis = 0;
    let totalMarketValue = 0;
    let unrealizedGains = 0;
    let unrealizedLosses = 0;
    let realizedGains = 0;
    let realizedLosses = 0;
    let shortTermGains = 0;
    let longTermGains = 0;

    taxLots.forEach(lot => {
      const costBasisTotal = lot.cost_basis * lot.shares;
      
      if (lot.is_closed && lot.realized_gain_loss !== null) {
        // Closed position
        if (lot.realized_gain_loss >= 0) {
          realizedGains += lot.realized_gain_loss;
        } else {
          realizedLosses += Math.abs(lot.realized_gain_loss);
        }

        // Check if short-term or long-term
        const purchaseDate = new Date(lot.purchase_date);
        const saleDate = lot.sale_date ? new Date(lot.sale_date) : new Date();
        const holdingPeriod = (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        
        if (holdingPeriod >= 1) {
          longTermGains += lot.realized_gain_loss;
        } else {
          shortTermGains += lot.realized_gain_loss;
        }
      } else {
        // Open position
        totalCostBasis += costBasisTotal;
        const currentPrice = currentPrices[lot.symbol] || lot.cost_basis;
        const marketValue = currentPrice * lot.shares;
        totalMarketValue += marketValue;
        
        const gainLoss = marketValue - costBasisTotal;
        if (gainLoss >= 0) {
          unrealizedGains += gainLoss;
        } else {
          unrealizedLosses += Math.abs(gainLoss);
        }
      }
    });

    return {
      totalCostBasis,
      totalMarketValue,
      unrealizedGains,
      unrealizedLosses,
      realizedGains,
      realizedLosses,
      shortTermGains,
      longTermGains
    };
  };

  useEffect(() => {
    fetchTaxLots();
  }, [user, portfolioId]);

  return {
    taxLots,
    loading,
    addTaxLot,
    addTaxLotsInBulk,
    addClosedTaxLot,
    updateTaxLot,
    closeTaxLot,
    deleteTaxLot,
    calculateTaxSummary,
    refetch: fetchTaxLots
  };
};
