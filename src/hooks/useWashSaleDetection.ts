import { useMemo } from 'react';
import { differenceInDays, addDays, subDays } from 'date-fns';
import { SellWithPL } from '@/components/tax/SellTransactionsTable';
import { Transaction } from '@/types';
import { cleanSymbol } from '@/lib/utils';

interface WashSaleResult {
  sellsWithWashSales: SellWithPL[];
  washSaleCount: number;
  totalDisallowed: number;
}

/**
 * Detects wash sales according to IRS rules:
 * A wash sale occurs when you sell a security at a loss and buy 
 * a "substantially identical" security within 30 days before or after the sale.
 */
export const useWashSaleDetection = (
  sells: SellWithPL[],
  transactions: Transaction[]
): WashSaleResult => {
  
  return useMemo(() => {
    // Get all BUY transactions sorted by date
    const buys = transactions
      .filter(t => t.type === 'BUY')
      .map(t => ({
        symbol: cleanSymbol(t.symbol),
        date: new Date(t.date),
        shares: t.shares || 0,
        price: t.price
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let totalDisallowed = 0;

    const sellsWithWashSales = sells.map(sell => {
      // Only check sales that resulted in a loss
      if (sell.profitLoss >= 0) {
        return { ...sell, isWashSale: false };
      }

      const saleDate = new Date(sell.date);
      const windowStart = subDays(saleDate, 30);
      const windowEnd = addDays(saleDate, 30);

      // Check if there's a BUY of the same symbol within the 61-day window
      // (30 days before + sale date + 30 days after)
      const matchingBuys = buys.filter(buy => {
        if (buy.symbol !== sell.symbol) return false;
        
        // Check if buy is within the wash sale window
        // The buy must be DIFFERENT from the original purchase that created the lot we're selling
        const buyTime = buy.date.getTime();
        const isInWindow = buyTime >= windowStart.getTime() && buyTime <= windowEnd.getTime();
        
        // Exclude the original purchase date of the sold lot
        const isNotOriginalPurchase = buy.date.getTime() !== new Date(sell.purchaseDate).getTime();
        
        return isInWindow && isNotOriginalPurchase;
      });

      if (matchingBuys.length > 0) {
        // Calculate the disallowed amount
        // The full loss is disallowed and added to the cost basis of replacement shares
        const disallowed = Math.abs(sell.profitLoss);
        totalDisallowed += disallowed;

        return {
          ...sell,
          isWashSale: true,
          washSaleDisallowed: disallowed
        };
      }

      return { ...sell, isWashSale: false };
    });

    const washSaleCount = sellsWithWashSales.filter(s => s.isWashSale).length;

    return {
      sellsWithWashSales,
      washSaleCount,
      totalDisallowed
    };
  }, [sells, transactions]);
};
