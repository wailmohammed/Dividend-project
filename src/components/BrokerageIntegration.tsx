import { useState } from 'react';
import { useBrokerConnections, BrokerProvider as DbBrokerProvider, BrokerConnection } from '@/hooks/useBrokerConnections';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { Link2, Upload, PenLine, Trash2, RefreshCw, CheckCircle, AlertCircle, Clock, Key, Eye, EyeOff, Loader2, FolderSync } from 'lucide-react';
import { ReauthenticationDialog } from './ReauthenticationDialog';
import { supabase } from '@/integrations/supabase/client';

export const BrokerageIntegration = () => {
  const { connections, providers, loading, connectBroker, disconnectBroker, updateConnectionStatus, refetch } = useBrokerConnections();
  const { portfolios, createPortfolio } = usePortfolioData();
  const { refetchPortfolio, activePortfolioId } = usePortfolio();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<DbBrokerProvider | null>(null);
  const [connectionType, setConnectionType] = useState<'API' | 'CSV' | 'Manual'>('Manual');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  
  // Re-authentication state for viewing API credentials
  const [showReauthDialog, setShowReauthDialog] = useState(false);
  const [pendingCredentialView, setPendingCredentialView] = useState<BrokerConnection | null>(null);
  const [visibleCredentials, setVisibleCredentials] = useState<Map<string, { apiKey: string; apiSecret: string | null }>>(new Map());
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  // Sync modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncConnection, setSyncConnection] = useState<BrokerConnection | null>(null);
  const [syncPortfolioId, setSyncPortfolioId] = useState<string>('');

  const handleConnect = async () => {
    if (!selectedProvider) return;

    try {
      setIsEncrypting(true);
      
      // First create the connection without the API key
      const connectionData = await connectBroker(
        selectedProvider.name,
        selectedProvider.type as 'Stock' | 'Crypto' | 'Mixed',
        connectionType,
        undefined, // Don't store unencrypted key
        connectionType === 'API' ? { hasApiKey: true } : undefined
      );

      // If API connection, encrypt the API key server-side
      if (connectionType === 'API' && connectionData && apiKey) {
        const { error } = await supabase.functions.invoke('encrypt-api-key', {
          body: {
            action: 'encrypt',
            connectionId: connectionData.id,
            apiKey,
            apiSecret: apiSecret || undefined
          }
        });

        if (error) {
          console.error('Failed to encrypt API key:', error);
          toast.error('Connected but failed to securely store API key');
        }
        
        refetch();
      }

      toast.success(`Connected to ${selectedProvider.name}`);
      setIsConnectModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDisconnect = async (connectionId: string, providerName: string) => {
    try {
      await disconnectBroker(connectionId);
      toast.success(`Disconnected from ${providerName}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect');
    }
  };

  const resetForm = () => {
    setSelectedProvider(null);
    setConnectionType('Manual');
    setApiKey('');
    setApiSecret('');
    setSelectedPortfolioId('');
    setNewPortfolioName('');
  };

  // Handle broker sync
  const handleSync = async (connection: BrokerConnection, portfolioId: string) => {
    if (!portfolioId) {
      toast.error('Please select a portfolio to sync to');
      return;
    }

    setIsSyncing(connection.id);
    try {
      const { data, error } = await supabase.functions.invoke('broker-sync', {
        body: {
          connectionId: connection.id,
          portfolioId: portfolioId,
          action: 'sync'
        }
      });

      if (error) {
        toast.error(error.message || 'Sync failed');
        return;
      }

      if (data?.success) {
        toast.success(data.message || `Synced ${data.positions?.length || 0} positions`);
        refetch();
        // Refresh portfolio data to reflect changes from DB
        if (portfolioId === activePortfolioId) {
          await refetchPortfolio();
        }
      } else {
        toast.error(data?.error || 'Sync failed');
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsSyncing(null);
      setShowSyncModal(false);
      setSyncConnection(null);
      setSyncPortfolioId('');
    }
  };

  // Open sync modal
  const openSyncModal = (connection: BrokerConnection) => {
    setSyncConnection(connection);
    setShowSyncModal(true);
  };

  // Create new portfolio and sync
  const handleCreateAndSync = async () => {
    if (!syncConnection || !newPortfolioName.trim()) return;

    try {
      const newPortfolio = await createPortfolio(newPortfolioName.trim());
      if (newPortfolio) {
        await handleSync(syncConnection, newPortfolio.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create portfolio');
    }
  };

  // Handle request to view API credentials - requires re-authentication
  const handleViewCredentials = (connection: BrokerConnection) => {
    if (visibleCredentials.has(connection.id)) {
      // Already verified and visible - hide it
      setVisibleCredentials(prev => {
        const next = new Map(prev);
        next.delete(connection.id);
        return next;
      });
      return;
    }
    
    // Require re-authentication before showing credentials
    setPendingCredentialView(connection);
    setShowReauthDialog(true);
  };

  // Called after successful re-authentication - decrypt credentials server-side
  const handleReauthSuccess = async () => {
    if (!pendingCredentialView) return;
    
    setIsDecrypting(true);
    try {
      const { data, error } = await supabase.functions.invoke('encrypt-api-key', {
        body: {
          action: 'decrypt',
          connectionId: pendingCredentialView.id
        }
      });

      if (error || !data?.success) {
        toast.error('Failed to decrypt credentials');
        return;
      }

      setVisibleCredentials(prev => {
        const next = new Map(prev);
        next.set(pendingCredentialView.id, {
          apiKey: data.apiKey,
          apiSecret: data.apiSecret
        });
        return next;
      });
      
      // Auto-hide credentials after 30 seconds for security
      const connectionId = pendingCredentialView.id;
      setTimeout(() => {
        setVisibleCredentials(prev => {
          const next = new Map(prev);
          next.delete(connectionId);
          return next;
        });
      }, 30000);
    } catch (err) {
      console.error('Decryption error:', err);
      toast.error('Failed to retrieve credentials');
    } finally {
      setIsDecrypting(false);
      setPendingCredentialView(null);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string | null) => {
    if (!key) return 'Not set';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'syncing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Consolidated Accounts Summary */}
      {connections.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Connected Accounts</div>
              <div className="text-2xl font-bold">{connections.length}</div>
              <div className="text-xs text-muted-foreground">{connections.filter(c => c.status === 'connected').length} active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Brokers</div>
              <div className="text-2xl font-bold">{new Set(connections.map(c => c.provider_name)).size}</div>
              <div className="text-xs text-muted-foreground">unique providers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Connection Types</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[...new Set(connections.map(c => c.connection_type))].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{t}</span>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Last Sync</div>
              <div className="text-sm font-medium">
                {connections.some(c => c.last_sync) 
                  ? new Date(Math.max(...connections.filter(c => c.last_sync).map(c => new Date(c.last_sync!).getTime()))).toLocaleDateString()
                  : 'Never'
                }
              </div>
              <div className="text-xs text-muted-foreground">across all accounts</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Brokerage Integrations</h2>
          <p className="text-muted-foreground">Connect your trading accounts — see all investments in one place</p>
        </div>
        <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Link2 className="w-4 h-4 mr-2" />
              Connect Broker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Connect Brokerage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Provider Selection */}
              <div>
                <Label>Select Provider</Label>
                <Select 
                  value={selectedProvider?.id || ''} 
                  onValueChange={(id) => setSelectedProvider(providers.find(p => p.id === id) || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a broker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.filter(p => p.is_enabled).map(provider => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <span>{provider.name}</span>
                          <span className="text-xs text-muted-foreground">({provider.type})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProvider && (
                <>
                  {/* Connection Type */}
                  <Tabs value={connectionType} onValueChange={(v) => setConnectionType(v as any)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="Manual" className="flex-1">
                        <PenLine className="w-4 h-4 mr-2" />
                        Manual
                      </TabsTrigger>
                      {selectedProvider.supports_csv && (
                        <TabsTrigger value="CSV" className="flex-1">
                          <Upload className="w-4 h-4 mr-2" />
                          CSV Import
                        </TabsTrigger>
                      )}
                      {selectedProvider.supports_api && (
                        <TabsTrigger value="API" className="flex-1">
                          <Link2 className="w-4 h-4 mr-2" />
                          API
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="Manual" className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Manually add your holdings and transactions. Best for simple tracking.
                      </p>
                    </TabsContent>

                    <TabsContent value="CSV" className="space-y-4 mt-4">
                      <div>
                        <Label>Upload CSV File</Label>
                        <Input type="file" accept=".csv" className="mt-1" />
                        <p className="text-xs text-muted-foreground mt-1">
                          Export your transaction history from {selectedProvider.name} and upload here
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="API" className="space-y-4 mt-4">
                      <div>
                        <Label>API Key</Label>
                        <Input 
                          type="password" 
                          value={apiKey} 
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter your API key"
                        />
                      </div>
                      <div>
                        <Label>API Secret (if required)</Label>
                        <Input 
                          type="password" 
                          value={apiSecret} 
                          onChange={(e) => setApiSecret(e.target.value)}
                          placeholder="Enter your API secret"
                        />
                      </div>
                      {selectedProvider.api_docs_url && (
                        <a 
                          href={selectedProvider.api_docs_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          How to get API keys →
                        </a>
                      )}
                    </TabsContent>
                  </Tabs>

                  <Button onClick={handleConnect} className="w-full" disabled={isEncrypting}>
                    {isEncrypting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Securing credentials...
                      </>
                    ) : (
                      <>Connect {selectedProvider.name}</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connected Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connections.map(connection => (
          <Card key={connection.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{connection.provider_name}</CardTitle>
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(connection.status)}`}>
                  {getStatusIcon(connection.status)}
                  {connection.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Type:</span>
                  <span>{connection.provider_type}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Connection:</span>
                  <span>{connection.connection_type}</span>
                </div>
                {connection.last_sync && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Last Sync:</span>
                    <span>{new Date(connection.last_sync).toLocaleDateString()}</span>
                  </div>
                )}
                
                {/* API Credentials section - requires re-authentication to view */}
                {connection.connection_type === 'API' && connection.api_key_encrypted && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">API Key:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {visibleCredentials.has(connection.id) 
                            ? visibleCredentials.get(connection.id)?.apiKey || '••••••••'
                            : maskApiKey(connection.api_key_encrypted)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleViewCredentials(connection)}
                          disabled={isDecrypting && pendingCredentialView?.id === connection.id}
                          title={visibleCredentials.has(connection.id) ? "Hide credentials" : "View credentials (requires password)"}
                        >
                          {isDecrypting && pendingCredentialView?.id === connection.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : visibleCredentials.has(connection.id) ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {visibleCredentials.has(connection.id) && visibleCredentials.get(connection.id)?.apiSecret && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-muted-foreground text-xs">API Secret:</span>
                        <span className="font-mono text-xs">{visibleCredentials.get(connection.id)?.apiSecret}</span>
                      </div>
                    )}
                    {visibleCredentials.has(connection.id) && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        Credentials will auto-hide in 30 seconds
                      </p>
                    )}
                  </div>
                )}
                
                {connection.sync_error && (
                  <p className="text-red-500 text-xs">{connection.sync_error}</p>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                {connection.connection_type === 'API' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openSyncModal(connection)}
                    disabled={isSyncing === connection.id}
                  >
                    {isSyncing === connection.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <FolderSync className="w-4 h-4 mr-1" />
                    )}
                    Sync to Portfolio
                  </Button>
                )}
                {connection.connection_type !== 'API' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => updateConnectionStatus(connection.id, 'syncing')}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Sync
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDisconnect(connection.id, connection.provider_name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {connections.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Link2 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-1">No brokers connected</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Connect your trading accounts to automatically sync your holdings
              </p>
              <Button onClick={() => setIsConnectModalOpen(true)}>
                Connect Your First Broker
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Brokers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {providers.filter(p => p.is_enabled).map(provider => (
              <button
                key={provider.id}
                onClick={() => {
                  setSelectedProvider(provider);
                  setIsConnectModalOpen(true);
                }}
                className="p-4 rounded-lg border border-border hover:border-primary transition-colors text-center group"
              >
                <div className="text-sm font-medium text-foreground group-hover:text-primary">
                  {provider.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{provider.type}</div>
                <div className="flex gap-1 justify-center mt-2">
                  {provider.supports_api && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">API</span>
                  )}
                  {provider.supports_csv && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">CSV</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Re-authentication dialog for viewing sensitive credentials */}
      <ReauthenticationDialog
        open={showReauthDialog}
        onOpenChange={setShowReauthDialog}
        onSuccess={handleReauthSuccess}
        title="Verify to View API Credentials"
        description="For your security, please re-enter your password to view your brokerage API credentials."
      />

      {/* Sync to Portfolio Modal */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sync {syncConnection?.provider_name} to Portfolio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Select a portfolio to sync your broker positions to, or create a new one.
            </p>
            
            {portfolios.length > 0 && (
              <div>
                <Label>Select Existing Portfolio</Label>
                <Select value={syncPortfolioId} onValueChange={setSyncPortfolioId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a portfolio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map(portfolio => (
                      <SelectItem key={portfolio.id} value={portfolio.id}>
                        {portfolio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  className="w-full mt-3"
                  onClick={() => syncConnection && handleSync(syncConnection, syncPortfolioId)}
                  disabled={!syncPortfolioId || isSyncing !== null}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <FolderSync className="w-4 h-4 mr-2" />
                      Sync to Selected Portfolio
                    </>
                  )}
                </Button>
              </div>
            )}
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or create new</span>
              </div>
            </div>
            
            <div>
              <Label>New Portfolio Name</Label>
              <Input
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                placeholder={`${syncConnection?.provider_name} Portfolio`}
                className="mt-1"
              />
              <Button 
                variant="outline"
                className="w-full mt-3"
                onClick={handleCreateAndSync}
                disabled={!newPortfolioName.trim() || isSyncing !== null}
              >
                Create & Sync
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
