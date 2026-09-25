import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'user' | 'admin' | 'super_admin';

export const useUserRole = (userId: string | undefined) => {
  const [role, setRole] = useState<AppRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !UUID_RE.test(userId)) {
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .order('role')
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setRole(data.role as AppRole);
        }
      } catch (error) {
        console.error('Failed to fetch user role:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [userId]);

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';

  return { role, isAdmin, isSuperAdmin, loading };
};
