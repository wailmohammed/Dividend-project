import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, UserRole, PlanTier, CryptoWallet, SubscriptionPlan, BrokerIntegration, BrokerProvider } from '../types';
import { DEFAULT_BROKER_PROVIDERS } from '../constants';

// --- Mock Data for Fallbacks/UI ---
const DEFAULT_WALLETS: CryptoWallet[] = [
  { id: '1', coin: 'Bitcoin', network: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', isEnabled: true },
  { id: '2', coin: 'Ethereum', network: 'ERC20', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', isEnabled: true },
];

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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (name: string, email: string, pass: string) => Promise<{ success: boolean, message?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean, message?: string }>;
  logout: () => void;
  updateUserPlan: (plan: PlanTier) => void;

  brokerProviders: BrokerProvider[];
  addBrokerProvider: (provider: BrokerProvider) => void;
  removeBrokerProvider: (id: string) => void;
  updateBrokerProvider: (id: string, updates: Partial<BrokerProvider>) => void;

  integrations: BrokerIntegration[];
  connectBroker: (providerId: string, name: string, type: 'Stock' | 'Crypto' | 'Mixed', logo: string, credentials: any) => Promise<boolean>;
  disconnectBroker: (id: string) => void;

  wallets: CryptoWallet[];
  addWallet: (wallet: Omit<CryptoWallet, 'id'>) => void;
  removeWallet: (id: string) => void;
  toggleWallet: (id: string) => void;
  updateWallet: (id: string, updates: Partial<CryptoWallet>) => void;
  plans: SubscriptionPlan[];
  updatePlanPrice: (id: PlanTier, price: number) => void;

  allUsers: User[];
  deleteUser: (id: string) => void;
  updateUserRole: (id: string, role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin/Settings State
  const [wallets, setWallets] = useState<CryptoWallet[]>(DEFAULT_WALLETS);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [integrations, setIntegrations] = useState<BrokerIntegration[]>([]);
  const [brokerProviders, setBrokerProviders] = useState<BrokerProvider[]>(DEFAULT_BROKER_PROVIDERS);

  // --- Initialize Integrations from LocalStorage (Fallback) ---
  useEffect(() => {
      const savedIntegrations = localStorage.getItem('wealthos_integrations');
      if (savedIntegrations) {
          try {
              const parsed = JSON.parse(savedIntegrations);
              if (Array.isArray(parsed)) {
                  setIntegrations(parsed);
              }
          } catch (e) {
              console.error("Failed to parse saved integrations");
          }
      }
  }, []);

  // --- Supabase Auth Listener ---
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id, session.user.email || '');
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setAllUsers([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      // Fetch profile from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // Fetch role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      let role: UserRole = 'USER';
      let plan: PlanTier = 'Free';
      let name = 'User';
      let avatar = undefined;
      let joinedDate = new Date().toISOString().split('T')[0];

      if (profile && !error) {
        name = profile.full_name || 'User';
        plan = (profile.plan as PlanTier) || 'Free';
        avatar = profile.avatar_url || undefined;
        joinedDate = profile.created_at?.split('T')[0] || joinedDate;
      }

      // Map database role to app role
      if (roleData?.role) {
        const dbRole = roleData.role as string;
        if (dbRole === 'super_admin') role = 'SUPER_ADMIN';
        else if (dbRole === 'admin') role = 'ADMIN';
        else role = 'USER';
      }

      // Demo account override
      if (email.toLowerCase() === 'demo@wealthos.com') {
        role = 'USER';
        plan = 'Pro';
        name = 'Demo User';
      }

      const appUser: User = {
        id: userId,
        email: email,
        name: name,
        role: role,
        plan: plan,
        joinedDate: joinedDate,
        avatar: avatar
      };

      setUser(appUser);
    } catch (error) {
      console.error('Exception in profile flow:', error);
      setUser({
        id: userId,
        email: email,
        name: 'User',
        role: 'USER',
        plan: 'Free',
        joinedDate: new Date().toISOString().split('T')[0]
      });
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    // Try Real Supabase Login First
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (!error) return true;
      console.warn("Supabase login failed:", error.message);
    } catch (error) {
      console.error('Supabase Login exception:', error);
    }

    // Fallback for Demo Account
    if (email.toLowerCase() === 'demo@wealthos.com') {
      console.log("Using Demo Account");
      setUser({
        id: 'demo-user',
        email: 'demo@wealthos.com',
        name: 'Demo User',
        role: 'USER',
        plan: 'Pro',
        joinedDate: new Date().toISOString().split('T')[0],
      });
      return true;
    }

    return false;
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Google login failed:', error);
      return false;
    }
  };

  const register = async (name: string, email: string, pass: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: name }
        }
      });

      if (error) throw error;

      if (data.user && !data.session) {
        return { success: true, message: "Account created! Please check your email to confirm your registration." };
      }

      if (data.session) {
        await fetchUserProfile(data.user!.id, email);
        return { success: true };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Registration failed:', error);
      return { success: false, message: error.message || "Registration failed." };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      return { success: true, message: "Password reset instructions sent to your email." };
    } catch (error: any) {
      console.error("Reset password error:", error);
      return { success: false, message: error.message || "Failed to send reset email." };
    }
  };

  const logout = async () => {
    supabase.auth.signOut().catch(console.error);
    setUser(null);
  };

  const updateUserPlan = async (plan: PlanTier) => {
    if (user) {
      setUser({ ...user, plan });
      // Update in database
      if (user.id !== 'demo-user') {
        await supabase
          .from('profiles')
          .update({ plan })
          .eq('id', user.id);
      }
    }
  };

  const addBrokerProvider = (provider: BrokerProvider) => setBrokerProviders(prev => [...prev, provider]);
  const removeBrokerProvider = (id: string) => setBrokerProviders(prev => prev.filter(p => p.id !== id));
  const updateBrokerProvider = (id: string, updates: Partial<BrokerProvider>) => setBrokerProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

  const connectBroker = async (providerId: string, name: string, type: 'Stock' | 'Crypto' | 'Mixed', logo: string, credentials: any) => {
    const newIntegration: BrokerIntegration = {
      id: Math.random().toString(36).substr(2, 9),
      providerId,
      name,
      type,
      status: 'Connected',
      lastSync: new Date().toLocaleString(),
      logo,
      apiCredentials: credentials
    };

    setIntegrations(prev => [...prev, newIntegration]);
    localStorage.setItem('wealthos_integrations', JSON.stringify([...integrations, newIntegration]));
    return true;
  };

  const disconnectBroker = async (id: string) => {
    setIntegrations(prev => {
      const updated = prev.filter(i => i.id !== id);
      localStorage.setItem('wealthos_integrations', JSON.stringify(updated));
      return updated;
    });
  };

  const addWallet = (wallet: Omit<CryptoWallet, 'id'>) => setWallets(prev => [...prev, { ...wallet, id: Math.random().toString() }]);
  const removeWallet = (id: string) => setWallets(prev => prev.filter(w => w.id !== id));
  const toggleWallet = (id: string) => setWallets(prev => prev.map(w => w.id === id ? { ...w, isEnabled: !w.isEnabled } : w));
  const updateWallet = (id: string, updates: Partial<CryptoWallet>) => setWallets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));

  const updatePlanPrice = (id: PlanTier, price: number) => setPlans(prev => prev.map(p => p.id === id ? { ...p, price } : p));

  const deleteUser = async (id: string) => {
    setAllUsers(prev => prev.filter(u => u.id !== id));
  };

  const updateUserRole = async (id: string, role: UserRole) => {
    setAllUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      login,
      loginWithGoogle,
      register,
      resetPassword,
      logout,
      updateUserPlan,
      brokerProviders,
      addBrokerProvider,
      removeBrokerProvider,
      updateBrokerProvider,
      integrations,
      connectBroker,
      disconnectBroker,
      wallets,
      addWallet,
      removeWallet,
      toggleWallet,
      updateWallet,
      plans,
      updatePlanPrice,
      allUsers,
      deleteUser,
      updateUserRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
