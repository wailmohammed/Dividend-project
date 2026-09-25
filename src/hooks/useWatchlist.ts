import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { DEMO_WATCHLIST } from '@/constants/demoHoldings';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string | null;
  added_at: string;
  notes: string | null;
  target_price: number | null;
  alert_enabled: boolean;
  position: number;
  // Enriched data (not from DB)
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export const useWatchlist = () => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Demo mode is active when: no user OR demo user OR user has explicitly enabled demo mode in settings
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();

  const fetchWatchlist = useCallback(async () => {
    // In demo mode, return demo data immediately
    if (isDemoMode) {
      const demoItems: WatchlistItem[] = DEMO_WATCHLIST.map((item, index) => ({
        id: item.id,
        user_id: 'demo-user',
        symbol: item.symbol,
        name: item.name,
        added_at: new Date().toISOString(),
        notes: null,
        target_price: item.target_price,
        alert_enabled: item.alert_enabled,
        position: index
      }));
      setWatchlist(demoItems);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      setWatchlist((data || []) as WatchlistItem[]);
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const addToWatchlist = async (symbol: string, name?: string) => {
    if (isDemoMode) {
      toast.error('Cannot modify watchlist in demo mode');
      return;
    }

    try {
      // Get the next position (max + 1)
      const maxPosition = watchlist.length > 0 
        ? Math.max(...watchlist.map(w => w.position ?? 0)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('watchlist')
        .insert({
          user_id: user!.id,
          symbol: symbol.toUpperCase(),
          name: name || null,
          position: maxPosition
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error(`${symbol} is already in your watchlist`);
        } else {
          throw error;
        }
        return;
      }

      await fetchWatchlist();
      toast.success(`${symbol} added to watchlist`);
      return data;
    } catch (err) {
      console.error('Failed to add to watchlist:', err);
      toast.error('Failed to add to watchlist');
    }
  };

  const removeFromWatchlist = async (id: string) => {
    if (isDemoMode) {
      toast.error('Cannot modify watchlist in demo mode');
      return;
    }

    try {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchWatchlist();
      toast.success('Removed from watchlist');
    } catch (err) {
      console.error('Failed to remove from watchlist:', err);
      toast.error('Failed to remove from watchlist');
    }
  };

  const updateWatchlistItem = async (id: string, updates: Partial<Pick<WatchlistItem, 'notes' | 'target_price' | 'alert_enabled' | 'position'>>) => {
    if (isDemoMode) {
      toast.error('Cannot modify watchlist in demo mode');
      return;
    }

    try {
      const { error } = await supabase
        .from('watchlist')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await fetchWatchlist();
    } catch (err) {
      console.error('Failed to update watchlist item:', err);
      toast.error('Failed to update');
    }
  };

  const reorderWatchlist = async (items: WatchlistItem[]) => {
    if (isDemoMode) return;
    
    // Optimistically update state
    setWatchlist(items);

    try {
      // Update all positions in a batch
      const updates = items.map((item, index) => 
        supabase
          .from('watchlist')
          .update({ position: index })
          .eq('id', item.id)
      );

      await Promise.all(updates);
    } catch (err) {
      console.error('Failed to reorder watchlist:', err);
      toast.error('Failed to save order');
      // Refetch to restore correct order on error
      await fetchWatchlist();
    }
  };

  const isInWatchlist = (symbol: string) => {
    return watchlist.some(item => item.symbol.toUpperCase() === symbol.toUpperCase());
  };

  return {
    watchlist,
    loading,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlistItem,
    reorderWatchlist,
    isInWatchlist,
    refetch: fetchWatchlist,
    isDemoMode
  };
};
