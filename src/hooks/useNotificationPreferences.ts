import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_price_alerts: boolean;
  email_dividend_alerts: boolean;
  email_security_alerts: boolean;
  email_weekly_summary: boolean;
  email_new_followers: boolean;
  email_new_likes: boolean;
  email_new_comments: boolean;
  email_tax_alerts: boolean;
  email_portfolio_alerts: boolean;
  sms_price_alerts: boolean;
  sms_dividend_alerts: boolean;
  sms_security_alerts: boolean;
  sms_tax_alerts: boolean;
  sms_portfolio_alerts: boolean;
  push_tax_alerts: boolean;
  push_portfolio_alerts: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  email_price_alerts: true,
  email_dividend_alerts: true,
  email_security_alerts: true,
  email_weekly_summary: false,
  email_new_followers: true,
  email_new_likes: true,
  email_new_comments: true,
  email_tax_alerts: true,
  email_portfolio_alerts: true,
  sms_price_alerts: false,
  sms_dividend_alerts: false,
  sms_security_alerts: true,
  sms_tax_alerts: false,
  sms_portfolio_alerts: false,
  push_tax_alerts: true,
  push_portfolio_alerts: true,
};

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id || user.id === 'demo-user') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPreferences(data as unknown as NotificationPreferences);
      } else {
        // Create default preferences if none exist
        const { data: newData, error: insertError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id, ...DEFAULT_PREFERENCES })
          .select()
          .single();
        
        if (!insertError && newData) {
          setPreferences(newData as unknown as NotificationPreferences);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notification preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = async (key: keyof Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>, value: boolean) => {
    if (!user?.id || user.id === 'demo-user') return false;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setPreferences(prev => prev ? { ...prev, [key]: value } : null);
      return true;
    } catch (err) {
      console.error('Failed to update notification preference:', err);
      return false;
    }
  };

  return {
    preferences,
    loading,
    updatePreference,
    refetch: fetchPreferences
  };
};
