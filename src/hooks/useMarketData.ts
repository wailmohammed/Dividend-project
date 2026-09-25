import { useEffect, useState } from 'react';
import { fetchCryptoPrice, fetchStockPrice } from '@/services/marketData';
import { Holding, AssetType } from '@/types';

export const useMarketData = (holdings: Holding[], enabled: boolean = true) => {
  const [updatedHoldings, setUpdatedHoldings] = useState<Holding[]>(holdings);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPrices = async () => {
    if (!enabled || holdings.length === 0) return;

    setLoading(true);
    try {
      const updates = await Promise.all(
        holdings.map(async (holding) => {
          let price = holding.currentPrice;
          
          try {
            if (holding.assetType === AssetType.CRYPTO) {
              const fetchedPrice = await fetchCryptoPrice(holding.symbol);
              if (fetchedPrice) price = fetchedPrice;
            } else {
              // For stocks, you'd need an API key
              // const apiKey = import.meta.env.VITE_FINNHUB_API_KEY;
              // if (apiKey) {
              //   const fetchedPrice = await fetchStockPrice(holding.symbol, apiKey);
              //   if (fetchedPrice) price = fetchedPrice;
              // }
            }
          } catch (error) {
            console.warn(`Failed to fetch price for ${holding.symbol}:`, error);
          }

          return {
            ...holding,
            currentPrice: price,
          };
        })
      );

      setUpdatedHoldings(updates);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();

    // Update prices every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [holdings.length, enabled]);

  return {
    holdings: updatedHoldings,
    loading,
    lastUpdate,
    refetch: fetchPrices,
  };
};
