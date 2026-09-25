import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from './useUserRole';

export interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const useAuditLogs = () => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useUserRole(user?.id);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin && !isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data || []) as AuditLog[]);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const logAction = async (
    actionType: string,
    targetType: string,
    targetId?: string,
    details?: Record<string, any>
  ) => {
    if (!user?.id) return;

    try {
      await supabase.functions.invoke('admin-notifications', {
        body: {
          type: 'admin_action',
          adminUserId: user.id,
          targetUserId: targetId,
          details: {
            action: actionType,
            target_type: targetType,
            ...details
          }
        }
      });
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  };

  return {
    logs,
    loading,
    refetch: fetchLogs,
    logAction
  };
};
