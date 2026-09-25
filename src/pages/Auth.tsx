import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Activity, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { TwoFactorVerification } from '@/components/TwoFactorVerification';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { login, register, isAuthenticated, user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: 'demo@wealthos.com',
    password: 'demo123',
    name: ''
  });

  // 2FA verification state
  const [show2FAVerification, setShow2FAVerification] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<boolean>(false);
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Prevent blank auth screen for authenticated users
  if (isAuthenticated && !show2FAVerification) {
    return <Navigate to="/dashboard" replace />;
  }

  const check2FARequired = async (userId: string): Promise<{ required: boolean; enabled: boolean }> => {
    try {
      // Check if user is admin and requires 2FA
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, requires_2fa, enforce_2fa_after')
        .eq('user_id', userId)
        .maybeSingle();

      // Check if 2FA is enabled for this user
      const { data: twoFAData } = await supabase
        .from('two_factor_auth')
        .select('is_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      const isAdmin = roleData?.role === 'admin' || roleData?.role === 'super_admin';
      const requires2FA = roleData?.requires_2fa ?? false;
      const enforcementDeadline = roleData?.enforce_2fa_after;
      const is2FAEnabled = twoFAData?.is_enabled ?? false;
      
      // Check if enforcement deadline has passed
      const isEnforced = enforcementDeadline ? new Date(enforcementDeadline) <= new Date() : requires2FA;

      return {
        required: isAdmin && requires2FA && isEnforced,
        enabled: is2FAEnabled
      };
    } catch (err) {
      console.error('Error checking 2FA requirement:', err);
      return { required: false, enabled: false };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const success = await login(formData.email, formData.password);
        if (success) {
          // Get current user session to check 2FA requirement
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { required, enabled } = await check2FARequired(session.user.id);
            
            if (required && enabled) {
              // User needs to verify 2FA
              setPendingUserId(session.user.id);
              setPendingSession(true);
              setShow2FAVerification(true);
              setLoading(false);
              return;
            }
            
            if (required && !enabled) {
              // Admin needs 2FA but hasn't set it up - redirect to settings
              toast({
                variant: "destructive",
                title: "2FA Setup Required",
                description: "As an admin, you must enable two-factor authentication. Redirecting to settings...",
              });
              setTimeout(() => {
                navigate('/?view=settings&setup2fa=true');
              }, 2000);
              return;
            }
          }
          
          toast({
            title: "Welcome back!",
            description: "Successfully logged in to WealthOS",
          });
          navigate('/dashboard');
        } else {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: "Invalid credentials. Try demo@wealthos.com with any password.",
          });
        }
      } else {
        const result = await register(formData.name, formData.email, formData.password);
        if (result.success) {
          toast({
            title: "Account created!",
            description: result.message || "Welcome to WealthOS",
          });
          if (!result.message?.includes('check your email')) {
            navigate('/dashboard');
          }
        } else {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: result.message || "Could not create account. Please try again.",
          });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = () => {
    setShow2FAVerification(false);
    setPendingUserId(null);
    setPendingSession(false);
    toast({
      title: "Welcome back!",
      description: "Successfully logged in to WealthOS",
    });
    navigate('/dashboard');
  };

  const handle2FACancel = async () => {
    // Sign out the user if they cancel 2FA verification
    await supabase.auth.signOut();
    setShow2FAVerification(false);
    setPendingUserId(null);
    setPendingSession(false);
    toast({
      variant: "destructive",
      title: "Login cancelled",
      description: "Two-factor authentication is required for admin accounts.",
    });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Email required",
        description: "Please enter your email address.",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send reset email.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* 2FA Verification Modal */}
      {pendingUserId && (
        <TwoFactorVerification
          open={show2FAVerification}
          onOpenChange={setShow2FAVerification}
          userId={pendingUserId}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-card border-border">
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-2">{tr('Reset Password')}</h2>
              <p className="text-muted-foreground text-sm mb-4">
                {tr("Enter your email and we'll send you a reset link.")}
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10 bg-muted/50 border-border"
                    placeholder="Enter your email"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                    }}
                    className="flex-1"
                  >
                    {tr('Cancel')}
                  </Button>
                  <Button type="submit" disabled={resetLoading} className="flex-1">
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {tr('Sending...')}
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur-xl border-border">
        <div className="p-8">
          {/* Logo and Title */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-3 rounded-2xl shadow-2xl shadow-primary/30 mb-4">
              <Activity className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">WealthOS</h1>
            <p className="text-muted-foreground text-sm text-center">
              {tr('Your Investment Command Center')}
            </p>
          </div>

          {/* Auth Toggle */}
          <div className="flex bg-muted/50 p-1 rounded-lg mb-6 border border-border">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr('Sign In')}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr('Sign Up')}
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  {tr('Full Name')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                    placeholder="John Doe"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                {tr('Email Address')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                  placeholder="demo@wealthos.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  {tr('Password')}
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    {tr('Forgot password?')}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6 shadow-lg shadow-primary/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>{isLogin ? 'Sign In' : 'Create Account'}</>
              )}
            </Button>
          </form>

          {/* Demo Notice */}
          <div className="mt-6 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-foreground">
              <span className="font-semibold">{tr('Demo Mode:')}</span> {tr('Use demo@wealthos.com with any password to explore the platform')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
