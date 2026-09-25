import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface WebhookSetting {
  id: string;
  user_id: string;
  webhook_type: 'slack' | 'discord';
  webhook_url: string;
  is_active: boolean;
  notify_price_alerts: boolean;
  notify_dividend_alerts: boolean;
  notify_portfolio_alerts: boolean;
  created_at: string;
  updated_at: string;
}

export const useWebhookSettings = () => {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebhooks = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('webhook_settings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks((data as WebhookSetting[]) || []);
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const addWebhook = useCallback(async (
    type: 'slack' | 'discord',
    url: string,
    options?: {
      notifyPriceAlerts?: boolean;
      notifyDividendAlerts?: boolean;
      notifyPortfolioAlerts?: boolean;
    }
  ) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('webhook_settings')
        .insert({
          user_id: user.id,
          webhook_type: type,
          webhook_url: url,
          notify_price_alerts: options?.notifyPriceAlerts ?? true,
          notify_dividend_alerts: options?.notifyDividendAlerts ?? true,
          notify_portfolio_alerts: options?.notifyPortfolioAlerts ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      setWebhooks(prev => [data as WebhookSetting, ...prev]);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} webhook added`);
      return data;
    } catch (error) {
      console.error('Failed to add webhook:', error);
      toast.error('Failed to add webhook');
      return null;
    }
  }, [user?.id]);

  const updateWebhook = useCallback(async (
    id: string,
    updates: Partial<Pick<WebhookSetting, 'webhook_url' | 'is_active' | 'notify_price_alerts' | 'notify_dividend_alerts' | 'notify_portfolio_alerts'>>
  ) => {
    try {
      const { error } = await supabase
        .from('webhook_settings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev =>
        prev.map(w => w.id === id ? { ...w, ...updates } : w)
      );
      toast.success('Webhook updated');
    } catch (error) {
      console.error('Failed to update webhook:', error);
      toast.error('Failed to update webhook');
    }
  }, []);

  const deleteWebhook = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('webhook_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast.success('Webhook deleted');
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Failed to delete webhook');
    }
  }, []);

  const testWebhook = useCallback(async (webhook: WebhookSetting) => {
    try {
      const { error } = await supabase.functions.invoke('webhook-notify', {
        body: {
          type: 'portfolio_alert',
          userId: user?.id,
          data: {
            symbol: 'TEST',
            alertType: 'test',
            message: '🧪 This is a test notification from WealthOS!',
            triggeredAt: new Date().toISOString()
          }
        }
      });

      if (error) throw error;
      toast.success('Test notification sent!');
    } catch (error) {
      console.error('Failed to test webhook:', error);
      toast.error('Failed to send test notification');
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  return {
    webhooks,
    loading,
    addWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    refetch: fetchWebhooks,
  };
};
