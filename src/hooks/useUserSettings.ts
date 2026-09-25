import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type CostBasisMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'LOFO' | 'AVGCOST' | 'SPECIFIC';

export interface UserSettings {
  id: string;
  user_id: string;
  default_portfolio_id: string | null;
  default_cost_basis_method: CostBasisMethod;
  state_code: string | null;
  state_tax_rate: number;
  federal_tax_rate: number;
  dividend_tax_rate: number;
  qualified_dividend_rate: number;
  investing_mode: 'normal' | 'halal';
  theme: string;
  created_at: string;
  updated_at: string;
}

export const useUserSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user?.id || user.id === 'demo-user') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data as unknown as UserSettings);
      }
    } catch (err) {
      console.error('Failed to fetch user settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    if (!user?.id || user.id === 'demo-user') return;

    try {
      // Check if settings already exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('user_settings')
          .update({ 
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('user_settings')
          .insert({ 
            user_id: user.id, 
            ...updates,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      }
      
      await fetchSettings();
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  };

  const setDefaultPortfolio = async (portfolioId: string | null) => {
    await updateSettings({ default_portfolio_id: portfolioId } as Partial<UserSettings>);
  };

  const setDefaultCostBasisMethod = async (method: CostBasisMethod) => {
    await updateSettings({ default_cost_basis_method: method } as Partial<UserSettings>);
  };

  return {
    settings,
    loading,
    updateSettings,
    setDefaultPortfolio,
    setDefaultCostBasisMethod,
    refetch: fetchSettings
  };
};
