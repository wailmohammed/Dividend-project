import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import {
  PieChart, DollarSign, TrendingUp, Eye, Bot, BarChart2,
  ChevronRight, ChevronLeft, X, Sparkles, Rocket
} from 'lucide-react';

const TOUR_KEY = 'wealthos_onboarding_complete';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: { label: string; view: string };
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to WealthOS! 🎉',
    description: 'Your all-in-one portfolio command center. Track stocks, dividends, performance, and more — all in one place. Let us show you around!',
    icon: <Rocket className="w-8 h-8 text-primary" />,
  },
  {
    title: 'Portfolio Dashboard',
    description: 'See your entire portfolio at a glance — total value, gains/losses, top movers, and recent alerts. Your financial cockpit.',
    icon: <PieChart className="w-8 h-8 text-primary" />,
    action: { label: 'Open Dashboard', view: 'dashboard' },
  },
  {
    title: 'Dividend Tracking',
    description: 'Track dividend income with calendar heatmaps, CAGR analysis, yield-on-cost tracking, and income forecasts up to 10 years.',
    icon: <DollarSign className="w-8 h-8 text-emerald-500" />,
    action: { label: 'View Dividends', view: 'dividends' },
  },
  {
    title: 'Performance Analytics',
    description: 'Benchmark against S&P 500, measure true returns (IRR), and see which holdings are driving your performance.',
    icon: <TrendingUp className="w-8 h-8 text-primary" />,
    action: { label: 'See Analytics', view: 'analytics' },
  },
  {
    title: 'Watchlist & Alerts',
    description: 'Track stocks you\'re interested in, set price alerts, and get notified about dividend changes and earnings surprises.',
    icon: <Eye className="w-8 h-8 text-primary" />,
    action: { label: 'Open Watchlist', view: 'watchlist' },
  },
  {
    title: 'AI-Powered Insights',
    description: 'Get AI analysis of your portfolio, stock projections, narrative analysis, and personalized recommendations.',
    icon: <Bot className="w-8 h-8 text-primary" />,
    action: { label: 'Try AI Advisor', view: 'ai-chat' },
  },
  {
    title: 'Quick Actions (⌘K)',
    description: 'Press ⌘K (or Ctrl+K) anytime to instantly search and navigate to any feature. You\'re all set — happy investing!',
    icon: <Sparkles className="w-8 h-8 text-primary" />,
  },
];

const OnboardingTour: React.FC = () => {
  const { user } = useAuth();
  const { switchView } = usePortfolio();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user || user.id === 'demo-user') return;
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      // Delay showing to let dashboard render first
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
    else handleComplete();
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_KEY, 'true');
    setIsVisible(false);
  };

  const handleAction = (view: string) => {
    switchView(view as any);
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-primary/20">
        <CardContent className="p-6">
          {/* Close button */}
          <button
            onClick={handleComplete}
            className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? 'w-6 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">{step.icon}</div>
            <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </div>

          {/* Action button */}
          {step.action && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mb-4"
              onClick={() => handleAction(step.action!.view)}
            >
              {step.action.label}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <span className="text-xs text-muted-foreground">
              {currentStep + 1} / {STEPS.length}
            </span>

            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1"
            >
              {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingTour;
