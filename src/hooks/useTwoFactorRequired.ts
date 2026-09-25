import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TwoFactorRequirement {
  isRequired: boolean;
  isEnabled: boolean;
  isEnforced: boolean;
  enforcementDeadline: string | null;
  loading: boolean;
}

export const useTwoFactorRequired = (userId: string | undefined) => {
  const [requirement, setRequirement] = useState<TwoFactorRequirement>({
    isRequired: false,
    isEnabled: false,
    isEnforced: false,
    enforcementDeadline: null,
    loading: true
  });

  const checkRequirement = useCallback(async () => {
    if (!userId || userId === 'demo-user') {
      setRequirement(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Check user role and 2FA requirement
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, requires_2fa, enforce_2fa_after')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        setRequirement(prev => ({ ...prev, loading: false }));
        return;
      }

      // Check if user has 2FA enabled
      const { data: twoFAData, error: twoFAError } = await supabase
        .from('two_factor_auth')
        .select('is_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (twoFAError) {
        console.error('Error fetching 2FA status:', twoFAError);
      }

      const isAdmin = roleData?.role === 'admin' || roleData?.role === 'super_admin';
      const requires2FA = roleData?.requires_2fa ?? false;
      const enforcementDeadline = roleData?.enforce_2fa_after;
      const is2FAEnabled = twoFAData?.is_enabled ?? false;
      
      // Check if enforcement deadline has passed
      const isEnforced = enforcementDeadline ? new Date(enforcementDeadline) <= new Date() : false;
      
      // 2FA is required if:
      // 1. User is admin/super_admin AND requires_2fa is true
      // 2. AND the enforcement deadline has passed (or no deadline set but requires_2fa is true)
      const isRequired = isAdmin && requires2FA && (isEnforced || !enforcementDeadline);

      setRequirement({
        isRequired,
        isEnabled: is2FAEnabled,
        isEnforced,
        enforcementDeadline,
        loading: false
      });
    } catch (err) {
      console.error('Failed to check 2FA requirement:', err);
      setRequirement(prev => ({ ...prev, loading: false }));
    }
  }, [userId]);

  useEffect(() => {
    checkRequirement();
  }, [checkRequirement]);

  return { ...requirement, refetch: checkRequirement };
};
