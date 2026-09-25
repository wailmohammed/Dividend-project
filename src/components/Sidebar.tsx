import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, PieChart, DollarSign, Search, Users, Settings, LogOut, Activity, ChevronDown, ChevronRight, PlusCircle, Check, Shield, Bell, X, BarChart2, Landmark, Crown, Moon, Sun, Cloud, CloudOff, Star, AlertTriangle, Newspaper, BellRing, TrendingUp, Eye, History, GitCompare, Calculator, Filter, Database, FlaskConical, Sparkles, Lightbulb, Tags, Brain, Percent, Layers, ListChecks, FileText, Snowflake, GitBranch, ScanSearch, HeartPulse, Globe, CalendarDays, Target, BookOpen, Zap, Flame, Bot, BarChart3, Megaphone, Wallet, UserCheck, Compass, Scale, Repeat, ListOrdered, Gauge, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { ViewState } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useTheme } from '../context/ThemeContext';
import { useUserRole } from '../hooks/useUserRole';
import { useLanguage, LanguageToggle } from '../context/LanguageContext';

const isSupabaseConfigured = true;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavGroup {
  label: string;
  items: { id: string; label: string; icon: any; badge?: number }[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [isPortfolioMenuOpen, setIsPortfolioMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPortName, setNewPortName] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Overview': true,
    'Portfolio': true,
    'Analysis': false,
    'Dividends': false,
    'AI & Research': false,
    'Market': false,
    'Alerts': false,
    'Community': false,
  });

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, isSuperAdmin } = useUserRole(user?.id);
  const [isDemoModeEnabled, setIsDemoModeEnabled] = useState(getDemoModeEnabled());
  const [unreadUpdatesCount, setUnreadUpdatesCount] = useState(0);

  useEffect(() => {
    const fetchUnreadUpdates = async () => {
      if (!user || user.id === 'demo-user' || getDemoModeEnabled()) {
        setUnreadUpdatesCount(4);
        return;
      }
      const { count, error } = await supabase
        .from('portfolio_updates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (!error && count !== null) setUnreadUpdatesCount(count);
    };
    fetchUnreadUpdates();
    const interval = setInterval(fetchUnreadUpdates, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const checkDemoMode = () => setIsDemoModeEnabled(getDemoModeEnabled());
    checkDemoMode();
    window.addEventListener('storage', checkDemoMode);
    const interval = setInterval(checkDemoMode, 1000);
    return () => {
      window.removeEventListener('storage', checkDemoMode);
      clearInterval(interval);
    };
  }, []);

  const {
    portfolios = [],
    activePortfolioId,
    defaultPortfolioId,
    switchPortfolio,
    setDefaultPortfolio,
    addNewPortfolio,
    openAddAssetModal,
    notifications = [],
    markAsRead,
    clearNotifications,
    activeView,
    switchView
  } = usePortfolio();

  const safePortfolios = Array.isArray(portfolios) ? portfolios : [];
  const activePortfolio = safePortfolios.find(p => p.id === activePortfolioId) || safePortfolios[0] || { id: 'default', name: 'My Portfolio', type: 'Mixed' };
  const unreadCount = (notifications || []).filter(n => !n.read).length;

  const isAdminAccess = isAdmin || isSuperAdmin;

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'networth', label: 'Net Worth', icon: Landmark },
        { id: 'portfolio-updates', label: 'Updates', icon: Zap, badge: unreadUpdatesCount },
        { id: 'notification-center', label: 'Notifications', icon: Bell },
      ],
    },
    {
      label: 'Portfolio',
      items: [
        { id: 'holdings', label: 'Holdings', icon: PieChart },
        { id: 'composite-portfolio', label: 'Composite View', icon: Layers },
        { id: 'portfolio-lab', label: 'Portfolio Lab', icon: FlaskConical },
        { id: 'watchlist', label: 'Watchlist', icon: Eye },
        { id: 'transactions', label: 'Transactions', icon: History },
        { id: 'tax-lots', label: 'Tax Lots', icon: Calculator },
        { id: 'allocation-deepdive', label: 'Allocation', icon: PieChart },
        { id: 'portfolio-comparison', label: 'Compare', icon: GitCompare },
      ],
    },
    {
      label: 'Analysis',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        { id: 'performance', label: 'Performance', icon: TrendingUp },
        { id: 'benchmarking', label: 'Benchmarking', icon: Gauge },
        { id: 'financial-health', label: 'Financial Health', icon: HeartPulse },
        { id: 'risk-analysis', label: 'Risk Analysis', icon: AlertTriangle },
        { id: 'diversification', label: 'Diversification', icon: Layers },
        { id: 'portfolio-snowflake', label: 'Portfolio Health', icon: Snowflake },
        { id: 'portfolio-health', label: 'Health Dashboard', icon: Shield },
        { id: 'peer-comparison', label: 'Peer Compare', icon: GitBranch },
        { id: 'true-returns', label: 'True Returns', icon: Percent },
        { id: 'fair-value', label: 'Fair Value', icon: Target },
        { id: 'intrinsic-value', label: 'Intrinsic Value', icon: Scale },
        { id: 'risks-rewards', label: 'Risks & Rewards', icon: ListChecks },
        { id: 'etf-lookthrough', label: 'ETF Look-Through', icon: ScanSearch },
        { id: 'activity-timeline', label: 'Activity Feed', icon: Activity },
        { id: 'options-flow', label: 'Options Flow', icon: Zap },
        { id: 'twelve-module', label: '12-Module Analysis', icon: Layers },
      ],
    },
    {
      label: 'Dividends',
      items: [
        { id: 'dividends', label: 'Overview', icon: DollarSign },
        { id: 'dividend-forecast', label: 'Income Forecast', icon: BarChart3 },
        { id: 'dividend-safety', label: 'Safety Scores', icon: Shield },
        { id: 'dividend-changes', label: 'Changes', icon: Megaphone },
        { id: 'dividend-cagr', label: 'CAGR & YoC', icon: Percent },
        { id: 'dividend-calculator', label: 'Calculator', icon: Calculator },
        { id: 'dividend-heatmap', label: 'Heatmap', icon: CalendarDays },
        { id: 'cash-flow', label: 'Cash Flow', icon: Wallet },
      ],
    },
    {
      label: 'AI & Research',
      items: [
        { id: 'ai-chat', label: 'AI Advisor', icon: Bot },
        { id: 'ai-projection', label: 'AI Projection', icon: Target },
        { id: 'stock-report', label: 'Stock Report', icon: Sparkles },
        { id: 'narratives', label: 'Narratives', icon: BookOpen },
        { id: 'investment-thesis', label: 'Thesis Tracker', icon: Target },
        { id: 'growth-forecast', label: 'Growth Forecast', icon: TrendingUp },
        { id: 'management-profiles', label: 'Management', icon: Users },
        { id: 'snowflake-screener', label: 'Snowflake Screener', icon: Snowflake },
        { id: 'research', label: 'Research', icon: Search },
        { id: 'weekly-insights', label: 'Weekly Insights', icon: FileText },
      ],
    },
    {
      label: 'Market',
      items: [
        { id: 'market-overview', label: 'Overview', icon: Globe },
        { id: 'market-intelligence', label: 'Intelligence', icon: Globe },
        { id: 'screener', label: 'Stock Screener', icon: Filter },
        { id: 'stock-comparison', label: 'Compare Stocks', icon: GitCompare },
        { id: 'curated-lists', label: 'Curated Lists', icon: Crown },
        { id: 'earnings-calendar', label: 'Earnings', icon: CalendarDays },
        { id: 'insider-trading', label: 'Insider Trading', icon: UserCheck },
        { id: 'opportunity-scanner', label: 'Scanner', icon: ScanSearch },
        { id: 'entry-exit', label: 'Entry & Exit', icon: Target },
        { id: 'discovery-hub', label: 'Discovery Hub', icon: Compass },
        { id: 'investing-ideas', label: 'Ideas', icon: Lightbulb },
        { id: 'news', label: 'News Feed', icon: Newspaper },
      ],
    },
    {
      label: 'Alerts',
      items: [
        { id: 'price-alerts', label: 'Price Alerts', icon: BellRing },
        { id: 'smart-alerts', label: 'Smart Alerts', icon: Brain },
      ],
    },
    {
      label: 'Planning',
      items: [
        { id: 'strategy-categories', label: 'Strategies', icon: Tags },
        { id: 'retirement-planner', label: 'FIRE Planner', icon: Flame },
        { id: 'halal-investing', label: 'Halal Investing', icon: Moon },
        { id: 'halal-education', label: 'Halal Education', icon: BookOpen },
      ],
    },
    {
      label: 'Community',
      items: [
        { id: 'community', label: 'Feed', icon: Users },
        { id: 'knowledge-base', label: 'Help Center', icon: Shield },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'market-sync', label: 'Market Sync', icon: Database },
      ],
    },
  ];

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavigation = (view: ViewState) => {
    switchView(view);
    if (window.innerWidth < 768) onClose();
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPortName.trim()) {
      setLoadingCreate(true);
      try {
        const newId = await addNewPortfolio(newPortName, 'Mixed');
        if (newId) {
          switchPortfolio(newId);
          setIsCreating(false);
          setNewPortName('');
          setIsPortfolioMenuOpen(false);
        }
      } catch (error) {
        console.error("Create portfolio failed", error);
      } finally {
        setLoadingCreate(false);
      }
    }
  };

  const handleSetDefault = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDefaultPortfolio(id);
  };

  // Check if any item in a group is active
  const isGroupActive = (group: NavGroup) => group.items.some(item => item.id === activeView);

  // Auto-expand group when its item is active
  useEffect(() => {
    navGroups.forEach(group => {
      if (isGroupActive(group) && !expandedGroups[group.label]) {
        setExpandedGroups(prev => ({ ...prev, [group.label]: true }));
      }
    });
  }, [activeView]);

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Sidebar Container */}
      <div className={`flex flex-col w-64 h-screen bg-card border-r border-border fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex md:hidden justify-end mb-2">
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Portfolio Switcher */}
          <div className="relative mb-3">
            <button
              onClick={() => setIsPortfolioMenuOpen(!isPortfolioMenuOpen)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-colors group"
            >
              <div className="bg-primary p-2 rounded-lg shadow-sm">
                <Activity className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <div className="text-base font-bold tracking-tight text-foreground leading-tight">WealthOS</div>
                <div className="text-[11px] text-muted-foreground truncate">{activePortfolio.name}</div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isPortfolioMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Portfolio Dropdown */}
            {isPortfolioMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in-up">
                <div className="p-1.5 space-y-0.5 max-h-[200px] overflow-y-auto">
                  {safePortfolios.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { switchPortfolio(p.id); setIsPortfolioMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm group transition-colors ${
                        activePortfolioId === p.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/70 hover:bg-muted'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium truncate max-w-[140px]">{p.name}</span>
                          {defaultPortfolioId === p.id && <Star className="w-3 h-3 fill-primary text-primary" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{p.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {defaultPortfolioId !== p.id && (
                          <div onClick={(e) => handleSetDefault(e, p.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all" title="Set as Default">
                            <Star className="w-3 h-3" />
                          </div>
                        )}
                        {activePortfolioId === p.id && <Check className="w-3 h-3" />}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="border-t border-border p-1.5">
                  {isCreating ? (
                    <form onSubmit={handleCreatePortfolio} className="flex flex-col gap-1.5 p-1">
                      <input type="text" autoFocus placeholder="Portfolio Name" className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all" value={newPortName} onChange={(e) => setNewPortName(e.target.value)} />
                      <div className="flex gap-1">
                        <button type="submit" disabled={loadingCreate} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold py-1.5 rounded-md disabled:opacity-50 transition-colors">{loadingCreate ? 'Creating...' : 'Create'}</button>
                        <button type="button" onClick={() => setIsCreating(false)} className="px-2.5 bg-muted text-muted-foreground text-xs rounded-md hover:bg-accent transition-colors">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setIsCreating(true)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                      <PlusCircle className="w-4 h-4" /> Create Portfolio
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Add */}
          <button
            onClick={() => { openAddAssetModal(); if(window.innerWidth < 768) onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 hover:bg-primary/15 border border-primary/20 text-primary text-sm font-semibold rounded-lg transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Add Transaction
          </button>
        </div>

        {/* Navigation */}
        <div className="px-3 pb-2 flex justify-end"><LanguageToggle /></div>
        <nav className="flex-1 px-3 overflow-y-auto sidebar-scroll pb-2">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-0.5">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-colors ${
                  isGroupActive(group) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{t(group.label)}</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedGroups[group.label] ? 'rotate-90' : ''}`} />
              </button>
              
              {expandedGroups[group.label] && (
                <div className="space-y-0.5 mb-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id as ViewState)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px] ${
                        activeView === item.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${activeView === item.id ? 'text-primary' : ''}`} />
                      <span className="truncate">{t(item.label)}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="ml-auto bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isAdminAccess && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-warning px-2 py-1">Admin</div>
              <button
                onClick={() => handleNavigation('admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px] ${
                  activeView === 'admin' ? 'bg-warning/10 text-warning font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {isSuperAdmin ? <Crown className="w-4 h-4 text-warning" /> : <Shield className="w-4 h-4" />}
                <span>{isSuperAdmin ? 'Super Admin' : 'Admin Panel'}</span>
              </button>
              <button
                onClick={() => handleNavigation('admin-sync-logs')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px] ${
                  activeView === 'admin-sync-logs' ? 'bg-warning/10 text-warning font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Sync Logs</span>
              </button>
              <button
                onClick={() => handleNavigation('admin-audit')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all text-[13px] ${
                  activeView === 'admin-audit' ? 'bg-warning/10 text-warning font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Audit Runner</span>
              </button>
            </div>
          )}
        </nav>

        {/* Footer */}
        {isDemoModeEnabled && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border text-warning border-warning/30 bg-warning/10">
              <FlaskConical className="w-3 h-3" />
              Demo Mode Active
            </div>
          </div>
        )}

        <div className="px-4 pb-1">
          <div className={`flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border ${
            isSupabaseConfigured
              ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
              : 'text-warning border-warning/20 bg-warning/5'
          }`}>
            {isSupabaseConfigured ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
            {isSupabaseConfigured ? 'Cloud Sync Active' : 'Local Demo Mode'}
          </div>
        </div>

        <div className="p-3 border-t border-border space-y-0.5">
          <button onClick={toggleTheme} className="w-full flex items-center gap-2.5 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={() => handleNavigation('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm ${
              activeView === 'settings' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors text-sm">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
