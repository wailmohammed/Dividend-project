import { useMemo } from 'react';
import { differenceInDays, addDays, subDays } from 'date-fns';
import { TaxLot } from '@/hooks/useTaxLots';

export interface WashSaleAdjustment {
  originalLot: TaxLot;
  replacementLot: TaxLot;
  disallowedLoss: number;
  adjustedCostBasis: number;
  adjustedPurchaseDate: string;
}

export interface WashSaleEnforcementResult {
  washSaleAdjustments: WashSaleAdjustment[];
  totalDisallowedLoss: number;
  affectedLots: Set<string>;
  getAdjustedCostBasis: (lotId: string) => number | null;
  getAdjustedPurchaseDate: (lotId: string) => string | null;
  isWashSaleLot: (lotId: string) => boolean;
}

/**
 * Enhanced wash sale detection with cost basis adjustment enforcement.
 * When a wash sale is detected:
 * 1. The loss is disallowed for tax purposes
 * 2. The disallowed loss is added to the cost basis of the replacement shares
 * 3. The holding period of the replacement shares is adjusted to include the original holding period
 */
export const useWashSaleEnforcement = (taxLots: TaxLot[]): WashSaleEnforcementResult => {
  return useMemo(() => {
    const washSaleAdjustments: WashSaleAdjustment[] = [];
    const affectedLots = new Set<string>();
    
    // Get all closed lots that resulted in a loss
    const closedLotsWithLoss = taxLots.filter(
      lot => lot.is_closed && lot.realized_gain_loss !== null && lot.realized_gain_loss < 0
    ).sort((a, b) => new Date(a.sale_date || 0).getTime() - new Date(b.sale_date || 0).getTime());

    // Get all open and replacement lots
    const potentialReplacements = taxLots.filter(lot => {
      // Include both open lots and closed lots that were purchased after the loss
      return true;
    }).sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime());

    closedLotsWithLoss.forEach(lossLot => {
      if (!lossLot.sale_date) return;
      
      const saleDate = new Date(lossLot.sale_date);
      const windowStart = subDays(saleDate, 30);
      const windowEnd = addDays(saleDate, 30);

      // Find replacement purchases within the 61-day window (30 before + sale day + 30 after)
      const replacementLots = potentialReplacements.filter(repLot => {
        // Must be same symbol
        if (repLot.symbol !== lossLot.symbol) return false;
        
        // Must be a different lot
        if (repLot.id === lossLot.id) return false;
        
        // Purchase must be within the wash sale window
        const purchaseDate = new Date(repLot.purchase_date);
        return purchaseDate >= windowStart && purchaseDate <= windowEnd;
      });

      if (replacementLots.length > 0) {
        // Apply wash sale to the earliest replacement lot
        const replacementLot = replacementLots[0];
        const disallowedLoss = Math.abs(lossLot.realized_gain_loss || 0);
        
        // Calculate shares ratio for partial wash sales
        const sharesRatio = Math.min(lossLot.shares, replacementLot.shares) / lossLot.shares;
        const adjustedDisallowedLoss = disallowedLoss * sharesRatio;
        
        // Adjusted cost basis = original cost basis + (disallowed loss / shares)
        const adjustedCostBasis = replacementLot.cost_basis + (adjustedDisallowedLoss / replacementLot.shares);
        
        // The holding period of the replacement shares includes the holding period of the original shares
        const originalPurchaseDate = new Date(lossLot.purchase_date);
        
        washSaleAdjustments.push({
          originalLot: lossLot,
          replacementLot,
          disallowedLoss: adjustedDisallowedLoss,
          adjustedCostBasis,
          adjustedPurchaseDate: originalPurchaseDate.toISOString()
        });

        affectedLots.add(lossLot.id);
        affectedLots.add(replacementLot.id);
      }
    });

    const totalDisallowedLoss = washSaleAdjustments.reduce(
      (sum, adj) => sum + adj.disallowedLoss, 
      0
    );

    // Helper functions
    const getAdjustedCostBasis = (lotId: string): number | null => {
      const adjustment = washSaleAdjustments.find(adj => adj.replacementLot.id === lotId);
      return adjustment ? adjustment.adjustedCostBasis : null;
    };

    const getAdjustedPurchaseDate = (lotId: string): string | null => {
      const adjustment = washSaleAdjustments.find(adj => adj.replacementLot.id === lotId);
      return adjustment ? adjustment.adjustedPurchaseDate : null;
    };

    const isWashSaleLot = (lotId: string): boolean => {
      return affectedLots.has(lotId);
    };

    return {
      washSaleAdjustments,
      totalDisallowedLoss,
      affectedLots,
      getAdjustedCostBasis,
      getAdjustedPurchaseDate,
      isWashSaleLot
    };
  }, [taxLots]);
};
