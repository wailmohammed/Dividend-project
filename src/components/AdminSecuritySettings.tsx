import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertTriangle, Settings2, Users, Key, Clock, Mail, Bell, Save, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useUserRole, AppRole } from '@/hooks/useUserRole';

interface TwoFAConfig {
  adminRequires2FA: boolean;
  superAdminRequires2FA: boolean;
  gracePeriodDays: number;
  isEnforced: boolean; // Master switch - false during development
}

interface RateLimitConfig {
  userCreationMaxAttempts: number;
  userCreationWindowMinutes: number;
  userCreationCooldownMinutes: number;
  emailNotificationsEnabled: boolean;
  notifyOnLimitExceeded: boolean;
}

interface AdminWith2FAStatus {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  requires_2fa: boolean;
  enforce_2fa_after: string | null;
  has_2fa_enabled: boolean;
}

export const AdminSecuritySettings: React.FC = () => {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole(user?.id);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 2FA Configuration (Development mode = not enforced)
  const [twoFAConfig, setTwoFAConfig] = useState<TwoFAConfig>({
    adminRequires2FA: true,
    superAdminRequires2FA: true,
    gracePeriodDays: 7,
    isEnforced: false // Default to OFF during development
  });
  
  // Rate Limit Configuration
  const [rateLimitConfig, setRateLimitConfig] = useState<RateLimitConfig>({
    userCreationMaxAttempts: 3,
    userCreationWindowMinutes: 5,
    userCreationCooldownMinutes: 2,
    emailNotificationsEnabled: true,
    notifyOnLimitExceeded: true
  });
  
  // Admin users with 2FA status
  const [adminUsers, setAdminUsers] = useState<AdminWith2FAStatus[]>([]);
  
  useEffect(() => {
    fetchSecuritySettings();
    fetchAdminUsers();
  }, []);
  
  const fetchSecuritySettings = async () => {
    try {
      // Fetch 2FA settings from system_settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'security_2fa_admin_required',
          'security_2fa_super_admin_required', 
          'security_2fa_grace_period_days',
          'security_2fa_enforced',
          'security_rate_limit_max_attempts',
          'security_rate_limit_window_minutes',
          'security_rate_limit_cooldown_minutes',
          'security_rate_limit_email_notifications',
          'security_rate_limit_notify_exceeded'
        ]);
      
      if (settings) {
        const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
        
        setTwoFAConfig({
          adminRequires2FA: settingsMap['security_2fa_admin_required'] === 'true',
          superAdminRequires2FA: settingsMap['security_2fa_super_admin_required'] === 'true',
          gracePeriodDays: parseInt(settingsMap['security_2fa_grace_period_days'] || '7'),
          isEnforced: settingsMap['security_2fa_enforced'] === 'true'
        });
        
        setRateLimitConfig({
          userCreationMaxAttempts: parseInt(settingsMap['security_rate_limit_max_attempts'] || '3'),
          userCreationWindowMinutes: parseInt(settingsMap['security_rate_limit_window_minutes'] || '5'),
          userCreationCooldownMinutes: parseInt(settingsMap['security_rate_limit_cooldown_minutes'] || '2'),
          emailNotificationsEnabled: settingsMap['security_rate_limit_email_notifications'] !== 'false',
          notifyOnLimitExceeded: settingsMap['security_rate_limit_notify_exceeded'] !== 'false'
        });
      }
    } catch (err) {
      console.error('Failed to fetch security settings:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAdminUsers = async () => {
    try {
      // Fetch admins with their 2FA status
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role, requires_2fa, enforce_2fa_after')
        .in('role', ['admin', 'super_admin']);
      
      if (!roles || roles.length === 0) {
        setAdminUsers([]);
        return;
      }
      
      const userIds = roles.map(r => r.user_id);
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      
      // Fetch 2FA status
      const { data: twoFAStatus } = await supabase
        .from('two_factor_auth')
        .select('user_id, is_enabled')
        .in('user_id', userIds);
      
      const adminList: AdminWith2FAStatus[] = roles.map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        const twoFA = twoFAStatus?.find(t => t.user_id === role.user_id);
        
        return {
          id: role.user_id,
          email: profile?.email || null,
          full_name: profile?.full_name || null,
          role: role.role as AppRole,
          requires_2fa: role.requires_2fa || false,
          enforce_2fa_after: role.enforce_2fa_after,
          has_2fa_enabled: twoFA?.is_enabled || false
        };
      });
      
      setAdminUsers(adminList);
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
  };
  
  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsToSave = [
        { key: 'security_2fa_admin_required', value: String(twoFAConfig.adminRequires2FA) },
        { key: 'security_2fa_super_admin_required', value: String(twoFAConfig.superAdminRequires2FA) },
        { key: 'security_2fa_grace_period_days', value: String(twoFAConfig.gracePeriodDays) },
        { key: 'security_2fa_enforced', value: String(twoFAConfig.isEnforced) },
        { key: 'security_rate_limit_max_attempts', value: String(rateLimitConfig.userCreationMaxAttempts) },
        { key: 'security_rate_limit_window_minutes', value: String(rateLimitConfig.userCreationWindowMinutes) },
        { key: 'security_rate_limit_cooldown_minutes', value: String(rateLimitConfig.userCreationCooldownMinutes) },
        { key: 'security_rate_limit_email_notifications', value: String(rateLimitConfig.emailNotificationsEnabled) },
        { key: 'security_rate_limit_notify_exceeded', value: String(rateLimitConfig.notifyOnLimitExceeded) }
      ];
      
      for (const setting of settingsToSave) {
        const { data: existing } = await supabase
          .from('system_settings')
          .select('id')
          .eq('key', setting.key)
          .maybeSingle();
        
        if (existing) {
          await supabase
            .from('system_settings')
            .update({ value: setting.value })
            .eq('key', setting.key);
        } else {
          await supabase
            .from('system_settings')
            .insert({ key: setting.key, value: setting.value });
        }
      }
      
      // Update user_roles for 2FA requirements if enforcement is enabled
      if (twoFAConfig.isEnforced) {
        const gracePeriodDate = new Date();
        gracePeriodDate.setDate(gracePeriodDate.getDate() + twoFAConfig.gracePeriodDays);
        
        if (twoFAConfig.adminRequires2FA) {
          await supabase
            .from('user_roles')
            .update({ 
              requires_2fa: true,
              enforce_2fa_after: gracePeriodDate.toISOString()
            })
            .eq('role', 'admin');
        }
        
        if (twoFAConfig.superAdminRequires2FA) {
          await supabase
            .from('user_roles')
            .update({ 
              requires_2fa: true,
              enforce_2fa_after: gracePeriodDate.toISOString()
            })
            .eq('role', 'super_admin');
        }
      }
      
      toast.success('Security settings saved successfully');
      fetchAdminUsers(); // Refresh admin list
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  const toggleUserRequire2FA = async (userId: string, require: boolean) => {
    try {
      const gracePeriodDate = new Date();
      gracePeriodDate.setDate(gracePeriodDate.getDate() + twoFAConfig.gracePeriodDays);
      
      await supabase
        .from('user_roles')
        .update({ 
          requires_2fa: require,
          enforce_2fa_after: require ? gracePeriodDate.toISOString() : null
        })
        .eq('user_id', userId);
      
      toast.success(require ? '2FA requirement enabled for user' : '2FA requirement disabled for user');
      fetchAdminUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Only super admins can access security settings.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-500" />
            Security Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure 2FA enforcement and rate limiting for admin accounts
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
      
      {/* 2FA Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Configure 2FA requirements for administrative accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Enforcement Switch */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div>
                  <div className="font-medium text-foreground">Enforce 2FA Requirements</div>
                  <div className="text-xs text-muted-foreground">
                    {twoFAConfig.isEnforced 
                      ? 'Active: Admins must set up 2FA within the grace period'
                      : 'Inactive: 2FA is optional (development mode)'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={twoFAConfig.isEnforced ? "default" : "secondary"}>
                  {twoFAConfig.isEnforced ? 'Production' : 'Development'}
                </Badge>
                <Switch
                  checked={twoFAConfig.isEnforced}
                  onCheckedChange={(checked) => setTwoFAConfig(prev => ({ ...prev, isEnforced: checked }))}
                />
              </div>
            </div>
          </div>
          
          {/* Role Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium text-foreground">Require 2FA for Admins</div>
                <div className="text-xs text-muted-foreground">All admin accounts must have 2FA enabled</div>
              </div>
              <Switch
                checked={twoFAConfig.adminRequires2FA}
                onCheckedChange={(checked) => setTwoFAConfig(prev => ({ ...prev, adminRequires2FA: checked }))}
                disabled={!twoFAConfig.isEnforced}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium text-foreground">Require 2FA for Super Admins</div>
                <div className="text-xs text-muted-foreground">All super admin accounts must have 2FA enabled</div>
              </div>
              <Switch
                checked={twoFAConfig.superAdminRequires2FA}
                onCheckedChange={(checked) => setTwoFAConfig(prev => ({ ...prev, superAdminRequires2FA: checked }))}
                disabled={!twoFAConfig.isEnforced}
              />
            </div>
          </div>
          
          {/* Grace Period */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <Label className="text-foreground">Grace Period (Days)</Label>
              <p className="text-xs text-muted-foreground">Time allowed for admins to set up 2FA after requirement is enabled</p>
            </div>
            <Select
              value={String(twoFAConfig.gracePeriodDays)}
              onValueChange={(value) => setTwoFAConfig(prev => ({ ...prev, gracePeriodDays: parseInt(value) }))}
              disabled={!twoFAConfig.isEnforced}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Admin 2FA Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Admin 2FA Status
          </CardTitle>
          <CardDescription>
            View and manage 2FA requirements for individual admin accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No admin users found
            </div>
          ) : (
            <div className="space-y-3">
              {adminUsers.map((admin) => (
                <div 
                  key={admin.id} 
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      admin.role === 'super_admin' ? 'bg-amber-500 text-white' : 'bg-primary text-primary-foreground'
                    }`}>
                      {(admin.full_name || admin.email || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{admin.full_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{admin.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                      {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </Badge>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      admin.has_2fa_enabled 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      <Key className="w-3 h-3" />
                      {admin.has_2fa_enabled ? '2FA Enabled' : '2FA Not Set'}
                    </div>
                    <Switch
                      checked={admin.requires_2fa}
                      onCheckedChange={(checked) => toggleUserRequire2FA(admin.id, checked)}
                      disabled={admin.id === user?.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Rate Limiting Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Rate Limiting & Abuse Prevention
          </CardTitle>
          <CardDescription>
            Configure rate limits for admin actions and email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rate Limit Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <Label className="text-foreground">Max Attempts</Label>
              <p className="text-xs text-muted-foreground mb-2">User creation attempts per window</p>
              <Input
                type="number"
                min={1}
                max={10}
                value={rateLimitConfig.userCreationMaxAttempts}
                onChange={(e) => setRateLimitConfig(prev => ({ 
                  ...prev, 
                  userCreationMaxAttempts: parseInt(e.target.value) || 3 
                }))}
              />
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Label className="text-foreground">Window (Minutes)</Label>
              <p className="text-xs text-muted-foreground mb-2">Time window for rate limiting</p>
              <Input
                type="number"
                min={1}
                max={60}
                value={rateLimitConfig.userCreationWindowMinutes}
                onChange={(e) => setRateLimitConfig(prev => ({ 
                  ...prev, 
                  userCreationWindowMinutes: parseInt(e.target.value) || 5 
                }))}
              />
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <Label className="text-foreground">Cooldown (Minutes)</Label>
              <p className="text-xs text-muted-foreground mb-2">Lockout duration after exceeding limit</p>
              <Input
                type="number"
                min={1}
                max={30}
                value={rateLimitConfig.userCreationCooldownMinutes}
                onChange={(e) => setRateLimitConfig(prev => ({ 
                  ...prev, 
                  userCreationCooldownMinutes: parseInt(e.target.value) || 2 
                }))}
              />
            </div>
          </div>
          
          {/* Email Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-medium text-foreground">Email Notifications</div>
                  <div className="text-xs text-muted-foreground">
                    Enable email alerts for rate limit events
                  </div>
                </div>
              </div>
              <Switch
                checked={rateLimitConfig.emailNotificationsEnabled}
                onCheckedChange={(checked) => setRateLimitConfig(prev => ({ 
                  ...prev, 
                  emailNotificationsEnabled: checked 
                }))}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-500" />
                <div>
                  <div className="font-medium text-foreground">Notify on Limit Exceeded</div>
                  <div className="text-xs text-muted-foreground">
                    Alert super admins when rate limits are triggered
                  </div>
                </div>
              </div>
              <Switch
                checked={rateLimitConfig.notifyOnLimitExceeded}
                onCheckedChange={(checked) => setRateLimitConfig(prev => ({ 
                  ...prev, 
                  notifyOnLimitExceeded: checked 
                }))}
                disabled={!rateLimitConfig.emailNotificationsEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecuritySettings;
