import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { DEMO_NOTIFICATIONS, DEMO_UNREAD_COUNT } from '@/constants/demoNotifications';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';

export type AppNotificationType =
  | 'follower'
  | 'like'
  | 'comment'
  | 'dividend'
  | 'market_sync'
  | 'system'
  | 'tax';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  actor_id: string;
  target_id: string | null;
  content: string | null;
  is_read: boolean;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { notifyAlert } = useAlertNotifications();

  const fetchNotifications = useCallback(async () => {
    if (isDemoMode) {
      setNotifications(DEMO_NOTIFICATIONS);
      setUnreadCount(DEMO_UNREAD_COUNT);
      setLoading(false);
      return;
    }

    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const actorIds = [...new Set(data.map(n => n.actor_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', actorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enriched: AppNotification[] = data.map(n => ({
          id: n.id,
          type: n.type as AppNotificationType,
          actor_id: n.actor_id,
          target_id: n.target_id,
          content: n.content,
          is_read: n.is_read,
          created_at: n.created_at,
          actor_name: profileMap.get(n.actor_id)?.full_name || 'Someone',
          actor_avatar: profileMap.get(n.actor_id)?.avatar_url
        }));

        setNotifications(enriched);
        setUnreadCount(enriched.filter(n => !n.is_read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isDemoMode]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const createNotification = async (
    targetUserId: string,
    type: 'follower' | 'like' | 'comment',
    targetId?: string,
    content?: string
  ) => {
    if (!user || targetUserId === user.id) return;

    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type,
          actor_id: user.id,
          target_id: targetId || null,
          content: content || null
        });
    } catch (err) {
      console.error('Error creating notification:', err);
    }
  };

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.actor_id)
            .single();

          const newNotification: AppNotification = {
            id: payload.new.id,
            type: payload.new.type as AppNotificationType,
            actor_id: payload.new.actor_id,
            target_id: payload.new.target_id,
            content: payload.new.content,
            is_read: payload.new.is_read,
            created_at: payload.new.created_at,
            actor_name: profile?.full_name || 'Someone',
            actor_avatar: profile?.avatar_url
          };

          // Play sound + desktop notification for key alert types
          const alertTypes = new Set<AppNotificationType>(['dividend', 'market_sync', 'tax']);
          if (alertTypes.has(newNotification.type)) {
            const soundOn = localStorage.getItem('alert-sound-enabled') !== 'false';
            if (soundOn) {
              notifyAlert(
                newNotification.type,
                newNotification.type,
                newNotification.content || 'You have a new notification.'
              );
            }
          }

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications, notifyAlert]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    refetch: fetchNotifications
  };
};
