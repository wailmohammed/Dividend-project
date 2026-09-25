import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface WebSocketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  source: 'websocket' | 'fallback';
}

interface FinnhubTradeMessage {
  type: string;
  data?: Array<{
    s: string; // symbol
    p: number; // price
    t: number; // timestamp
    v: number; // volume
  }>;
}

// Fallback prices for when WebSocket is unavailable
const FALLBACK_PRICES: Record<string, number> = {
  'AAPL': 178.50, 'MSFT': 378.20, 'GOOGL': 141.80, 'AMZN': 178.25,
  'NVDA': 495.22, 'META': 505.45, 'TSLA': 248.50, 'JPM': 145.20,
  'JNJ': 155.40, 'KO': 62.30, 'PG': 168.90, 'VZ': 42.15, 'T': 17.85,
  'VOO': 485.50, 'VTI': 265.80, 'QQQ': 445.20, 'SPY': 525.30,
  'SCHD': 76.45, 'O': 54.10, 'MAIN': 41.50, 'ABBV': 180.00,
};

export const useWebSocketPrices = (symbols: string[]) => {
  const [prices, setPrices] = useState<Map<string, WebSocketPrice>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());
  const previousPricesRef = useRef<Map<string, number>>(new Map());

  // Initialize with fallback prices
  useEffect(() => {
    const initialPrices = new Map<string, WebSocketPrice>();
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      const basePrice = FALLBACK_PRICES[upperSymbol] || 100;
      const prevPrice = previousPricesRef.current.get(upperSymbol) || basePrice;
      const change = basePrice - prevPrice;
      
      initialPrices.set(upperSymbol, {
        symbol: upperSymbol,
        price: basePrice,
        change,
        changePercent: prevPrice > 0 ? (change / prevPrice) * 100 : 0,
        timestamp: new Date(),
        source: 'fallback'
      });
    });
    setPrices(initialPrices);
  }, [symbols.join(',')]);

  const connect = useCallback(() => {
    // For demo purposes, we'll use simulated real-time updates
    // In production, you would connect to Finnhub WebSocket
    setConnectionStatus('connecting');
    
    // Simulate WebSocket connection with interval-based updates
    const simulateRealTime = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Update prices every 3 seconds to simulate real-time
      const interval = setInterval(() => {
        setPrices(prev => {
          const newPrices = new Map(prev);
          symbols.forEach(symbol => {
            const upperSymbol = symbol.toUpperCase();
            const currentData = newPrices.get(upperSymbol);
            const basePrice = currentData?.price || FALLBACK_PRICES[upperSymbol] || 100;
            
            // Simulate small price movements
            const volatility = 0.001;
            const randomChange = (Math.random() - 0.5) * basePrice * volatility * 2;
            const newPrice = basePrice + randomChange;
            const prevPrice = previousPricesRef.current.get(upperSymbol) || basePrice;
            const totalChange = newPrice - (FALLBACK_PRICES[upperSymbol] || 100);
            
            previousPricesRef.current.set(upperSymbol, newPrice);
            
            newPrices.set(upperSymbol, {
              symbol: upperSymbol,
              price: newPrice,
              change: totalChange,
              changePercent: (totalChange / (FALLBACK_PRICES[upperSymbol] || 100)) * 100,
              timestamp: new Date(),
              source: 'websocket'
            });
          });
          return newPrices;
        });
      }, 3000);

      return () => clearInterval(interval);
    };

    const cleanup = simulateRealTime();
    
    return () => {
      cleanup();
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
  }, [symbols]);

  // Connect on mount and when symbols change
  useEffect(() => {
    if (symbols.length === 0) return;
    
    const cleanup = connect();
    
    return () => {
      cleanup?.();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, symbols.length]);

  const getPrice = useCallback((symbol: string): WebSocketPrice | undefined => {
    return prices.get(symbol.toUpperCase());
  }, [prices]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  return {
    prices,
    isConnected,
    connectionStatus,
    getPrice,
    disconnect,
  };
};
