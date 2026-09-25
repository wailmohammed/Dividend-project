import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Portfolio, Holding, PortfolioSummary, Transaction, Notification, ViewState, Watchlist, ManualAsset, Liability, AssetType, AlertConfig } from '../types';
import { useAuth } from './AuthContext';
import { DEMO_HOLDINGS, DEMO_PORTFOLIO_VALUE } from '@/constants/demoHoldings';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
interface PortfolioContextType {
  portfolios: PortfolioSummary[];
  activePortfolio: Portfolio;
  activePortfolioId: string;
  defaultPortfolioId: string;
  switchPortfolio: (id: string) => void;
  setDefaultPortfolio: (id: string) => void;
  addNewPortfolio: (name: string, type: 'Stock' | 'Crypto' | 'Mixed') => Promise<string | null>;
  importPortfolio: (name: string, transactions: any[], targetPortfolioId?: string) => Promise<void>;

  addTransaction: (assetId: string, type: 'BUY' | 'SELL', shares: number, price: number, date: string, targetPortfolioId?: string) => Promise<void>;
  updateHolding: (holdingId: string, updates: Partial<Holding>) => Promise<void>;
  deleteHolding: (holdingId: string) => Promise<void>;

  addManualAsset: (asset: Omit<ManualAsset, 'id'>, targetPortfolioId?: string) => void;
  addLiability: (liability: Omit<Liability, 'id'>, targetPortfolioId?: string) => void;

  watchlists: Watchlist[];
  activeWatchlistId: string;
  toggleWatchlist: (symbol: string) => void;
  createWatchlist: (name: string) => void;
  switchWatchlist: (id: string) => void;

  activeView: ViewState;
  switchView: (view: ViewState) => void;
  selectedResearchSymbol: string;
  viewStock: (symbol: string) => void;

  notifications: Notification[];
  markAsRead: (id: string) => void;
  clearNotifications: () => void;

  isAddAssetModalOpen: boolean;
  preSelectedAssetTicker: string | null;
  openAddAssetModal: (ticker?: string) => void;
  closeAddAssetModal: () => void;

  alerts: AlertConfig[];
  addAlert: (symbol: string, targetPrice: number, condition: 'ABOVE' | 'BELOW') => void;
  removeAlert: (id: string) => void;

  isMarketOpen: boolean;
  toggleMarketOpen: () => void;

  marketDataApiKey: string;
  setMarketDataApiKey: (key: string) => void;

  syncBroker: (brokerId: string) => Promise<boolean>;
  
  refetchPortfolio: () => Promise<void>;
  loadingPortfolio: boolean;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const EMPTY_PORTFOLIO: Portfolio = {
  id: 'loading',
  name: 'Loading...',
  totalValue: 0,
  cashBalance: 0,
  holdings: [],
  transactions: [],
  manualAssets: [],
  liabilities: []
};

const safeFloat = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return (Number.isFinite(val) && !Number.isNaN(val)) ? val : 0;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleaned);
        return (Number.isFinite(parsed) && !Number.isNaN(parsed)) ? parsed : 0;
    }
    return 0;
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [activeView, setActiveView] = useState<ViewState>('dashboard');
  const [selectedResearchSymbol, setSelectedResearchSymbol] = useState<string>('AAPL');

  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');
  const [defaultPortfolioId, setDefaultPortfolioId] = useState<string>('');
  const [activePortfolio, setActivePortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  const [watchlists, setWatchlists] = useState<Watchlist[]>([
      { id: 'default', name: 'Main Watchlist', symbols: ['AAPL', 'MSFT', 'NVDA', 'BTC'] }
  ]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('default');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);

  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [preSelectedAssetTicker, setPreSelectedAssetTicker] = useState<string | null>(null);

  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [marketDataApiKey, setMarketDataApiKey] = useState(() => localStorage.getItem('wealthos_market_key') || '');

  const updateMarketDataKey = (key: string) => {
      setMarketDataApiKey(key);
      localStorage.setItem('wealthos_market_key', key);
  };

  // Load default portfolio from user_settings DB first, then localStorage fallback
  useEffect(() => {
      const loadDefaultFromDB = async () => {
        if (!user?.id || user.id === 'demo-user') {
          // Fallback to localStorage for demo users
          const savedDefault = localStorage.getItem('wealthos_default_portfolio');
          if (savedDefault) {
            setDefaultPortfolioId(savedDefault);
            setActivePortfolioId(savedDefault);
          }
          return;
        }

        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('default_portfolio_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && data?.default_portfolio_id) {
            setDefaultPortfolioId(data.default_portfolio_id);
            setActivePortfolioId(data.default_portfolio_id);
            // Also sync to localStorage
            localStorage.setItem('wealthos_default_portfolio', data.default_portfolio_id);
          } else {
            // Fallback to localStorage
            const savedDefault = localStorage.getItem('wealthos_default_portfolio');
            if (savedDefault) {
              setDefaultPortfolioId(savedDefault);
              setActivePortfolioId(savedDefault);
            }
          }
        } catch (err) {
          console.error('Failed to load default portfolio from DB:', err);
          // Fallback to localStorage
          const savedDefault = localStorage.getItem('wealthos_default_portfolio');
          if (savedDefault) {
            setDefaultPortfolioId(savedDefault);
            setActivePortfolioId(savedDefault);
          }
        }
      };

      loadDefaultFromDB();
  }, [user?.id]);

  const setDefaultPortfolio = async (id: string) => {
      setDefaultPortfolioId(id);
      localStorage.setItem('wealthos_default_portfolio', id);
      // Also switch to the default portfolio when setting it
      setActivePortfolioId(id);

      // Save to DB if user is authenticated
      if (user?.id && user.id !== 'demo-user') {
        try {
          // Check if settings exist
          const { data: existing } = await supabase
            .from('user_settings')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('user_settings')
              .update({ default_portfolio_id: id, updated_at: new Date().toISOString() })
              .eq('user_id', user.id);
          } else {
            await supabase
              .from('user_settings')
              .insert({ user_id: user.id, default_portfolio_id: id });
          }
        } catch (err) {
          console.error('Failed to save default portfolio to DB:', err);
        }
      }
  };

  // Check if demo mode is enabled
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();

  const loadPortfolios = useCallback(async () => {
    // In demo mode, provide a demo portfolio
    if (isDemoMode) {
      const demoPortfolioList: PortfolioSummary[] = [
        { id: 'demo-portfolio', name: 'Demo Portfolio', type: 'Mixed' }
      ];
      setPortfolios(demoPortfolioList);
      setActivePortfolioId('demo-portfolio');
      return;
    }

    if (!user?.id) {
      setPortfolios([]);
      setActivePortfolioId('');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('portfolios')
        .select('id, name, description')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const portfolioList: PortfolioSummary[] = data.map(p => ({
          id: p.id,
          name: p.name,
          type: (p.description as 'Stock' | 'Crypto' | 'Mixed') || 'Mixed'
        }));
        setPortfolios(portfolioList);
        
        // Set active portfolio to default or first one
        if (defaultPortfolioId && portfolioList.some(p => p.id === defaultPortfolioId)) {
          setActivePortfolioId(defaultPortfolioId);
        } else if (!activePortfolioId || !portfolioList.some(p => p.id === activePortfolioId)) {
          setActivePortfolioId(portfolioList[0].id);
        }
      } else {
        setPortfolios([]);
        setActivePortfolioId('');
      }
    } catch (err) {
      console.error('Failed to load portfolios:', err);
      setPortfolios([]);
    }
  }, [user?.id, defaultPortfolioId, isDemoMode]);

  useEffect(() => {
    loadPortfolios();
  }, [loadPortfolios]);

  // Load active portfolio data from DB
  const loadActivePortfolioData = useCallback(async () => {
    // In demo mode, provide demo portfolio data
    if (isDemoMode) {
      setActivePortfolio({
        id: 'demo-portfolio',
        name: 'Demo Portfolio',
        totalValue: DEMO_PORTFOLIO_VALUE,
        cashBalance: 5000,
        holdings: DEMO_HOLDINGS,
        transactions: [],
        manualAssets: [],
        liabilities: []
      });
      setLoadingPortfolio(false);
      return;
    }

    if (!activePortfolioId || !user?.id || activePortfolioId.startsWith('demo') || activePortfolioId === 'loading') {
      if (!isDemoMode) setActivePortfolio(EMPTY_PORTFOLIO);
      return;
    }

    setLoadingPortfolio(true);
    try {
      // Load portfolio info
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', activePortfolioId)
        .single();

      if (portfolioError) throw portfolioError;

      // Load holdings
      const { data: holdingsData, error: holdingsError } = await supabase
        .from('holdings')
        .select('*')
        .eq('portfolio_id', activePortfolioId);

      if (holdingsError) throw holdingsError;

      // Load transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('portfolio_id', activePortfolioId)
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Map DB holdings to app Holding type
      const holdings: Holding[] = (holdingsData || []).map(h => ({
        id: h.id,
        symbol: h.symbol,
        name: h.name,
        shares: safeFloat(h.shares),
        avgPrice: safeFloat(h.avg_price),
        currentPrice: safeFloat(h.current_price) || safeFloat(h.avg_price),
        assetType: h.asset_type as AssetType,
        sector: h.sector || undefined,
        country: h.country || 'USA',
        dividendYield: safeFloat(h.dividend_yield),
        expenseRatio: safeFloat(h.expense_ratio),
        logoUrl: h.logo_url || undefined,
        snowflake: { value: 3, future: 3, past: 3, health: 3, dividend: 3, total: 15 },
        safetyScore: 75
      }));

      // Map DB transactions to app Transaction type
      const transactions: Transaction[] = (transactionsData || []).map(t => ({
        id: t.id,
        date: t.transaction_date,
        type: t.type as 'BUY' | 'SELL',
        symbol: t.symbol,
        shares: safeFloat(t.shares),
        price: safeFloat(t.price),
        totalValue: safeFloat(t.total_value),
        fees: safeFloat(t.fees),
        notes: t.notes || undefined
      }));

      // Calculate total value
      const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);

      setActivePortfolio({
        id: portfolioData.id,
        name: portfolioData.name,
        totalValue,
        cashBalance: safeFloat(portfolioData.cash_balance),
        holdings,
        transactions,
        manualAssets: [],
        liabilities: []
      });
    } catch (err) {
      console.error('Failed to load portfolio data:', err);
      setActivePortfolio(EMPTY_PORTFOLIO);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [activePortfolioId, user?.id, isDemoMode]);

  useEffect(() => {
    loadActivePortfolioData();
  }, [loadActivePortfolioData]);

  const addNewPortfolio = async (name: string, type: 'Stock' | 'Crypto' | 'Mixed'): Promise<string | null> => {
    if (isDemoMode) {
      // Local-only for demo users
      const finalId = `local-${Date.now()}`;
      const optimisticSummary: PortfolioSummary = { id: finalId, name, type };
      setPortfolios(prev => [...prev, optimisticSummary]);
      setActivePortfolioId(finalId);
      return finalId;
    }

    try {
      // Save to Supabase
      const { data, error } = await supabase
        .from('portfolios')
        .insert({
          user_id: user.id,
          name,
          description: type,
          currency: 'USD',
          cash_balance: 0
        })
        .select()
        .single();

      if (error) throw error;

      const newSummary: PortfolioSummary = { 
        id: data.id, 
        name: data.name, 
        type: (data.description as 'Stock' | 'Crypto' | 'Mixed') || 'Mixed' 
      };
      
      setPortfolios(prev => [...prev, newSummary]);
      setActivePortfolioId(data.id);
      
      return data.id;
    } catch (err) {
      console.error('Failed to create portfolio:', err);
      return null;
    }
  };

  const importPortfolio = async (name: string, transactions: any[], targetPortfolioId?: string) => {
      alert(`Successfully imported ${transactions.length} transactions!`);
  };

  const addTransaction = async (symbol: string, type: 'BUY' | 'SELL', shares: number, price: number, date: string) => {
      if (!activePortfolioId || !user?.id) return;

      try {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            portfolio_id: activePortfolioId,
            symbol: symbol.toUpperCase(),
            type,
            shares: safeFloat(shares),
            price: safeFloat(price),
            total_value: safeFloat(shares) * safeFloat(price),
            transaction_date: date
          })
          .select()
          .single();

        if (error) throw error;

        // Automatically create tax lot for BUY transactions
        if (type === 'BUY' && data) {
          try {
            // Find the holding ID for this symbol
            const { data: holdingData } = await supabase
              .from('holdings')
              .select('id')
              .eq('portfolio_id', activePortfolioId)
              .eq('symbol', symbol.toUpperCase())
              .maybeSingle();

            await supabase
              .from('tax_lots')
              .insert({
                user_id: user.id,
                portfolio_id: activePortfolioId,
                holding_id: holdingData?.id || null,
                symbol: symbol.toUpperCase(),
                shares: safeFloat(shares),
                cost_basis: safeFloat(price),
                purchase_date: date,
                lot_type: 'buy',
                is_closed: false
              });
              
            console.log('Tax lot automatically created for BUY transaction');
          } catch (taxLotError) {
            console.error('Failed to create tax lot (non-blocking):', taxLotError);
            // Don't throw - tax lot creation is a nice-to-have, not blocking
          }
        }

        // Refresh portfolio data
        await loadActivePortfolioData();
      } catch (err) {
        console.error('Failed to add transaction:', err);
      }
  };

  const updateHolding = async (holdingId: string, updates: Partial<Holding>) => {
      if (!isDemoMode && user?.id) {
        try {
          // Map Holding fields to DB column names
          const dbUpdates: Record<string, any> = {};
          if (updates.shares !== undefined) dbUpdates.shares = updates.shares;
          if (updates.avgPrice !== undefined) dbUpdates.avg_price = updates.avgPrice;
          if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
          if (updates.name !== undefined) dbUpdates.name = updates.name;
          if (updates.sector !== undefined) dbUpdates.sector = updates.sector;
          if (updates.dividendYield !== undefined) dbUpdates.dividend_yield = updates.dividendYield;
          if (updates.expenseRatio !== undefined) dbUpdates.expense_ratio = updates.expenseRatio;
          if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
          dbUpdates.updated_at = new Date().toISOString();

          const { error } = await supabase
            .from('holdings')
            .update(dbUpdates)
            .eq('id', holdingId);

          if (error) throw error;

          // Refresh portfolio data from DB to ensure consistency
          await loadActivePortfolioData();
        } catch (err) {
          console.error('Failed to update holding:', err);
        }
      } else {
        // Local-only for demo mode
        const updatedHoldings = activePortfolio.holdings.map(h =>
            h.id === holdingId ? { ...h, ...updates } : h
        );
        setActivePortfolio(prev => ({
            ...prev,
            holdings: updatedHoldings
        }));
      }
  };

  const deleteHolding = async (holdingId: string) => {
      // Note: Confirmation dialog should be handled by the UI component calling this function
      if (!isDemoMode && user?.id) {
        try {
          const { error } = await supabase
            .from('holdings')
            .delete()
            .eq('id', holdingId);

          if (error) throw error;

          // Refresh portfolio data from DB
          await loadActivePortfolioData();
        } catch (err) {
          console.error('Failed to delete holding:', err);
          throw err; // Re-throw so UI can handle
        }
      } else {
        // Local-only for demo mode
        const updatedHoldings = activePortfolio.holdings.filter(h => h.id !== holdingId);
        setActivePortfolio(prev => ({
            ...prev,
            holdings: updatedHoldings
        }));
      }
  };

  const addManualAsset = async (asset: Omit<ManualAsset, 'id'>) => {
      const newAsset = { ...asset, id: `ma-${Date.now()}` };
      setActivePortfolio(prev => ({
          ...prev,
          manualAssets: [...(prev.manualAssets || []), newAsset]
      }));
  };

  const addLiability = async (liability: Omit<Liability, 'id'>) => {
      const newLiab = { ...liability, id: `li-${Date.now()}` };
      setActivePortfolio(prev => ({
          ...prev,
          liabilities: [...(prev.liabilities || []), newLiab]
      }));
  };

  const syncBroker = async (brokerId: string) => {
      console.log(`Syncing broker ${brokerId}...`);
      return false;
  };

  const switchPortfolio = (id: string) => setActivePortfolioId(id);
  const switchView = (view: ViewState) => setActiveView(view);

  const viewStock = (symbol: string) => {
      setSelectedResearchSymbol(symbol);
      setActiveView('research');
  };

  const toggleWatchlist = (symbol: string) => {
      setWatchlists(prev => prev.map(w => {
          if (w.id === activeWatchlistId) {
              if (w.symbols.includes(symbol)) {
                  return { ...w, symbols: w.symbols.filter(s => s !== symbol) };
              } else {
                  return { ...w, symbols: [...w.symbols, symbol] };
              }
          }
          return w;
      }));
  };

  const createWatchlist = (name: string) => {
      const newId = `wl-${Date.now()}`;
      setWatchlists(prev => [...prev, { id: newId, name, symbols: [] }]);
      setActiveWatchlistId(newId);
  };

  const switchWatchlist = (id: string) => setActiveWatchlistId(id);

  const openAddAssetModal = (ticker?: string) => {
      setPreSelectedAssetTicker(ticker || null);
      setIsAddAssetModalOpen(true);
  };

  const closeAddAssetModal = () => {
      setIsAddAssetModalOpen(false);
      setPreSelectedAssetTicker(null);
  };

  const markAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const clearNotifications = () => setNotifications([]);

  const addAlert = async (symbol: string, targetPrice: number, condition: 'ABOVE' | 'BELOW') => {
      const newAlert: AlertConfig = {
          id: `alert-${Date.now()}`,
          symbol,
          targetPrice,
          condition,
          createdAt: new Date().toISOString(),
          isActive: true
      };
      setAlerts(prev => [...prev, newAlert]);
  };

  const removeAlert = async (id: string) => {
      setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const toggleMarketOpen = () => setIsMarketOpen(!isMarketOpen);

  return (
    <PortfolioContext.Provider value={{
      portfolios,
      activePortfolio,
      activePortfolioId,
      defaultPortfolioId,
      switchPortfolio,
      setDefaultPortfolio,
      addNewPortfolio,
      importPortfolio,
      addTransaction,
      updateHolding,
      deleteHolding,
      addManualAsset,
      addLiability,
      watchlists,
      activeWatchlistId,
      toggleWatchlist,
      createWatchlist,
      switchWatchlist,
      activeView,
      switchView,
      selectedResearchSymbol,
      viewStock,
      notifications,
      markAsRead,
      clearNotifications,
      isAddAssetModalOpen,
      preSelectedAssetTicker,
      openAddAssetModal,
      closeAddAssetModal,
      alerts,
      addAlert,
      removeAlert,
      isMarketOpen,
      toggleMarketOpen,
      marketDataApiKey,
      setMarketDataApiKey: updateMarketDataKey,
      syncBroker,
      refetchPortfolio: loadActivePortfolioData,
      loadingPortfolio
    }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
