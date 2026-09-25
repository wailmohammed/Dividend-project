import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAdminUsers, AdminUser } from '../hooks/useAdminUsers';
import { useBrokerConnections } from '../hooks/useBrokerConnections';
import { useUserRole, AppRole } from '../hooks/useUserRole';
import { useAuditLogs, AuditLog } from '../hooks/useAuditLogs';
import { useTwilioSettings } from '../hooks/useTwilioSettings';
import { useRateLimiter } from '../hooks/useRateLimiter';
import { useServerRateLimiter } from '../hooks/useServerRateLimiter';
import { Shield, Trash2, Plus, X, Wallet, Users, DollarSign, Crown, LayoutGrid, Lock, Link as LinkIcon, TrendingUp, UserPlus, Settings2, Database, Activity, Server, Globe, FileText, Mail, Clock, User, Phone, MessageSquare, AlertTriangle, Key } from 'lucide-react';
import EmailTemplateManager from './EmailTemplateManager';
import ScheduledSyncManager from './ScheduledSyncManager';
import { MarketSyncDashboard } from './MarketSyncDashboard';
import { AdminSecuritySettings } from './AdminSecuritySettings';
import { PaymentGatewaySettings } from './PaymentGatewaySettings';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { CryptoWallet, PlanTier, SubscriptionPlan } from '../types';
import { Switch } from './ui/switch';

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'Free',
    name: 'Starter',
    price: 0,
    description: 'Essential tracking for beginners.',
    limits: { portfolios: 1, holdings: 15, connections: 0, watchlists: 1 },
    features: ['1 Portfolio', 'Up to 15 Holdings', '1 Watchlist', 'Basic Dividend Tracking']
  },
  {
    id: 'Pro',
    name: 'Investor',
    price: 15,
    isPopular: true,
    description: 'Automated analytics for growing portfolios.',
    limits: { portfolios: 3, holdings: -1, connections: 5, watchlists: 3 },
    features: ['3 Portfolios', 'Unlimited Holdings', '5 Broker Connections', '3 Watchlists', 'Dividend Calendar', 'Future Wealth Projection']
  },
  {
    id: 'Ultimate',
    name: 'Wealth Master',
    price: 30,
    description: 'Complete ecosystem for serious investors.',
    limits: { portfolios: -1, holdings: -1, connections: -1, watchlists: -1 },
    features: ['Unlimited Portfolios', 'Unlimited Broker Connections', 'Unlimited Watchlists', 'AI Insights', 'VIP Support']
  }
];

const AdminView: React.FC = () => {
  const { user: currentUser, wallets, addWallet, removeWallet, toggleWallet, plans: contextPlans, updatePlanPrice } = useAuth();
  const { role, isSuperAdmin } = useUserRole(currentUser?.id);
  const { users, loading: usersLoading, updateUserRole, deleteUser, updateUserPlan, refetch: refetchUsers } = useAdminUsers();
  const { providers } = useBrokerConnections();
  const { logs: auditLogs, loading: logsLoading, refetch: refetchLogs } = useAuditLogs();
  const { settings: twilioSettings, loading: twilioLoading, toggleSmsNotifications, refetch: refetchTwilio } = useTwilioSettings();
  
  // Client-side rate limiter for immediate UI feedback
  const userCreationLimiter = useRateLimiter({
    maxAttempts: 3,
    windowMs: 5 * 60 * 1000, // 5 minutes
    cooldownMs: 2 * 60 * 1000 // 2 minutes cooldown
  });
  
  // Server-side rate limiter for secure enforcement
  const { checkRateLimit: checkServerRateLimit, isChecking: isCheckingRateLimit } = useServerRateLimiter();

  const [activeTab, setActiveTab] = useState<'overview' | 'payment' | 'users' | 'plans' | 'brokerage' | 'system' | 'audit' | 'security'>('overview');
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [isAddBrokerModalOpen, setIsAddBrokerModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // New Wallet Form State
  const [newCoin, setNewCoin] = useState('');
  const [newNetwork, setNewNetwork] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('admin');

  // System settings state (super admin only)
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [emailVerification, setEmailVerification] = useState(false);
  const [isTwilioModalOpen, setIsTwilioModalOpen] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');

  const plans = contextPlans.length > 0 ? contextPlans : DEFAULT_PLANS;

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    addWallet({
      coin: newCoin,
      network: newNetwork,
      address: newAddress,
      isEnabled: true
    });
    toast.success('Wallet added successfully');
    setIsAddWalletModalOpen(false);
    setNewCoin('');
    setNewNetwork('');
    setNewAddress('');
  };

  const sendAdminNotification = async (
    type: 'role_change' | 'plan_upgrade' | 'user_deletion' | 'admin_action',
    targetUserId: string,
    details: Record<string, any>
  ) => {
    try {
      await supabase.functions.invoke('admin-notifications', {
        body: {
          type,
          targetUserId,
          adminUserId: currentUser?.id,
          details
        }
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: AppRole) => {
    const targetUser = users.find(u => u.id === userId);
    const oldRole = targetUser?.role || 'user';
    
    try {
      await updateUserRole(userId, newRole);
      await sendAdminNotification('role_change', userId, { oldRole, newRole });
      toast.success('User role updated and notification sent');
      refetchLogs();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!confirm(`Are you sure you want to delete ${targetUser?.email || 'this user'}?`)) return;
    
    try {
      await sendAdminNotification('user_deletion', userId, { 
        deletedEmail: targetUser?.email,
        deletedName: targetUser?.full_name 
      });
      await deleteUser(userId);
      toast.success('User deleted');
      refetchLogs();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleUpdatePlan = async (userId: string, plan: string) => {
    const targetUser = users.find(u => u.id === userId);
    const oldPlan = targetUser?.plan || 'Free';
    
    try {
      await updateUserPlan(userId, plan);
      await sendAdminNotification('plan_upgrade', userId, { oldPlan, newPlan: plan });
      toast.success('User plan updated and notification sent');
      refetchLogs();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update plan');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error('Only super admins can create new users');
      return;
    }

    // Check client-side rate limit first for immediate feedback
    const clientRateLimitCheck = userCreationLimiter.checkAndIncrement();
    if (!clientRateLimitCheck.allowed) {
      toast.error(clientRateLimitCheck.message || 'Rate limit exceeded');
      return;
    }

    setIsCreatingUser(true);
    
    try {
      // Check server-side rate limit for secure enforcement
      const serverRateLimitCheck = await checkServerRateLimit({
        actionType: 'admin_user_creation',
        maxAttempts: 3,
        windowSeconds: 300, // 5 minutes
        cooldownSeconds: 120 // 2 minutes
      });
      
      if (!serverRateLimitCheck.allowed) {
        const cooldown = serverRateLimitCheck.cooldownRemaining || 120;
        toast.error(`Server rate limit: Please wait ${cooldown} seconds before creating another user.`);
        setIsCreatingUser(false);
        return;
      }

      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserFullName
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Poll for profile creation with retry logic instead of fixed timeout
        let profileCreated = false;
        const maxAttempts = 10;
        const retryDelay = 500;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authData.user.id)
            .maybeSingle();
          
          if (profile) {
            profileCreated = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        if (!profileCreated) {
          throw new Error('Profile creation timed out. Please try again.');
        }
        
        // Update user role
        await updateUserRole(authData.user.id, newUserRole);
        
        // Send notification
        await sendAdminNotification('admin_action', authData.user.id, {
          action: 'user_created',
          createdEmail: newUserEmail,
          assignedRole: newUserRole
        });

        toast.success(`User ${newUserEmail} created with ${newUserRole} role`);
        setIsCreateUserModalOpen(false);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserFullName('');
        setNewUserRole('admin');
        refetchUsers();
        refetchLogs();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'role_change': 'Role Changed',
      'plan_upgrade': 'Plan Updated',
      'user_deletion': 'User Deleted',
      'admin_action': 'Admin Action'
    };
    return labels[actionType] || actionType;
  };

  const getActionTypeColor = (actionType: string) => {
    const colors: Record<string, string> = {
      'role_change': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'plan_upgrade': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'user_deletion': 'bg-red-500/10 text-red-500 border-red-500/20',
      'admin_action': 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    };
    return colors[actionType] || 'bg-muted text-muted-foreground';
  };

  // Stats calculations
  const totalRevenue = users.reduce((acc, curr) => acc + (plans.find(p => p.id === curr.plan)?.price || 0), 0);
  const paidUsers = users.filter(u => u.plan !== 'Free').length;
  const adminCount = users.filter(u => u.role === 'admin' || u.role === 'super_admin').length;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            {isSuperAdmin ? <Crown className="w-8 h-8 text-amber-400" /> : <Shield className="w-8 h-8 text-primary" />}
            {isSuperAdmin ? 'Super Admin Control Center' : 'Admin Dashboard'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSuperAdmin
              ? 'Full system access: Manage Users, Brokerage Hub, Payment Systems, and System Settings.'
              : 'Manage Users and Projects. Payment and System settings are restricted.'}
          </p>
        </div>
        <div className="flex gap-1 bg-card p-1 rounded-lg border border-border overflow-x-auto">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'overview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <LayoutGrid className="w-4 h-4" /> Overview
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Users className="w-4 h-4" /> Users
          </button>
          <button onClick={() => setActiveTab('brokerage')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'brokerage' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <LinkIcon className="w-4 h-4" /> Brokerage Hub
          </button>
          <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'audit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <FileText className="w-4 h-4" /> Audit Logs
          </button>
          {isSuperAdmin && (
            <>
              <button onClick={() => setActiveTab('security')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'security' ? 'bg-red-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                <Key className="w-4 h-4" /> Security
              </button>
              <button onClick={() => setActiveTab('payment')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'payment' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Wallet className="w-4 h-4" /> Payment System
              </button>
              <button onClick={() => setActiveTab('plans')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'plans' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <DollarSign className="w-4 h-4" /> Plans
              </button>
              <button onClick={() => setActiveTab('system')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'system' ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                <Settings2 className="w-4 h-4" /> System
              </button>
            </>
          )}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-foreground">{users.length}</div>
                <div className="text-emerald-500 text-sm mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Active users
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-foreground">{paidUsers}</div>
                {isSuperAdmin ? (
                  <div className="text-primary text-sm mt-2">
                    ${totalRevenue} / mo revenue
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Revenue hidden
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Brokerage Integrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-emerald-500">{providers.length}</div>
                <div className="text-muted-foreground text-sm mt-2">Providers active</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Administrators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-amber-500">{adminCount}</div>
                <div className="text-muted-foreground text-sm mt-2">Admin accounts</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" onClick={() => setActiveTab('users')} className="h-auto py-4 flex flex-col gap-2">
                <UserPlus className="w-6 h-6" />
                <span>Manage Users</span>
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('brokerage')} className="h-auto py-4 flex flex-col gap-2">
                <LinkIcon className="w-6 h-6" />
                <span>Brokerage Hub</span>
              </Button>
              {isSuperAdmin && (
                <>
                  <Button variant="outline" onClick={() => setActiveTab('payment')} className="h-auto py-4 flex flex-col gap-2">
                    <Wallet className="w-6 h-6" />
                    <span>Payment System</span>
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('system')} className="h-auto py-4 flex flex-col gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                    <Settings2 className="w-6 h-6" />
                    <span>System Settings</span>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Users */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
              <CardDescription>Latest registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground ${u.role === 'super_admin' ? 'bg-amber-600' : u.role === 'admin' ? 'bg-primary' : 'bg-muted-foreground'}`}>
                        {(u.full_name || u.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{u.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${u.plan === 'Pro' ? 'bg-primary/10 text-primary' : u.plan === 'Ultimate' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                        {u.plan || 'Free'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BROKERAGE HUB TAB */}
      {activeTab === 'brokerage' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" /> Brokerage Hub
              </CardTitle>
              <p className="text-xs text-muted-foreground">Configure supported financial institutions.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map(provider => (
                <div key={provider.id} className="bg-muted/50 border border-border p-4 rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center font-bold text-foreground">
                      {provider.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-foreground text-sm">{provider.name}</div>
                      <div className="text-xs text-muted-foreground">{provider.type}</div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold border ${provider.is_enabled ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-red-500/30 text-red-500 bg-red-500/10'}`}>
                    {provider.is_enabled ? 'Active' : 'Disabled'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* PAYMENT GATEWAY TAB (SUPER ADMIN ONLY) */}
      {activeTab === 'payment' && isSuperAdmin && (
        <PaymentGatewaySettings />
      )}
      {/* USERS TAB */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <div className="text-xs text-muted-foreground italic">
                {isSuperAdmin ? 'Full Access' : 'Restricted Access (Cannot modify Super Admins)'}
              </div>
            </div>
            {isSuperAdmin && (
              <Button onClick={() => setIsCreateUserModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" /> Create Admin User
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground uppercase text-xs font-bold">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Plan</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground ${u.role === 'super_admin' ? 'bg-amber-600' : u.role === 'admin' ? 'bg-primary' : 'bg-muted-foreground'}`}>
                              {(u.full_name || u.email || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{u.full_name || 'Unknown'}</div>
                              <div className="text-muted-foreground text-xs">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={u.role}
                            onValueChange={(value: AppRole) => handleUpdateUserRole(u.id, value)}
                            disabled={u.id === currentUser?.id || (!isSuperAdmin && u.role === 'super_admin')}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={u.plan || 'Free'}
                            onValueChange={(value) => handleUpdatePlan(u.id, value)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Free">Free</SelectItem>
                              <SelectItem value="Pro">Pro</SelectItem>
                              <SelectItem value="Ultimate">Ultimate</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {u.id !== currentUser?.id && (isSuperAdmin || u.role === 'user') && (
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(u.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'audit' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Audit Logs
              </CardTitle>
              <CardDescription>Track all administrative actions and system changes</CardDescription>
            </div>
            <Button variant="outline" onClick={() => refetchLogs()}>
              <Activity className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No audit logs yet</p>
                <p className="text-xs mt-1">Actions like role changes, plan updates, and user deletions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {auditLogs.map((log) => {
                  const adminUser = users.find(u => u.id === log.user_id);
                  const targetUser = log.target_id ? users.find(u => u.id === log.target_id) : null;
                  
                  return (
                    <div key={log.id} className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {log.action_type === 'role_change' && <Shield className="w-5 h-5 text-blue-500" />}
                            {log.action_type === 'plan_upgrade' && <DollarSign className="w-5 h-5 text-emerald-500" />}
                            {log.action_type === 'user_deletion' && <Trash2 className="w-5 h-5 text-red-500" />}
                            {log.action_type === 'admin_action' && <Settings2 className="w-5 h-5 text-amber-500" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getActionTypeColor(log.action_type)}`}>
                                {getActionTypeLabel(log.action_type)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                by {adminUser?.email || 'Unknown Admin'}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              {log.action_type === 'role_change' && (
                                <>
                                  Changed role for <strong>{log.details?.target_email || targetUser?.email || 'user'}</strong> from{' '}
                                  <span className="text-muted-foreground">{log.details?.oldRole}</span> to{' '}
                                  <span className="text-primary font-medium">{log.details?.newRole}</span>
                                </>
                              )}
                              {log.action_type === 'plan_upgrade' && (
                                <>
                                  Updated plan for <strong>{log.details?.target_email || targetUser?.email || 'user'}</strong> from{' '}
                                  <span className="text-muted-foreground">{log.details?.oldPlan}</span> to{' '}
                                  <span className="text-emerald-500 font-medium">{log.details?.newPlan}</span>
                                </>
                              )}
                              {log.action_type === 'user_deletion' && (
                                <>
                                  Deleted user: <strong className="text-red-500">{log.details?.deletedEmail}</strong>
                                  {log.details?.deletedName && <span className="text-muted-foreground"> ({log.details.deletedName})</span>}
                                </>
                              )}
                              {log.action_type === 'admin_action' && (
                                <>
                                  {log.details?.action === 'user_created' ? (
                                    <>
                                      Created new user: <strong>{log.details?.createdEmail}</strong> with role{' '}
                                      <span className="text-amber-500 font-medium">{log.details?.assignedRole}</span>
                                    </>
                                  ) : (
                                    <>{log.details?.action || 'Admin action performed'}</>
                                  )}
                                </>
                              )}
                            </div>
                            {log.ip_address && (
                              <div className="text-xs text-muted-foreground mt-1">
                                IP: {log.ip_address}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PLANS TAB */}
      {activeTab === 'plans' && isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <Card key={plan.id} className={plan.isPopular ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {plan.isPopular && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Popular</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold text-foreground">
                  ${plan.price}<span className="text-sm text-muted-foreground font-normal">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="pt-4">
                  <Label>Update Price</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="number"
                      defaultValue={plan.price}
                      min={0}
                      className="w-24"
                      onBlur={(e) => updatePlanPrice(plan.id, Number(e.target.value))}
                    />
                    <span className="text-muted-foreground self-center">USD/month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SYSTEM TAB (SUPER ADMIN ONLY) */}
      {activeTab === 'system' && isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-500" /> System Status
              </CardTitle>
              <CardDescription>Platform health and performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="font-medium text-foreground">All Systems Operational</span>
                </div>
                <span className="text-xs text-muted-foreground">99.9% uptime</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{users.length}</div>
                  <div className="text-xs text-muted-foreground">Registered Users</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{providers.length}</div>
                  <div className="text-xs text-muted-foreground">Active Integrations</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" /> Access Control
              </CardTitle>
              <CardDescription>Manage system access and security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Maintenance Mode</div>
                  <div className="text-xs text-muted-foreground">Disable access for non-admins</div>
                </div>
                <Switch 
                  checked={maintenanceMode} 
                  onCheckedChange={(checked) => {
                    setMaintenanceMode(checked);
                    toast.success(checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
                  }} 
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium text-foreground">User Registration</div>
                  <div className="text-xs text-muted-foreground">Allow new user signups</div>
                </div>
                <Switch 
                  checked={registrationEnabled} 
                  onCheckedChange={(checked) => {
                    setRegistrationEnabled(checked);
                    toast.success(checked ? 'Registration enabled' : 'Registration disabled');
                  }} 
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium text-foreground">Email Verification</div>
                  <div className="text-xs text-muted-foreground">Require email confirmation</div>
                </div>
                <Switch 
                  checked={emailVerification} 
                  onCheckedChange={(checked) => {
                    setEmailVerification(checked);
                    toast.success(checked ? 'Email verification enabled' : 'Email verification disabled');
                  }} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" /> Database Management
              </CardTitle>
              <CardDescription>Data and storage operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                  <Database className="w-5 h-5" />
                  <span className="text-xs">Export Data</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex flex-col gap-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-xs">View Logs</span>
                </Button>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Storage Used</span>
                  <span className="text-xs font-mono text-foreground">2.4 GB / 10 GB</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '24%' }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API & Integrations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" /> API & Integrations
              </CardTitle>
              <CardDescription>External service connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded flex items-center justify-center">
                      <Database className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">Lovable Cloud</div>
                      <div className="text-xs text-muted-foreground">Database & Auth</div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded-full">Connected</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/10 rounded flex items-center justify-center">
                      <Activity className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">Market Data API</div>
                      <div className="text-xs text-muted-foreground">Real-time prices</div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs rounded-full">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMS Notifications (Twilio) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-500" /> SMS Notifications (Twilio)
              </CardTitle>
              <CardDescription>Configure Twilio for SMS notifications (2FA events, security alerts)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${twilioSettings.isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div>
                      <div className="font-medium text-foreground">Twilio Status</div>
                      <div className="text-xs text-muted-foreground">
                        {twilioSettings.isConfigured ? 'Configured and ready' : 'Not configured'}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${twilioSettings.isConfigured ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {twilioSettings.isConfigured ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="font-medium text-foreground">SMS Notifications</div>
                    <div className="text-xs text-muted-foreground">Enable SMS for 2FA events</div>
                  </div>
                  <Switch 
                    checked={twilioSettings.isEnabled}
                    disabled={!twilioSettings.isConfigured}
                    onCheckedChange={async (checked) => {
                      const success = await toggleSmsNotifications(checked);
                      if (success) {
                        toast.success(checked ? 'SMS notifications enabled' : 'SMS notifications disabled');
                      } else {
                        toast.error('Failed to toggle SMS notifications');
                      }
                    }}
                  />
                </div>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-foreground">Twilio Credentials</div>
                    <div className="text-xs text-muted-foreground">
                      {twilioSettings.isConfigured 
                        ? `From: ${twilioSettings.phoneNumber || 'Not set'}` 
                        : 'Configure your Twilio account to enable SMS'}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsTwilioModalOpen(true)}
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    {twilioSettings.isConfigured ? 'Update' : 'Configure'}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground bg-background/50 p-3 rounded border border-border">
                  <strong>Note:</strong> You need a Twilio account. Get credentials from{' '}
                  <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    console.twilio.com
                  </a>
                </div>
              </div>

              {/* Test SMS Section */}
              {twilioSettings.isConfigured && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="font-medium text-foreground mb-2">Send Test SMS</div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="+1234567890"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      disabled={!testPhoneNumber || isSendingTestSms}
                      onClick={async () => {
                        setIsSendingTestSms(true);
                        try {
                          const { error } = await supabase.functions.invoke('notifications', {
                            body: {
                              action: 'send_test_sms',
                              phoneNumber: testPhoneNumber
                            }
                          });
                          if (error) throw error;
                          toast.success('Test SMS sent successfully!');
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to send test SMS');
                        } finally {
                          setIsSendingTestSms(false);
                        }
                      }}
                    >
                      {isSendingTestSms ? 'Sending...' : 'Send Test'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter a phone number to receive a test SMS notification
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduled Sync Manager */}
          <div className="lg:col-span-2">
            <ScheduledSyncManager />
          </div>

          {/* Market Sync Dashboard */}
          <div className="lg:col-span-2">
            <MarketSyncDashboard />
          </div>

          {/* Email Template Manager */}
          <div className="lg:col-span-2">
            <EmailTemplateManager />
          </div>
        </div>
      )}

      {/* SECURITY TAB (SUPER ADMIN ONLY) */}
      {activeTab === 'security' && isSuperAdmin && (
        <AdminSecuritySettings />
      )}


      {/* Twilio Configuration Modal */}
      <Dialog open={isTwilioModalOpen} onOpenChange={setIsTwilioModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" /> Configure Twilio SMS
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setIsSavingTwilio(true);
            try {
              const { error } = await supabase.functions.invoke('notifications', {
                body: {
                  action: 'configure_twilio',
                  accountSid: twilioAccountSid,
                  authToken: twilioAuthToken,
                  phoneNumber: twilioPhoneNumber
                }
              });
              
              if (error) throw error;
              
              toast.success('Twilio configured successfully');
              setIsTwilioModalOpen(false);
              setTwilioAccountSid('');
              setTwilioAuthToken('');
              setTwilioPhoneNumber('');
              refetchTwilio();
            } catch (err: any) {
              toast.error(err.message || 'Failed to configure Twilio');
            } finally {
              setIsSavingTwilio(false);
            }
          }} className="space-y-4">
            <div>
              <Label>Account SID</Label>
              <Input 
                value={twilioAccountSid} 
                onChange={(e) => setTwilioAccountSid(e.target.value)} 
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                required 
              />
            </div>
            <div>
              <Label>Auth Token</Label>
              <Input 
                type="password"
                value={twilioAuthToken} 
                onChange={(e) => setTwilioAuthToken(e.target.value)} 
                placeholder="Your Twilio auth token" 
                required 
              />
            </div>
            <div>
              <Label>Phone Number (From)</Label>
              <Input 
                value={twilioPhoneNumber} 
                onChange={(e) => setTwilioPhoneNumber(e.target.value)} 
                placeholder="+1234567890" 
                required 
              />
              <p className="text-xs text-muted-foreground mt-1">The Twilio phone number to send SMS from</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Security:</strong> These credentials will be stored securely. Only super admins can view or modify them.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isSavingTwilio}>
              {isSavingTwilio ? 'Saving...' : 'Save Configuration'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Wallet Modal */}
      <Dialog open={isAddWalletModalOpen} onOpenChange={setIsAddWalletModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Crypto Wallet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddWallet} className="space-y-4">
            <div>
              <Label>Coin</Label>
              <Input value={newCoin} onChange={(e) => setNewCoin(e.target.value)} placeholder="e.g., Bitcoin" required />
            </div>
            <div>
              <Label>Network</Label>
              <Input value={newNetwork} onChange={(e) => setNewNetwork(e.target.value)} placeholder="e.g., ERC20" required />
            </div>
            <div>
              <Label>Wallet Address</Label>
              <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="0x..." required />
            </div>
            <Button type="submit" className="w-full">Add Wallet</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create User Modal (Super Admin Only) */}
      <Dialog open={isCreateUserModalOpen} onOpenChange={setIsCreateUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Create Admin User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input 
                value={newUserFullName} 
                onChange={(e) => setNewUserFullName(e.target.value)} 
                placeholder="John Doe" 
                required 
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email"
                value={newUserEmail} 
                onChange={(e) => setNewUserEmail(e.target.value)} 
                placeholder="admin@example.com" 
                required 
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input 
                type="password"
                value={newUserPassword} 
                onChange={(e) => setNewUserPassword(e.target.value)} 
                placeholder="Minimum 6 characters" 
                minLength={6}
                required 
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newUserRole} onValueChange={(value: AppRole) => setNewUserRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userCreationLimiter.isLimited && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <p className="text-xs text-destructive">
                  Rate limit reached. Please wait {userCreationLimiter.cooldownRemaining} seconds before creating another user.
                </p>
              </div>
            )}
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Note:</strong> The new user will receive an email confirmation link. They must verify their email before logging in.
                {!userCreationLimiter.isLimited && userCreationLimiter.remainingAttempts < 3 && (
                  <span className="block mt-1">
                    Remaining attempts: {userCreationLimiter.remainingAttempts}
                  </span>
                )}
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isCreatingUser || isCheckingRateLimit || userCreationLimiter.isLimited}>
              {isCheckingRateLimit ? 'Checking limits...' : isCreatingUser ? 'Creating User...' : 'Create User'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminView;
