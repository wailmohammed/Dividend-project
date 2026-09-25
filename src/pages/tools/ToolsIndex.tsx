import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Calculator, ShieldCheck, CalendarDays, TrendingUp, Trophy } from 'lucide-react';

const TOOLS = [
  { to: '/tools/zakat-calculator', title: 'Zakat Calculator', desc: 'Calculate 2.5% Zakat on your stocks, ETFs and cash in seconds.', icon: Calculator },
  { to: '/tools/halal-screener', title: 'Halal Stock Screener', desc: 'AAOIFI screening: debt, cash and non-compliant revenue thresholds.', icon: ShieldCheck },
  { to: '/tools/dividend-calculator', title: 'Dividend Income Calculator', desc: 'Project annual dividend income, yield on cost and compounding.', icon: CalendarDays },
  { to: '/tools/dividend-calendar', title: 'Dividend Calendar', desc: 'Upcoming ex-dividend and pay dates with dividend safety scores.', icon: CalendarDays },
  { to: '/tools/leaderboard', title: 'Portfolio Leaderboard', desc: 'Opt-in public portfolios ranked by return — percentages only.', icon: Trophy },
  { to: '/dividend/KO', title: 'Stock Dividend Safety', desc: 'Free safety grade, cut history and next ex-date for any ticker.', icon: Trophy },
  { to: '/tools/safety-track-record', title: 'Safety Track Record', desc: 'Every grade change we have ever issued, date-stamped.', icon: Trophy },
  { to: '/tools/returns-explained', title: 'TWR vs MWR Explained', desc: 'Understand the two return methods every serious investor tracks.', icon: TrendingUp },
];

const ToolsIndex: React.FC = () => {
  const { t: tr } = useLanguage();
  useSeo({
    title: 'Free Investing Tools: Zakat, Halal Screener & Dividends',
    description: 'Free calculators for Muslim and dividend investors: Zakat calculator, AAOIFI halal stock screener, dividend income projector and return method guides.',
    canonicalPath: '/tools',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Free investing tools',
      itemListElement: TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.title, url: t.to })),
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-3">{tr('Free investing tools')}</h1>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          {tr('Purpose-built calculators for halal and dividend investors. No sign-up required — everything runs in your browser.')}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map(({ to, title, desc, icon: Icon }) => (
            <Link key={to} to={to}>
              <Card className="p-5 h-full hover:border-primary transition-colors">
                <Icon className="w-5 h-5 mb-3 text-primary" aria-hidden="true" />
                <h2 className="font-semibold mb-1">{title}</h2>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
};

export default ToolsIndex;
