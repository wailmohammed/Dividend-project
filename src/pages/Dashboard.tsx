import { lazy, Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { useDemoMode } from '@/hooks/useDemoMode';
import Sidebar from '@/components/Sidebar';
import AdminGate from '@/components/AdminGate';
import AddAssetModal from '@/components/AddAssetModal';
import { CurrencyProvider } from '@/components/MultiCurrencySelector';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import NotificationsDropdown from '@/components/NotificationsDropdown';
import LivePriceTicker from '@/components/LivePriceTicker';
import CommandPalette from '@/components/CommandPalette';
import OnboardingTour from '@/components/OnboardingTour';
import { MarketSyncStatusIndicator } from '@/components/MarketSyncStatusIndicator';
import SyncStatusBanner from '@/components/SyncStatusBanner';
import { Menu, FlaskConical } from 'lucide-react';

const DashboardView = lazy(() => import('@/components/DashboardView'));
const PortfolioView = lazy(() => import('@/components/PortfolioView'));
const DividendsView = lazy(() => import('@/components/DividendsView').then((module) => ({ default: module.DividendsView })));
const AnalyticsView = lazy(() => import('@/components/AnalyticsView').then((module) => ({ default: module.AnalyticsView })));
const ResearchView = lazy(() => import('@/components/ResearchView').then((module) => ({ default: module.ResearchView })));
const CommunityView = lazy(() => import('@/components/EnhancedCommunityFeed'));
const SettingsView = lazy(() => import('@/components/SettingsView').then((module) => ({ default: module.SettingsView })));
const NetWorthView = lazy(() => import('@/components/NetWorthView'));
const AdminView = lazy(() => import('@/components/AdminView'));
const AuditRunnerView = lazy(() => import('@/components/AuditRunnerView'));
const KnowledgeBaseView = lazy(() => import('@/components/KnowledgeBaseView').then((module) => ({ default: module.KnowledgeBaseView })));
const RiskAnalysisView = lazy(() => import('@/components/RiskAnalysisView').then((module) => ({ default: module.RiskAnalysisView })));
const NewsFeed = lazy(() => import('@/components/NewsFeed').then((module) => ({ default: module.NewsFeed })));
const PriceAlertsView = lazy(() => import('@/components/PriceAlertsView'));
const PerformanceComparisonView = lazy(() => import('@/components/PerformanceComparisonView'));
const WatchlistView = lazy(() => import('@/components/WatchlistView').then((module) => ({ default: module.WatchlistView })));
const TransactionHistoryView = lazy(() => import('@/components/TransactionHistoryView').then((module) => ({ default: module.TransactionHistoryView })));
const PortfolioComparisonView = lazy(() => import('@/components/PortfolioComparisonView').then((module) => ({ default: module.PortfolioComparisonView })));
const TaxLotTracker = lazy(() => import('@/components/TaxLotTracker'));
const StockScreener = lazy(() => import('@/components/StockScreener'));
const AdminSyncLogsView = lazy(() => import('@/components/AdminSyncLogsView'));
const NotificationCenterView = lazy(() => import('@/components/NotificationCenterView'));
const UnifiedStockReport = lazy(() => import('@/components/UnifiedStockReport'));
const InvestingIdeas = lazy(() => import('@/components/InvestingIdeas'));
const TrueReturnsCalculator = lazy(() => import('@/components/TrueReturnsCalculator'));
const PortfolioStrategyCategories = lazy(() => import('@/components/PortfolioStrategyCategories'));
const SmartFundamentalAlerts = lazy(() => import('@/components/SmartFundamentalAlerts'));
const PortfolioDiversification = lazy(() => import('@/components/PortfolioDiversification'));
const RisksRewardsChecklist = lazy(() => import('@/components/RisksRewardsChecklist'));
const WeeklyInsights = lazy(() => import('@/components/WeeklyInsights'));
const PortfolioSnowflake = lazy(() => import('@/components/PortfolioSnowflake'));
const PeerComparison = lazy(() => import('@/components/PeerComparison'));
const ETFLookThrough = lazy(() => import('@/components/ETFLookThrough'));
const PortfolioHealthDashboard = lazy(() => import('@/components/PortfolioHealthDashboard'));
const GlobalMarketOverview = lazy(() => import('@/components/GlobalMarketOverview'));
const EarningsCalendar = lazy(() => import('@/components/EarningsCalendar'));
const FairValueAnalysis = lazy(() => import('@/components/FairValueAnalysis').then((module) => ({ default: module.FairValueAnalysis })));
const NarrativeAnalysis = lazy(() => import('@/components/NarrativeAnalysis'));
const PortfolioUpdatesView = lazy(() => import('@/components/PortfolioUpdatesView'));
const InvestmentThesisTracker = lazy(() => import('@/components/InvestmentThesisTracker'));
const DividendSafetyDashboard = lazy(() => import('@/components/DividendSafetyDashboard'));
const RetirementPlanner = lazy(() => import('@/components/RetirementPlanner'));
const AIPortfolioChat = lazy(() => import('@/components/AIPortfolioChat'));
const DividendIncomeForecast = lazy(() => import('@/components/DividendIncomeForecast'));
const DividendChangeAlerts = lazy(() => import('@/components/DividendChangeAlerts'));
const IncomeSpendingBreakdown = lazy(() => import('@/components/IncomeSpendingBreakdown'));
const HalalInvestingView = lazy(() => import('@/components/HalalInvestingView'));
const AIStockProjection = lazy(() => import('@/components/AIStockProjection'));
const MarketOpportunityScanner = lazy(() => import('@/components/MarketOpportunityScanner'));
const MarketIntelligence = lazy(() => import('@/components/MarketIntelligence'));
const EntryExitAnalysis = lazy(() => import('@/components/EntryExitAnalysis'));
const InsiderTradingTracker = lazy(() => import('@/components/InsiderTradingTracker'));
const DiscoveryHub = lazy(() => import('@/components/DiscoveryHub'));
const PortfolioIntrinsicValue = lazy(() => import('@/components/PortfolioIntrinsicValue'));
const SnowflakeScreener = lazy(() => import('@/components/SnowflakeScreener'));
const GrowthForecastVisualizer = lazy(() => import('@/components/GrowthForecastVisualizer'));
const ManagementProfileViewer = lazy(() => import('@/components/ManagementProfileViewer'));
const AllocationDeepDive = lazy(() => import('@/components/AllocationDeepDive'));
const FinancialHealthScore = lazy(() => import('@/components/FinancialHealthScore'));
const PortfolioActivityTimeline = lazy(() => import('@/components/PortfolioActivityTimeline'));
const OptionsFlowTracker = lazy(() => import('@/components/OptionsFlowTracker'));
const TwelveModuleAnalysis = lazy(() => import('@/components/TwelveModuleAnalysis'));
const HalalEducationHub = lazy(() => import('@/components/HalalEducationHub'));
const DividendCAGRTracker = lazy(() => import('@/components/DividendCAGRTracker'));
const DividendCompoundCalculator = lazy(() => import('@/components/DividendCompoundCalculator'));
const StockComparisonTool = lazy(() => import('@/components/StockComparisonTool'));
const CuratedStockLists = lazy(() => import('@/components/CuratedStockLists'));
const EnhancedBenchmarking = lazy(() => import('@/components/EnhancedBenchmarking'));
const DividendCalendarHeatmap = lazy(() => import('@/components/DividendCalendarHeatmap'));
const MarketSyncDashboard = lazy(() => import('@/components/MarketSyncDashboard').then((module) => ({ default: module.MarketSyncDashboard })));
const PortfolioLab = lazy(() => import('@/components/PortfolioLab'));
const CompositePortfolioView = lazy(() => import('@/components/CompositePortfolioView'));
const Button = lazy(() => import('@/components/ui/button').then((module) => ({ default: module.Button })));

const Dashboard = () => {
  const { isAuthenticated } = useAuth();
  const { activeView, isAddAssetModalOpen } = usePortfolio();
  const { isDemoModeEnabled, toggleDemoMode } = useDemoMode();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on view change for mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [activeView]);

  if (!isAuthenticated) {
    return null;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'holdings':
        return <PortfolioView />;
      case 'dividends':
        return <DividendsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'performance':
        return <PerformanceComparisonView />;
      case 'risk-analysis':
        return <RiskAnalysisView />;
      case 'price-alerts':
        return <PriceAlertsView />;
      case 'news':
        return <NewsFeed />;
      case 'research':
        return <ResearchView />;
      case 'community':
        return <CommunityView />;
      case 'settings':
        return <SettingsView />;
      case 'networth':
        return <NetWorthView />;
      case 'admin':
        return <AdminGate><AdminView /></AdminGate>;
      case 'knowledge-base':
        return <KnowledgeBaseView />;
      case 'watchlist':
        return <WatchlistView />;
      case 'transactions':
        return <TransactionHistoryView />;
      case 'portfolio-comparison':
        return <PortfolioComparisonView />;
      case 'tax-lots':
        return <TaxLotTracker />;
      case 'screener':
        return <StockScreener />;
      case 'market-sync':
        return <MarketSyncDashboard />;
      case 'admin-sync-logs':
        return <AdminGate><AdminSyncLogsView /></AdminGate>;
      case 'admin-audit':
        return <AdminGate><AuditRunnerView /></AdminGate>;
      case 'notification-center':
        return <NotificationCenterView />;
      case 'stock-report':
        return <UnifiedStockReport />;
      case 'investing-ideas':
        return <InvestingIdeas />;
      case 'true-returns':
        return <TrueReturnsCalculator />;
      case 'strategy-categories':
        return <PortfolioStrategyCategories />;
      case 'smart-alerts':
        return <SmartFundamentalAlerts />;
      case 'diversification':
        return <PortfolioDiversification />;
      case 'risks-rewards':
        return <RisksRewardsChecklist />;
      case 'weekly-insights':
        return <WeeklyInsights />;
      case 'portfolio-snowflake':
        return <PortfolioSnowflake />;
      case 'peer-comparison':
        return <PeerComparison />;
      case 'etf-lookthrough':
        return <ETFLookThrough />;
      case 'portfolio-health':
        return <PortfolioHealthDashboard />;
      case 'market-overview':
        return <GlobalMarketOverview />;
      case 'earnings-calendar':
        return <EarningsCalendar />;
      case 'fair-value':
        return <FairValueAnalysis />;
      case 'narratives':
        return <NarrativeAnalysis />;
      case 'portfolio-updates':
        return <PortfolioUpdatesView />;
      case 'investment-thesis':
        return <InvestmentThesisTracker />;
      case 'dividend-safety':
        return <DividendSafetyDashboard />;
      case 'retirement-planner':
        return <RetirementPlanner />;
      case 'ai-chat':
        return <AIPortfolioChat />;
      case 'dividend-forecast':
        return <DividendIncomeForecast />;
      case 'dividend-changes':
        return <DividendChangeAlerts />;
      case 'cash-flow':
        return <IncomeSpendingBreakdown />;
      case 'halal-investing':
        return <HalalInvestingView />;
      case 'ai-projection':
        return <AIStockProjection />;
      case 'opportunity-scanner':
        return <MarketOpportunityScanner />;
      case 'market-intelligence':
        return <MarketIntelligence />;
      case 'entry-exit':
        return <EntryExitAnalysis />;
      case 'insider-trading':
        return <InsiderTradingTracker />;
      case 'discovery-hub':
        return <DiscoveryHub />;
      case 'intrinsic-value':
        return <PortfolioIntrinsicValue />;
      case 'snowflake-screener':
        return <SnowflakeScreener />;
      case 'growth-forecast':
        return <GrowthForecastVisualizer />;
      case 'management-profiles':
        return <ManagementProfileViewer />;
      case 'allocation-deepdive':
        return <AllocationDeepDive />;
      case 'dividend-cagr':
        return <DividendCAGRTracker />;
      case 'dividend-calculator':
        return <DividendCompoundCalculator />;
      case 'stock-comparison':
        return <StockComparisonTool />;
      case 'curated-lists':
        return <CuratedStockLists />;
      case 'benchmarking':
        return <EnhancedBenchmarking />;
      case 'dividend-heatmap':
        return <DividendCalendarHeatmap />;
      case 'portfolio-lab':
        return <PortfolioLab />;
      case 'composite-portfolio':
        return <CompositePortfolioView />;
      case 'financial-health':
        return <FinancialHealthScore />;
      case 'activity-timeline':
        return <PortfolioActivityTimeline />;
      case 'options-flow':
        return <OptionsFlowTracker />;
      case 'twelve-module':
        return <TwelveModuleAnalysis />;
      case 'halal-education':
        return <HalalEducationHub />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
          <h1 className="text-base font-bold text-foreground tracking-tight">WealthOS</h1>
          <div className="flex items-center gap-1.5">
            <Button
              variant={isDemoModeEnabled ? "default" : "ghost"}
              size="sm"
              onClick={toggleDemoMode}
              className={`gap-1 h-8 ${isDemoModeEnabled ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Demo</span>
            </Button>
            <MarketSyncStatusIndicator variant="compact" className="hidden sm:inline-flex" />
            <NotificationsDropdown />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between px-6 py-3 bg-card/80 backdrop-blur-md border-b border-border sticky top-0 z-30">
          <h1 className="text-lg font-bold text-foreground tracking-tight">WealthOS</h1>
          <div className="flex items-center gap-2">
            <CommandPalette />
            <Button
              variant={isDemoModeEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleDemoMode}
              className={`gap-1.5 h-8 text-xs ${isDemoModeEnabled ? 'bg-warning hover:bg-warning/90 text-warning-foreground border-warning' : ''}`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {isDemoModeEnabled ? 'Demo Mode ON' : 'Demo Mode'}
            </Button>
            <MarketSyncStatusIndicator />
            <NotificationsDropdown />
          </div>
        </div>

        {/* Live Price Ticker */}
        <LivePriceTicker />

        {/* Automated Sync Status Banner */}
        <SyncStatusBanner />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">
            <CurrencyProvider>
              <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground" role="status">Loading section…</div>}>
                {renderView()}
              </Suspense>
            </CurrencyProvider>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      {/* Add Asset Modal */}
      {isAddAssetModalOpen && <AddAssetModal />}

      {/* Onboarding Tour */}
      <OnboardingTour />
    </div>
  );
};

export default Dashboard;
