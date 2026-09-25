import React from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';

const ReturnsExplained: React.FC = () => {
  useSeo({
    title: 'TWR vs MWR (XIRR): Which Return Should You Track?',
    description: 'Time-weighted return measures strategy performance; money-weighted return (XIRR) measures your personal experience. Learn when to use each and how they differ.',
    canonicalPath: '/tools/returns-explained',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'TWR vs MWR (XIRR): which return should you track?',
      description: 'A practical guide to time-weighted and money-weighted portfolio returns.',
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-muted-foreground mb-6"><Link to="/tools" className="hover:underline">Tools</Link> / Returns explained</nav>
        <h1 className="text-4xl font-bold mb-6">TWR vs MWR (XIRR): which return should you track?</h1>
        <article className="space-y-5 text-muted-foreground">
          <p><strong className="text-foreground">Time-weighted return (TWR)</strong> chain-links the return of each sub-period between cash flows. Because deposits and withdrawals are removed, TWR is the only fair way to compare your portfolio with an index like the S&P 500.</p>
          <p><strong className="text-foreground">Money-weighted return (MWR / XIRR)</strong> solves for the discount rate that makes all your cash flows net to zero. It rewards good timing and penalises bad timing, so it reflects what you actually earned in dollars.</p>
          <Card className="p-5 text-sm">
            <p className="text-foreground font-medium mb-2">Rule of thumb</p>
            <p>Use TWR to judge your strategy or fund selection. Use MWR to judge your own behaviour — the size and timing of your contributions.</p>
          </Card>
          <h2 className="text-xl font-semibold text-foreground">Why the two numbers differ</h2>
          <p>If you added a large deposit right before a rally, MWR will exceed TWR. If you added right before a drawdown, MWR will be lower. Both numbers are correct; they answer different questions.</p>
          <p>This app shows both side by side on your dashboard, with TWR computed from daily valuations and Modified Dietz sub-periods and MWR from your actual transaction cash flows.</p>
        </article>
      </div>
    </main>
  );
};

export default ReturnsExplained;
