import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

type Strategy = 'Growth' | 'Income' | 'Speculative' | 'Value' | 'Index';

export function useHoldingCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Record<string, Strategy>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    
    const fetch = async () => {
      const { data } = await supabase
        .from('holding_categories')
        .select('symbol, category')
        .eq('user_id', user.id) as any;
      
      const map: Record<string, Strategy> = {};
      (data || []).forEach((r: any) => { map[r.symbol] = r.category as Strategy; });
      setCategories(map);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const setCategory = useCallback(async (symbol: string, category: Strategy) => {
    if (!user) return;
    setCategories(prev => ({ ...prev, [symbol]: category }));
    
    await supabase.from('holding_categories').upsert(
      { user_id: user.id, symbol, category } as any,
      { onConflict: 'user_id,symbol' }
    );
  }, [user]);

  return { categories, setCategory, loading };
}
