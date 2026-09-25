import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface BrokerConnection {
  id: string;
  user_id: string;
  provider_name: string;
  provider_type: 'Stock' | 'Crypto' | 'Mixed';
  connection_type: 'API' | 'CSV' | 'Manual';
  status: 'connected' | 'syncing' | 'error' | 'pending' | 'disconnected';
  api_key_encrypted: string | null;
  last_sync: string | null;
  sync_error: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BrokerProvider {
  id: string;
  name: string;
  type: 'Stock' | 'Crypto' | 'Mixed';
  logo_url: string | null;
  is_enabled: boolean;
  supports_api: boolean;
  supports_csv: boolean;
  api_docs_url: string | null;
  created_at: string;
}

export const useBrokerConnections = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [providers, setProviders] = useState<BrokerProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    if (!user?.id || user.id === 'demo-user') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('broker_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections((data || []) as unknown as BrokerConnection[]);
    } catch (err) {
      console.error('Failed to fetch broker connections:', err);
    }
  }, [user?.id]);

  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('broker_providers')
        .select('*')
        .order('name');

      if (error) throw error;
      setProviders((data || []) as unknown as BrokerProvider[]);
    } catch (err) {
      console.error('Failed to fetch broker providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    fetchConnections();
  }, [fetchProviders, fetchConnections]);

  const connectBroker = async (
    providerName: string,
    providerType: 'Stock' | 'Crypto' | 'Mixed',
    connectionType: 'API' | 'CSV' | 'Manual',
    apiKey?: string,
    metadata?: Record<string, any>
  ) => {
    if (!user?.id || user.id === 'demo-user') return null;

    const { data, error } = await supabase
      .from('broker_connections')
      .insert({
        user_id: user.id,
        provider_name: providerName,
        provider_type: providerType,
        connection_type: connectionType,
        status: connectionType === 'Manual' ? 'connected' : 'pending',
        api_key_encrypted: apiKey || null,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (error) throw error;
    await fetchConnections();
    return data;
  };

  const disconnectBroker = async (connectionId: string) => {
    const { error } = await supabase
      .from('broker_connections')
      .delete()
      .eq('id', connectionId);

    if (error) throw error;
    await fetchConnections();
  };

  const updateConnectionStatus = async (connectionId: string, status: BrokerConnection['status'], syncError?: string) => {
    const { error } = await supabase
      .from('broker_connections')
      .update({ 
        status, 
        sync_error: syncError || null,
        last_sync: status === 'connected' ? new Date().toISOString() : undefined
      })
      .eq('id', connectionId);

    if (error) throw error;
    await fetchConnections();
  };

  return {
    connections,
    providers,
    loading,
    connectBroker,
    disconnectBroker,
    updateConnectionStatus,
    refetch: () => {
      fetchConnections();
      fetchProviders();
    }
  };
};
