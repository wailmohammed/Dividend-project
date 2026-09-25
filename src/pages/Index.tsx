import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, LanguageToggle } from '@/context/LanguageContext';
import { 
  Loader2, Activity, TrendingUp, Shield, DollarSign, BarChart2, PieChart, Globe, 
  Zap, ChevronRight, Star, Target, BookOpen, Users, ArrowRight, Check, 
  Wallet, Bot, Moon, Layers, Flame, CalendarDays, Crown, Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate, Navigate } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';

const FEATURES = [
  { icon: PieChart, title: 'Portfolio Tracking', desc: 'Track all your investments in one place with real-time pricing and performance metrics.' },
  { icon: DollarSign, title: 'Dividend Analytics', desc: 'Automated dividend tracking with safety scores, income projections, and DRIP calculations.' },
  { icon: Shield, title: 'Risk Analysis', desc: 'Sharpe ratio, correlation matrix, stress testing, and Monte Carlo simulations.' },
  { icon: Target, title: 'Fair Value Analysis', desc: 'DCF models and intrinsic value vs market price for every holding.' },
  { icon: BookOpen, title: 'Thesis Tracker', desc: 'Document your bull case, conviction levels, and fair value targets for every stock.' },
  { icon: Globe, title: 'Multi-market Investing', desc: 'Explore supported stocks, ETFs, and funds across international markets.' },
  { icon: BarChart2, title: 'Snowflake Analysis', desc: 'Visual quality scores across Value, Future, Past, Health, and Dividend.' },
  { icon: Zap, title: 'Smart Alerts', desc: 'Price targets, dividend changes, earnings, and valuation shift notifications.' },
];

const STATS = [
  { value: 'One view', label: 'Across your portfolios' },
  { value: 'Income', label: 'Dividends, forecasts & goals' },
  { value: 'Values', label: 'Halal screening & Zakat tools' },
  { value: 'Insight', label: 'Returns, risk & allocation' },
];

const TOOL_HIGHLIGHTS = [
  { icon: Bot, title: 'AI Portfolio Advisor', desc: 'Ask anything about your portfolio' },
  { icon: Moon, title: 'Halal Screening', desc: 'Shariah compliance analysis' },
  { icon: Flame, title: 'FIRE Planner', desc: 'Retirement projections & goals' },
  { icon: CalendarDays, title: 'Dividend Calendar', desc: 'Ex-dates, payouts & forecasts' },
  { icon: Crown, title: 'Curated Lists', desc: 'Dividend aristocrats & kings' },
  { icon: Gauge, title: 'Benchmarking', desc: 'Compare vs S&P 500 & more' },
  { icon: Layers, title: 'ETF Look-Through', desc: 'See inside your ETF holdings' },
  { icon: Wallet, title: 'Tax Loss Harvesting', desc: 'Optimize your tax strategy' },
];

const PLANS = [
  { 
    name: 'Free', 
    price: '$0', 
    desc: 'Get started with the basics',
    features: ['1 portfolio', 'Basic dividend tracking', 'Price alerts', 'Community access'],
    cta: 'Get Started Free',
    highlighted: false
  },
  { 
    name: 'Pro', 
    price: '$9.99', 
    period: '/mo',
    desc: 'For serious investors',
    features: ['Unlimited portfolios', 'AI advisor & projections', 'Advanced analytics', 'Broker connections', 'Tax reporting', 'Priority support'],
    cta: 'Start 14-day Trial',
    highlighted: true
  },
  { 
    name: 'Premium', 
    price: '$19.99', 
    period: '/mo',
    desc: 'Institutional-grade tools',
    features: ['Everything in Pro', 'Proof of Wealth reports', 'API access', 'Custom benchmarks', 'White-glove onboarding', 'Dedicated support'],
    cta: 'Contact Sales',
    highlighted: false
  },
];

const Index = () => {
  const { t: tr } = useLanguage();
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useSeo({
    title: 'WealthOS — Portfolio, Dividend, Halal & Zakat Tracker',
    description: 'Bring portfolio performance, dividend income, Shariah screening and Zakat planning together. Explore WealthOS with a live demo or start free.',
    canonicalPath: '/',
    jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'WealthOS', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', description: 'Portfolio tracking, dividend planning, halal screening and Zakat tools for self-directed investors.' },
  });

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="text-sm font-medium text-muted-foreground">{tr('Initializing WealthOS...')}</div>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">WealthOS</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{tr('Features')}</a>
            <a href="#deep-dive" className="hover:text-foreground transition-colors">{tr('Deep Dive')}</a>
            <a href="#comparison" className="hover:text-foreground transition-colors">{tr('Compare')}</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">{tr('Reviews')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{tr('Pricing')}</a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>{tr('Sign In')}</Button>
            <Button size="sm" onClick={() => navigate('/auth')}>
              {tr('Start Free')} <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                <Zap className="w-3 h-3" />
                {tr('Portfolio clarity for income-focused investors')}
              </div>
              <div>
                <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.08] mb-6">
                  <span className="text-primary">{tr('Invest with clarity.')}</span>
                  <br />{tr('Track wealth, income')}<br />{tr('and values in one place.')}
                </h1>
                <ul className="space-y-3 text-lg text-muted-foreground">
                  {[
                    'See portfolio performance and risk together',
                    'Plan dividend income, reinvestment and goals',
                    'Explore Shariah screening and Zakat tools',
                  ].map(t => (
                    <li key={t} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="text-base px-8 shadow-lg shadow-primary/25" onClick={() => navigate('/auth')}>
                  {tr('Get started for free')}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8" onClick={() => {
                  // Enable demo mode and navigate to dashboard
                  localStorage.setItem('wealthos_demo_mode', 'true');
                  navigate('/dashboard');
                }}>
                  <Star className="w-4 h-4 mr-1.5" /> {tr('Live Demo')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{tr('Free forever for basic features • No credit card required')}</p>

              {/* Social proof avatars */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2">
                  {['AK','SM','DL','MG','JR'].map((initials, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary">
                      {initials}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">{tr('A focused toolkit for independent investors')}</span>
              </div>
            </div>
            
            {/* Hero Visual - Dashboard Preview */}
            <div className="hidden lg:block">
              <Card className="p-6 bg-card/50 backdrop-blur border-border shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{tr('Portfolio Overview')}</span>
                    <span className="text-xs text-muted-foreground">{tr('Sample portfolio')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Portfolio value', value: '$247,830', change: 'Illustrative' },
                      { label: 'Annual dividends', value: '$8,940', change: 'Illustrative' },
                      { label: 'Total return', value: '+12.7%', change: 'Illustrative' },
                    ].map(m => (
                      <div key={tr(m.label)} className="p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{tr(m.label)}</div>
                        <div className="text-lg font-bold">{m.value}</div>
                        <div className="text-xs text-green-500 font-medium">{m.change}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mini chart bars */}
                  <div className="flex items-end gap-1 h-20 pt-2">
                    {[40, 55, 35, 65, 50, 72, 60, 80, 68, 85, 75, 92].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-primary/30 hover:bg-primary/50 transition-colors" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{tr('Jan')}</span><span>{tr('Mar')}</span><span>{tr('May')}</span><span>{tr('Jul')}</span><span>{tr('Sep')}</span><span>{tr('Nov')}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(s => (
              <div key={tr(s.label)}>
                <div className="text-3xl font-black text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{tr(s.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{tr('Everything you need to invest smarter')}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tr('Portfolio analytics, dividend planning and values-led investing tools in one workspace.')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <Card key={tr(f.title)} className="p-6 hover:border-primary/50 transition-all group hover:-translate-y-1">
                <f.icon className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-bold text-lg mb-2">{tr(f.title)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tr(f.desc)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Dividend Deep Dive */}
      <section id="dividends" className="py-20 px-6 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
                <DollarSign className="w-3 h-3" />
                {tr('Dividend Suite')}
              </div>
              <h2 className="text-3xl font-bold mb-6">{tr('Detailed dividend analytics')}</h2>
              <p className="text-muted-foreground mb-8">
                {tr('Understand the income your portfolio may generate, keep payment dates in view, and model how reinvestment could compound over time.')}
              </p>
              <div className="space-y-5">
                {[
                  { title: 'Dividend Calendar', desc: 'Track ex-dates, pay dates, and forecast income for the year ahead' },
                  { title: 'Safety Ratings', desc: 'Payout ratio, coverage ratio, and growth streak analysis per holding' },
                  { title: 'DRIP Calculator', desc: 'See the compounding power of reinvesting dividends over 5–30 years' },
                  { title: 'Income Goals', desc: 'Set monthly income targets and track progress with milestone badges' },
                ].map(item => (
                  <div key={tr(item.title)} className="flex gap-4">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{tr(item.title)}</h4>
                      <p className="text-sm text-muted-foreground">{tr(item.desc)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Yield', value: '3.8%', sub: 'Illustrative portfolio' },
                { label: 'Annual income', value: '$12,450', sub: 'Illustrative estimate' },
                { label: 'Monthly average', value: '$1,037', sub: 'Illustrative estimate' },
                { label: 'Income growth', value: '+8.2%', sub: 'Illustrative example' },
              ].map(card => (
                <Card key={tr(card.label)} className="p-6 text-center hover:border-primary/50 transition-colors">
                  <div className="text-2xl font-bold text-primary">{card.value}</div>
                  <div className="text-sm font-medium mt-1">{tr(card.label)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tools Showcase */}
      <section id="tools" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tools for every stage of your investing journey</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tr('One-click rebalancing, AI advisor, tax harvesting, Halal screening — everything an investor needs.')}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TOOL_HIGHLIGHTS.map(t => (
              <Card key={tr(t.title)} className="p-5 hover:border-primary/50 transition-all group hover:-translate-y-1 cursor-pointer" onClick={() => navigate('/auth')}>
                <t.icon className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-semibold text-sm mb-1">{tr(t.title)}</h4>
                <p className="text-xs text-muted-foreground">{tr(t.desc)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Analysis Section */}
      <section id="analysis" className="py-20 px-6 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{tr('Portfolio Command Center')}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tr('Stop reacting and start growing with data and insights the pros use.')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: TrendingUp, title: 'Performance vs Benchmark', desc: 'Compare your returns against S&P 500, NASDAQ, and custom benchmarks with risk-adjusted metrics like Sharpe ratio.' },
              { icon: Shield, title: 'Portfolio Snowflake', desc: '5-dimension radar chart scoring Value, Future Growth, Past Performance, Financial Health, and Dividend quality.' },
              { icon: Star, title: 'Investment Thesis', desc: 'Document your bull case, set fair values, track conviction levels, and measure upside for every position you own.' },
            ].map(item => (
              <Card key={tr(item.title)} className="p-8 text-left hover:border-primary/50 transition-all hover:-translate-y-1">
                <item.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-bold text-lg mb-2">{tr(item.title)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tr(item.desc)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Product principles */}
      <section id="testimonials" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{tr('Built around the decisions investors make')}</h2>
            <p className="text-muted-foreground text-lg">{tr('Bring the numbers, income plan and personal criteria into one workflow.')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BarChart2, title: 'Measure what you earned', text: 'Review returns, benchmarks, allocation and risk from a single portfolio view.' },
              { icon: DollarSign, title: 'Plan income with context', text: 'Follow dividend history, upcoming payments, income forecasts and reinvestment scenarios.' },
              { icon: Moon, title: 'Invest by your criteria', text: 'Use halal screening and Zakat planning tools as part of your investing workflow.' },
              { icon: Shield, title: 'Know what needs attention', text: 'Keep alerts, dividend changes and portfolio goals close to the decisions they inform.' },
            ].map(item => (
              <Card key={item.title} className="p-6 hover:border-primary/50 transition-colors">
                <item.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{tr(item.title)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{tr(item.text)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{tr('Simple, transparent pricing')}</h2>
            <p className="text-muted-foreground text-lg">{tr('Start free and upgrade as you grow')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <Card 
                key={plan.name} 
                className={`p-8 relative transition-all hover:-translate-y-1 ${
                  plan.highlighted ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {tr('Most Popular')}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{tr(plan.desc)}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground text-sm">{tr(plan.period)}</span>}
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={tr(f)} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>{tr(f)}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={plan.highlighted ? 'default' : 'outline'}
                  onClick={() => navigate('/auth')}
                >
                  {tr(plan.cta)}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{tr('Ready to take control of your portfolio?')}</h2>
          <p className="text-muted-foreground text-lg mb-8">
            {tr('Start with a sample portfolio, or create an account and build a clearer view of your investments.')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="text-base px-10 shadow-lg shadow-primary/25" onClick={() => navigate('/auth')}>
              {tr('Get Started Free')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-10" onClick={() => {
              localStorage.setItem('wealthos_demo_mode', 'true');
              navigate('/dashboard');
            }}>
              <Star className="w-4 h-4 mr-1.5" /> {tr('Live Demo')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">{tr('No credit card required • Free forever for basic features')}</p>
        </div>
      </section>

      {/* Product positioning */}
      <section id="comparison" className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">{tr('A distinct approach to portfolio tracking')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{tr('Portfolio trackers share many core tools. WealthOS brings portfolio analytics together with halal screening and Zakat planning for investors who want those workflows side by side.')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Portfolio analytics', text: 'Performance, allocation, risk, benchmarks and investment research.' },
              { name: 'Dividend planning', text: 'Income tracking, payment calendar, projections and reinvestment tools.' },
              { name: 'Values-led investing', text: 'Halal screening and Zakat tools in the same investing workspace.' },
            ].map(item => <Card key={item.name} className="p-6"><h3 className="font-semibold mb-2">{tr(item.name)}</h3><p className="text-sm text-muted-foreground">{tr(item.text)}</p></Card>)}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-primary p-1.5 rounded-lg">
                  <Activity className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold">WealthOS</span>
              </div>
              <p className="text-sm text-muted-foreground">{tr('Your investment command center. Track, analyze, and grow your wealth.')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{tr('Product')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">{tr('Features')}</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">{tr('Pricing')}</a></li>
                <li><a href="#tools" className="hover:text-foreground transition-colors">{tr('Tools')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{tr('Resources')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">{tr('Knowledge Base')}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{tr('Community')}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{tr('Blog')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{tr('Legal')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">{tr('Privacy Policy')}</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">{tr('Terms of Service')}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© 2026 WealthOS. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
              <a href="#" className="hover:text-foreground transition-colors">Discord</a>
              <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
