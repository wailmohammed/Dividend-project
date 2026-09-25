import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { ViewState } from '@/types';
import {
  LayoutDashboard, PieChart, DollarSign, Search, Users, Settings, BarChart2, Landmark,
  Eye, History, Calculator, TrendingUp, GitCompare, Bell, AlertTriangle, Shield,
  Sparkles, Lightbulb, Percent, Layers, ListChecks, Snowflake, HeartPulse, Globe,
  CalendarDays, Target, BookOpen, Flame, Bot, Megaphone, Wallet, Compass, Scale,
  Filter, Newspaper, Crown, Gauge, Moon, PlusCircle, Zap, LucideIcon, Command, FileText
} from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { Input } from './ui/input';

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  category: 'navigation' | 'action' | 'tool';
}

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const { switchView, openAddAssetModal, viewStock } = usePortfolio();

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const nav = useCallback((view: ViewState) => {
    switchView(view);
    setIsOpen(false);
  }, [switchView]);

  const items: PaletteItem[] = useMemo(() => [
    // Navigation
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => nav('dashboard'), category: 'navigation' },
    { id: 'portfolio', label: 'Portfolio Holdings', icon: PieChart, action: () => nav('holdings'), category: 'navigation' },
    { id: 'dividends', label: 'Dividends', icon: DollarSign, action: () => nav('dividends'), category: 'navigation' },
    { id: 'watchlist', label: 'Watchlist', icon: Eye, action: () => nav('watchlist'), category: 'navigation' },
    { id: 'analytics', label: 'Analytics', icon: BarChart2, action: () => nav('analytics'), category: 'navigation' },
    { id: 'performance', label: 'Performance', icon: TrendingUp, action: () => nav('performance'), category: 'navigation' },
    { id: 'networth', label: 'Net Worth', icon: Landmark, action: () => nav('networth'), category: 'navigation' },
    { id: 'transactions', label: 'Transactions', icon: History, action: () => nav('transactions'), category: 'navigation' },
    { id: 'tax-lots', label: 'Tax Lots', icon: Calculator, action: () => nav('tax-lots'), category: 'navigation' },
    { id: 'risk', label: 'Risk Analysis', icon: AlertTriangle, action: () => nav('risk-analysis'), category: 'navigation' },
    { id: 'screener', label: 'Stock Screener', icon: Filter, action: () => nav('screener'), category: 'navigation' },
    { id: 'news', label: 'News Feed', icon: Newspaper, action: () => nav('news'), category: 'navigation' },
    { id: 'community', label: 'Community', icon: Users, action: () => nav('community'), category: 'navigation' },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => nav('settings'), category: 'navigation' },
    { id: 'alerts', label: 'Price Alerts', icon: Bell, action: () => nav('price-alerts'), category: 'navigation' },
    { id: 'smart-alerts', label: 'Smart Alerts', icon: Zap, action: () => nav('smart-alerts'), category: 'navigation' },
    { id: 'compare', label: 'Portfolio Compare', icon: GitCompare, action: () => nav('portfolio-comparison'), category: 'navigation' },
    { id: 'stock-report', label: 'Stock Report', icon: Sparkles, action: () => nav('stock-report'), category: 'navigation' },
    { id: 'ideas', label: 'Investing Ideas', icon: Lightbulb, action: () => nav('investing-ideas'), category: 'navigation' },
    { id: 'true-returns', label: 'True Returns', icon: Percent, action: () => nav('true-returns'), category: 'navigation' },
    { id: 'diversification', label: 'Diversification', icon: Layers, action: () => nav('diversification'), category: 'navigation' },
    { id: 'health', label: 'Portfolio Health', icon: HeartPulse, action: () => nav('portfolio-health'), category: 'navigation' },
    { id: 'fair-value', label: 'Fair Value', icon: Target, action: () => nav('fair-value'), category: 'navigation' },
    { id: 'thesis', label: 'Investment Thesis', icon: BookOpen, action: () => nav('investment-thesis'), category: 'navigation' },
    { id: 'div-safety', label: 'Dividend Safety', icon: Shield, action: () => nav('dividend-safety'), category: 'navigation' },
    { id: 'fire', label: 'FIRE Planner', icon: Flame, action: () => nav('retirement-planner'), category: 'navigation' },
    { id: 'ai-chat', label: 'AI Advisor', icon: Bot, action: () => nav('ai-chat'), category: 'navigation' },
    { id: 'halal', label: 'Halal Investing', icon: Moon, action: () => nav('halal-investing'), category: 'navigation' },
    { id: 'discovery', label: 'Discovery Hub', icon: Compass, action: () => nav('discovery-hub'), category: 'navigation' },
    { id: 'intrinsic', label: 'Intrinsic Value', icon: Scale, action: () => nav('intrinsic-value'), category: 'navigation' },
    { id: 'curated', label: 'Curated Lists', icon: Crown, action: () => nav('curated-lists'), category: 'navigation' },
    { id: 'benchmark', label: 'Benchmarking', icon: Gauge, action: () => nav('benchmarking'), category: 'navigation' },
    { id: 'allocation', label: 'Allocation DeepDive', icon: PieChart, action: () => nav('allocation-deepdive'), category: 'navigation' },
    { id: 'div-cagr', label: 'Dividend CAGR & YoC', icon: Percent, action: () => nav('dividend-cagr'), category: 'navigation' },
    { id: 'heatmap', label: 'Dividend Heatmap', icon: CalendarDays, action: () => nav('dividend-heatmap'), category: 'navigation' },
    { id: 'market-overview', label: 'Market Overview', icon: Globe, action: () => nav('market-overview'), category: 'navigation' },
    { id: 'cash-flow', label: 'Cash Flow', icon: Wallet, action: () => nav('cash-flow'), category: 'navigation' },
    { id: 'div-changes', label: 'Dividend Changes', icon: Megaphone, action: () => nav('dividend-changes'), category: 'navigation' },
    // Actions
    { id: 'add-asset', label: 'Add Transaction', description: 'Add a new stock, ETF, or crypto', icon: PlusCircle, action: () => { openAddAssetModal(); setIsOpen(false); }, category: 'action' },
    { id: 'proof-of-wealth', label: 'Proof of Wealth', description: 'Generate a signed net worth statement', icon: FileText, action: () => nav('networth'), category: 'navigation' },
  ], [nav, openAddAssetModal]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 15);
    const q = query.toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.description && i.description.toLowerCase().includes(q)) ||
      i.id.includes(q)
    ).slice(0, 12);
  }, [query, items]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && filtered[selectedIdx]) { filtered[selectedIdx].action(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, filtered, selectedIdx]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  return (
    <>
      {/* Trigger hint */}
      <button
        onClick={() => { setIsOpen(true); setQuery(''); }}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <Command className="w-3 h-3" />
        <span>Quick actions</span>
        <kbd className="px-1.5 py-0.5 text-[10px] bg-background border border-border rounded font-mono">⌘K</kbd>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="p-0 max-w-lg gap-0 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center border-b border-border px-4">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands, pages, stocks..."
              className="border-0 focus-visible:ring-0 shadow-none text-sm"
              autoFocus
            />
            <kbd className="px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded font-mono text-muted-foreground shrink-0">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[320px] overflow-y-auto p-2">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No results found</div>
            )}
            {filtered.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    idx === selectedIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${idx === selectedIdx ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    {item.description && <div className="text-xs text-muted-foreground truncate">{item.description}</div>}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    item.category === 'action' ? 'border-primary/30 text-primary' : 'border-border text-muted-foreground'
                  }`}>
                    {item.category === 'action' ? 'Action' : 'Go to'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground bg-muted/30">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CommandPalette;
