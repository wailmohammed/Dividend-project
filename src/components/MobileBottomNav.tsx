import { LayoutDashboard, PieChart, DollarSign, BarChart2, Settings, Menu } from 'lucide-react';
import { ViewState } from '../types';
import { useLanguage } from '@/context/LanguageContext';
import { usePortfolio } from '../context/PortfolioContext';
import { cn } from '@/lib/utils';

const navItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'holdings', label: 'Portfolio', icon: PieChart },
  { id: 'dividends', label: 'Dividends', icon: DollarSign },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

export const MobileBottomNav = ({ onOpenMenu }: MobileBottomNavProps) => {
  const { t: tr } = useLanguage();
  const { activeView, switchView } = usePortfolio();

  const handleNavigation = (view: ViewState) => {
    switchView(view);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id as ViewState)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px]",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg transition-all duration-200",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn(
                  "w-5 h-5 transition-transform",
                  isActive && "scale-110"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-0.5 transition-all",
                isActive && "font-semibold"
              )}>
                {tr(item.label)}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
        
        {/* More menu button */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-2 px-3 rounded-xl text-muted-foreground min-w-[60px]"
        >
          <div className="p-1.5 rounded-lg">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium mt-0.5">{tr('More')}</span>
        </button>
      </div>
    </nav>
  );
};
