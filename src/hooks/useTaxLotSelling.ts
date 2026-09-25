import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { TaxLot } from '@/hooks/useTaxLots';

export type LotSelectionMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'LOFO' | 'AVGCOST' | 'SPECIFIC';

interface SelectedLot {
  lotId: string;
  shares: number;
}

export const useTaxLotSelling = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Closes multiple tax lots based on a sale transaction
   * Supports partial lot closures
   */
  const sellWithLotSelection = useCallback(async (
    selectedLots: SelectedLot[],
    salePrice: number,
    saleDate: string,
    method: LotSelectionMethod
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const results: { lotId: string; realizedGainLoss: number; isLongTerm: boolean }[] = [];

      for (const { lotId, shares: sharesToSell } of selectedLots) {
        // Get the current lot
        const { data: lot, error: fetchError } = await supabase
          .from('tax_lots')
          .select('*')
          .eq('id', lotId)
          .single();

        if (fetchError || !lot) {
          console.error('Failed to fetch lot:', fetchError);
          continue;
        }

        const lotShares = Number(lot.shares);
        const costBasis = Number(lot.cost_basis);
        
        // Calculate holding period
        const purchaseDate = new Date(lot.purchase_date);
        const saleDateObj = new Date(saleDate);
        const holdingDays = Math.floor((saleDateObj.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        const isLongTerm = holdingDays >= 365;

        // Calculate realized gain/loss
        const realizedGainLoss = (salePrice - costBasis) * sharesToSell;

        if (sharesToSell >= lotShares) {
          // Close entire lot
          const { error: updateError } = await supabase
            .from('tax_lots')
            .update({
              sale_date: saleDate,
              sale_price: salePrice,
              realized_gain_loss: realizedGainLoss,
              is_closed: true,
              shares: 0
            })
            .eq('id', lotId);

          if (updateError) {
            console.error('Failed to close lot:', updateError);
            continue;
          }
        } else {
          // Partial lot closure - reduce shares in original lot and create closed lot record
          const remainingShares = lotShares - sharesToSell;

          // Update original lot with remaining shares
          const { error: updateError } = await supabase
            .from('tax_lots')
            .update({ shares: remainingShares })
            .eq('id', lotId);

          if (updateError) {
            console.error('Failed to update lot:', updateError);
            continue;
          }

          // Create a new closed lot record for the sold portion
          const { error: insertError } = await supabase
            .from('tax_lots')
            .insert({
              user_id: user.id,
              portfolio_id: lot.portfolio_id,
              holding_id: lot.holding_id,
              symbol: lot.symbol,
              shares: sharesToSell,
              cost_basis: costBasis,
              purchase_date: lot.purchase_date,
              sale_date: saleDate,
              sale_price: salePrice,
              realized_gain_loss: realizedGainLoss,
              is_closed: true,
              lot_type: 'sell'
            });

          if (insertError) {
            console.error('Failed to create closed lot record:', insertError);
          }
        }

        results.push({ lotId, realizedGainLoss, isLongTerm });
      }

      const totalGainLoss = results.reduce((sum, r) => sum + r.realizedGainLoss, 0);
      const shortTermGains = results.filter(r => !r.isLongTerm).reduce((sum, r) => sum + r.realizedGainLoss, 0);
      const longTermGains = results.filter(r => r.isLongTerm).reduce((sum, r) => sum + r.realizedGainLoss, 0);

      toast({
        title: `Sale completed using ${method}`,
        description: `Total: ${totalGainLoss >= 0 ? '+' : ''}$${totalGainLoss.toFixed(2)} (ST: $${shortTermGains.toFixed(2)}, LT: $${longTermGains.toFixed(2)})`
      });

      return { 
        success: true, 
        results,
        summary: { totalGainLoss, shortTermGains, longTermGains }
      };
    } catch (error) {
      console.error('Error selling with lot selection:', error);
      toast({
        title: 'Failed to process sale',
        variant: 'destructive'
      });
      return { success: false, error: 'Failed to process sale' };
    }
  }, [user, toast]);

  /**
   * Auto-select lots based on a method and return them for preview
   */
  const getLotsForMethod = useCallback((
    availableLots: TaxLot[],
    sharesToSell: number,
    method: LotSelectionMethod
  ): SelectedLot[] => {
    const openLots = availableLots.filter(l => !l.is_closed && l.shares > 0);
    let sortedLots = [...openLots];

    switch (method) {
      case 'FIFO':
      case 'AVGCOST': // Average Cost uses FIFO order
        sortedLots.sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime());
        break;
      case 'LIFO':
        sortedLots.sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
        break;
      case 'HIFO':
        sortedLots.sort((a, b) => b.cost_basis - a.cost_basis);
        break;
      case 'LOFO':
        sortedLots.sort((a, b) => a.cost_basis - b.cost_basis);
        break;
      case 'SPECIFIC':
        // Return empty - user must manually select
        return [];
    }

    let remainingShares = sharesToSell;
    const selected: SelectedLot[] = [];

    for (const lot of sortedLots) {
      if (remainingShares <= 0) break;
      
      const sharesToTake = Math.min(lot.shares, remainingShares);
      if (sharesToTake > 0) {
        selected.push({ lotId: lot.id, shares: sharesToTake });
        remainingShares -= sharesToTake;
      }
    }

    return selected;
  }, []);

  return {
    sellWithLotSelection,
    getLotsForMethod
  };
};
