import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeo } from '@/hooks/useSeo';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ZAKAT_RATE = 0.025;

const ZakatCalculator: React.FC = () => {
  const [stocks, setStocks] = useState('10000');
  const [cash, setCash] = useState('2000');
  const [gold, setGold] = useState('0');
  const [debts, setDebts] = useState('0');
  const [nisab, setNisab] = useState('5500');

  const num = (v: string) => (isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  const { netWealth, zakat, meetsNisab } = useMemo(() => {
    const net = num(stocks) + num(cash) + num(gold) - num(debts);
    return {
      netWealth: net,
      zakat: net > 0 ? net * ZAKAT_RATE : 0,
      meetsNisab: net >= num(nisab),
    };
  }, [stocks, cash, gold, debts, nisab]);

  useSeo({
    title: 'Zakat Calculator for Stocks, ETFs & Cash (2.5%)',
    description: 'Free Zakat calculator for investors: add stocks, ETFs, cash and gold, subtract debts, compare against nisab and get your 2.5% Zakat instantly.',
    canonicalPath: '/tools/zakat-calculator',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How much Zakat do I pay on stocks?',
          acceptedAnswer: { '@type': 'Answer', text: 'Zakat is 2.5% of the zakatable value of your holdings once your net wealth has stayed above nisab for a full lunar year.' },
        },
        {
          '@type': 'Question',
          name: 'What is nisab?',
          acceptedAnswer: { '@type': 'Answer', text: 'Nisab is the minimum wealth threshold, usually the market value of 85 grams of gold or 595 grams of silver.' },
        },
      ],
    },
  });

  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-muted-foreground mb-6"><Link to="/tools" className="hover:underline">Tools</Link> / Zakat Calculator</nav>
        <h1 className="text-4xl font-bold mb-3">Zakat calculator for investors</h1>
        <p className="text-muted-foreground mb-8">
          Zakat is 2.5% of your zakatable net wealth held for one lunar year, provided it exceeds nisab.
        </p>

        <Card className="p-6 space-y-4">
          {[
            { id: 'stocks', label: 'Stocks & ETFs (market value)', value: stocks, set: setStocks },
            { id: 'cash', label: 'Cash & bank balances', value: cash, set: setCash },
            { id: 'gold', label: 'Gold, silver & other assets', value: gold, set: setGold },
            { id: 'debts', label: 'Short-term debts owed', value: debts, set: setDebts },
            { id: 'nisab', label: 'Nisab threshold', value: nisab, set: setNisab },
          ].map(f => (
            <div key={f.id}>
              <Label htmlFor={f.id}>{f.label}</Label>
              <Input id={f.id} inputMode="decimal" value={f.value} onChange={e => f.set(e.target.value)} className="mt-1" />
            </div>
          ))}
        </Card>

        <Card className="p-6 mt-6">
          <p className="text-sm text-muted-foreground">Zakatable net wealth</p>
          <p className="text-2xl font-semibold mb-4">{fmt(netWealth)}</p>
          <p className="text-sm text-muted-foreground">Zakat due (2.5%)</p>
          <p className="text-3xl font-bold text-primary">{meetsNisab ? fmt(zakat) : fmt(0)}</p>
          {!meetsNisab && (
            <p className="text-sm text-muted-foreground mt-2">Your net wealth is below the nisab threshold, so no Zakat is due.</p>
          )}
        </Card>

        <section className="mt-10 space-y-3 text-sm text-muted-foreground">
          <h2 className="text-lg font-semibold text-foreground">How Zakat on shares works</h2>
          <p>Long-term investors commonly pay Zakat on the zakatable portion of a company (cash, receivables, inventory), while active traders pay on the full market value. This calculator uses full market value, which is the most conservative approach.</p>
          <p>This tool is for guidance only and is not a fatwa. Consult a qualified scholar for your situation.</p>
        </section>
      </div>
    </main>
  );
};

export default ZakatCalculator;
