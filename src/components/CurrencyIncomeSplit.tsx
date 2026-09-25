import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Coins } from 'lucide-react';
import type { Holding } from '@/types';
import { useLanguage } from '@/context/LanguageContext';

const COUNTRY_CCY: Record<string, string> = {
  'United Kingdom': 'GBP', UK: 'GBP', GB: 'GBP', Canada: 'CAD', CA: 'CAD', Germany: 'EUR', France: 'EUR',
  Netherlands: 'EUR', Ireland: 'EUR', Spain: 'EUR', Italy: 'EUR', Switzerland: 'CHF', Japan: 'JPY',
  Australia: 'AUD', 'Saudi Arabia': 'SAR', UAE: 'AED', 'United Arab Emirates': 'AED', Sweden: 'SEK', Denmark: 'DKK', Norway: 'NOK',
};
const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Splits the last year's change in USD dividend income into currency effect vs real (local) income. */
export const CurrencyIncomeSplit = ({ holdings }: { holdings: Holding[] }) => {
  const { t } = useLanguage();
  const [rates, setRates] = useState<{ now: Record<string, number>; then: Record<string, number> } | null>(null);
  const [failed, setFailed] = useState(false);

  const byCcy = useMemo(() => {
    const m: Record<string, number> = {};
    holdings.filter(h => h.shares > 0 && (h.dividendYield ?? 0) > 0).forEach(h => {
      const c = COUNTRY_CCY[(h as any).country ?? ''] ?? 'USD';
      m[c] = (m[c] ?? 0) + h.shares * (h.currentPrice || h.avgPrice) * (h.dividendYield / 100);
    });
    return m;
  }, [holdings]);

  const foreign = Object.keys(byCcy).filter(c => c !== 'USD');

  useEffect(() => {
    if (!foreign.length) return;
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    const q = `from=USD&to=${foreign.join(',')}`;
    Promise.all([
      fetch(`https://api.frankfurter.app/latest?${q}`).then(r => r.json()),
      fetch(`https://api.frankfurter.app/${d.toISOString().slice(0, 10)}?${q}`).then(r => r.json()),
    ]).then(([n, o]) => setRates({ now: n.rates ?? {}, then: o.rates ?? {} })).catch(() => setFailed(true));
  }, [foreign.join(',')]);

  const total = Object.values(byCcy).reduce((s, v) => s + v, 0);
  if (!total) return null;

  // Income in USD today vs what the same local income would be worth at last year's rates.
  let fxEffect = 0;
  if (rates) foreign.forEach(c => {
    const n = rates.now[c], o = rates.then[c];
    if (n && o) fxEffect += byCcy[c] - byCcy[c] * (n / o);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> {t('Currency vs real income')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-1">
          {Object.entries(byCcy).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
            <li key={c} className="flex justify-between"><span className="font-medium">{c}</span><span>{((v / total) * 100).toFixed(1)}% · {fmt(v)}/yr</span></li>
          ))}
        </ul>
        {!foreign.length ? (
          <p className="text-muted-foreground">All your dividend income is in US dollars, so exchange rates don't affect it.</p>
        ) : failed ? (
          <p className="text-muted-foreground">Exchange rates couldn't be loaded right now.</p>
        ) : !rates ? (
          <p className="text-muted-foreground">Loading exchange rates…</p>
        ) : (
          <p>
            Over the last year, exchange rates {fxEffect >= 0 ? 'added' : 'removed'}{' '}
            <span className={`font-bold ${fxEffect >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmt(Math.abs(fxEffect))}</span>{' '}
            of your yearly income in dollars. The rest ({fmt(total - fxEffect)}) is real income from your holdings.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
