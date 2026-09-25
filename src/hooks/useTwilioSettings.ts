import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface TwilioSettings {
  isConfigured: boolean;
  isEnabled: boolean;
  phoneNumber: string;
}

export const useTwilioSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TwilioSettings>({
    isConfigured: false,
    isEnabled: false,
    phoneNumber: ''
  });
  const [loading, setLoading] = useState(true);

  const checkTwilioConfiguration = useCallback(async () => {
    try {
      // Check if Twilio is configured by calling a test endpoint
      const { data, error } = await supabase.functions.invoke('notifications', {
        body: { action: 'check_twilio_status' }
      });
      
      if (!error && data) {
        setSettings({
          isConfigured: data.isConfigured || false,
          isEnabled: data.isEnabled || false,
          phoneNumber: data.fromNumber || ''
        });
      }
    } catch (err) {
      console.error('Failed to check Twilio status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkTwilioConfiguration();
  }, [checkTwilioConfiguration]);

  const toggleSmsNotifications = async (enabled: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('notifications', {
        body: { action: 'toggle_sms', enabled }
      });
      
      if (error) throw error;
      
      setSettings(prev => ({ ...prev, isEnabled: enabled }));
      return true;
    } catch (err) {
      console.error('Failed to toggle SMS notifications:', err);
      return false;
    }
  };

  return {
    settings,
    loading,
    toggleSmsNotifications,
    refetch: checkTwilioConfiguration
  };
};
