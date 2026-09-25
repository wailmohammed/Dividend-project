import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole, AppRole } from './useUserRole';
import { useAuth } from '@/context/AuthContext';

export interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: string | null;
  role: AppRole;
  created_at: string;
}

export const useAdminUsers = () => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useUserRole(user?.id);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin && !isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Merge data
      const mergedUsers: AdminUser[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          plan: profile.plan,
          role: (userRole?.role as AppRole) || 'user',
          created_at: profile.created_at
        };
      });

      setUsers(mergedUsers);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    // Check if user already has a role entry
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingRole) {
      // Update existing role
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;
    }

    await fetchUsers();
  };

  const deleteUser = async (userId: string) => {
    // Note: This only removes from profiles, auth.users deletion requires admin API
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;
    await fetchUsers();
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', userId);

    if (error) throw error;
    await fetchUsers();
  };

  return {
    users,
    loading,
    updateUserRole,
    deleteUser,
    updateUserPlan,
    refetch: fetchUsers
  };
};
