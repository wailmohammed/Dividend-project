import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface TwoFactorAuth {
  id: string;
  user_id: string;
  is_enabled: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useTwoFactorAuth = () => {
  const { user } = useAuth();
  const [twoFA, setTwoFA] = useState<TwoFactorAuth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTwoFA = useCallback(async () => {
    if (!user?.id || user.id === 'demo-user') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('two_factor_auth')
        .select('id, user_id, is_enabled, last_verified_at, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setTwoFA(data as unknown as TwoFactorAuth | null);
    } catch (err) {
      console.error('Failed to fetch 2FA settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTwoFA();
  }, [fetchTwoFA]);

  // Setup 2FA (not implemented yet - placeholder for future)
  const setupTwoFA = async (): Promise<{ secret: string; qrCode: string } | null> => {
    if (!user?.id || user.id === 'demo-user') return null;

    // This would typically:
    // 1. Generate a TOTP secret on the server
    // 2. Return the secret and QR code for the user to scan
    // 3. Store the encrypted secret in the database
    
    console.log('2FA setup not yet implemented');
    return null;
  };

  // Verify 2FA code (placeholder)
  const verifyTwoFA = async (code: string): Promise<boolean> => {
    if (!user?.id || user.id === 'demo-user') return false;

    // This would verify the TOTP code against the stored secret
    console.log('2FA verification not yet implemented', code);
    return false;
  };

  // Enable 2FA (placeholder)
  const enableTwoFA = async (): Promise<boolean> => {
    if (!user?.id || user.id === 'demo-user' || !twoFA) return false;

    try {
      const { error } = await supabase
        .from('two_factor_auth')
        .update({ is_enabled: true })
        .eq('user_id', user.id);

      if (error) throw error;
      await fetchTwoFA();
      return true;
    } catch (err) {
      console.error('Failed to enable 2FA:', err);
      return false;
    }
  };

  // Disable 2FA (placeholder)
  const disableTwoFA = async (): Promise<boolean> => {
    if (!user?.id || user.id === 'demo-user' || !twoFA) return false;

    try {
      const { error } = await supabase
        .from('two_factor_auth')
        .update({ is_enabled: false })
        .eq('user_id', user.id);

      if (error) throw error;
      await fetchTwoFA();
      return true;
    } catch (err) {
      console.error('Failed to disable 2FA:', err);
      return false;
    }
  };

  return {
    twoFA,
    loading,
    isEnabled: twoFA?.is_enabled ?? false,
    setupTwoFA,
    verifyTwoFA,
    enableTwoFA,
    disableTwoFA,
    refetch: fetchTwoFA
  };
};
