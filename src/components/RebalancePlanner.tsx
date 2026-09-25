import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { usePortfolio } from '@/context/PortfolioContext';
import { supabase } from '@/integrations/supabase/client';
import { cleanSymbol } from '@/lib/utils';
import { toast } from 'sonner';
import { Scale, Save, Wand2, ArrowRight, Loader2, Info } from 'lucide-react';

type Mode = 'cash' | 'full';

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export const RebalancePlanner: React.FC = () => {
  const { activePortfolio, refetchPortfolio } = usePortfolio();
  const holdings = useMemo(() => activePortfolio?.holdings || [], [activePortfolio]);

  const [targets, setTargets] = useState<Record<string, string>>({});
  const [newCash, setNewCash] = useState('1000');
  const [mode, setMode] = useState<Mode>('cash');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial: Record<string, string> = {};
    const equal = holdings.length > 0 ? 100 / holdings.length : 0;
    holdings.forEach(h => {
      initial[h.id] = String(Number((h.targetAllocation ?? equal).toFixed(2)));
    });
    setTargets(initial);
  }, [holdings]);

  const totalValue = useMemo(
    () => holdings.reduce((s, h) => s + h.shares * (h.currentPrice || h.avgPrice || 0), 0),
    [holdings],
  );

  const targetSum = useMemo(
    () => Object.values(targets).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [targets],
  );

  const cash = Math.max(0, parseFloat(newCash) || 0);

  const plan = useMemo(() => {
    const pool = mode === 'cash' ? totalValue + cash : totalValue;
    return holdings
      .map(h => {
        const price = h.currentPrice || h.avgPrice || 0;
        const currentValue = h.shares * price;
        const currentPct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
        const targetPct = parseFloat(targets[h.id]) || 0;
        const targetValue = (targetPct / 100) * pool;
        let delta = targetValue - currentValue;
        if (mode === 'cash' && delta < 0) delta = 0; // never sell in cash-only mode
        const shares = price > 0 ? delta / price : 0;
        return {
          id: h.id,
          symbol: cleanSymbol(h.symbol),
          name: h.name,
          price,
          currentPct,
          targetPct,
          delta,
          shares,
          action: delta >= 0 ? 'BUY' : 'SELL',
        };
      })
      .filter(r => Math.abs(r.delta) > 1)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [holdings, targets, totalValue, cash, mode]);

  const cashUsed = useMemo(
    () => plan.filter(r => r.action === 'BUY').reduce((s, r) => s + r.delta, 0),
    [plan],
  );

  const scaledPlan = useMemo(() => {
    if (mode !== 'cash' || cashUsed <= cash || cashUsed === 0) return plan;
    const factor = cash / cashUsed;
    return plan.map(r => ({ ...r, delta: r.delta * factor, shares: r.shares * factor }));
  }, [plan, mode, cashUsed, cash]);

  const setEqualWeights = () => {
    const equal = holdings.length > 0 ? 100 / holdings.length : 0;
    const next: Record<string, string> = {};
    holdings.forEach(h => { next[h.id] = equal.toFixed(2); });
    setTargets(next);
  };

  const normalize = () => {
    if (targetSum <= 0) return;
    const next: Record<string, string> = {};
    holdings.forEach(h => {
      next[h.id] = (((parseFloat(targets[h.id]) || 0) / targetSum) * 100).toFixed(2);
    });
    setTargets(next);
  };

  const saveTargets = async () => {
    setSaving(true);
    try {
      for (const h of holdings) {
        const value = parseFloat(targets[h.id]);
        const { error } = await supabase
          .from('holdings')
          .update({ target_allocation: isFinite(value) ? value : null })
          .eq('id', h.id);
        if (error) throw error;
      }
      await refetchPortfolio?.();
      toast.success('Target weights saved');
    } catch (e: any) {
      toast.error(e?.message || 'Could not save target weights');
    } finally {
      setSaving(false);
    }
  };

  if (holdings.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No holdings yet</h3>
          <p className="text-muted-foreground">Add positions to plan target weights and rebalancing.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Scale className="w-4 h-4 text-primary" />Rebalancing planner</CardTitle>
          <CardDescription>Set a target weight per holding, then see exactly what to buy with new cash — or a full rebalance with sells.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="newcash">New cash to invest</Label>
              <Input id="newcash" inputMode="decimal" value={newCash} onChange={e => setNewCash(e.target.value)} className="mt-1 w-36" />
            </div>
            <div className="flex gap-2">
              <Button variant={mode === 'cash' ? 'default' : 'outline'} size="sm" onClick={() => setMode('cash')}>Buy only (new cash)</Button>
              <Button variant={mode === 'full' ? 'default' : 'outline'} size="sm" onClick={() => setMode('full')}>Full rebalance</Button>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={setEqualWeights}><Wand2 className="w-4 h-4 mr-2" />Equal weight</Button>
              <Button variant="outline" size="sm" onClick={normalize}>Scale to 100%</Button>
              <Button size="sm" onClick={saveTargets} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save targets
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Targets total</span>
            <Badge variant={Math.abs(targetSum - 100) < 0.5 ? 'outline' : 'destructive'}>{targetSum.toFixed(2)}%</Badge>
            <span className="text-muted-foreground">· Portfolio value {money(totalValue)}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="py-2 pr-3">Holding</th>
                  <th className="py-2 pr-3 text-right">Current %</th>
                  <th className="py-2 pr-3 text-right">Target %</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const price = h.currentPrice || h.avgPrice || 0;
                  const currentPct = totalValue > 0 ? ((h.shares * price) / totalValue) * 100 : 0;
                  return (
                    <tr key={h.id} className="border-b border-muted">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{cleanSymbol(h.symbol)}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{h.name}</div>
                      </td>
                      <td className="py-2 pr-3 text-right">{currentPct.toFixed(2)}%</td>
                      <td className="py-2 pr-3 text-right">
                        <Input
                          inputMode="decimal"
                          aria-label={`Target weight for ${cleanSymbol(h.symbol)}`}
                          value={targets[h.id] ?? ''}
                          onChange={e => setTargets(prev => ({ ...prev, [h.id]: e.target.value }))}
                          className="w-20 ml-auto text-right h-8"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Suggested trades</CardTitle>
          <CardDescription>
            {mode === 'cash'
              ? `Allocating ${money(cash)} of new cash towards your targets — no sells required.`
              : 'Full rebalance back to your target weights, including sells.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scaledPlan.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
              <Info className="w-4 h-4" /> Your portfolio already matches the target weights.
            </div>
          ) : (
            <div className="space-y-2">
              {scaledPlan.map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={r.action === 'BUY' ? 'default' : 'destructive'}>{r.action}</Badge>
                    <div>
                      <div className="font-medium">{r.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.currentPct.toFixed(2)}% <ArrowRight className="w-3 h-3 inline" /> {r.targetPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{Math.abs(r.shares).toFixed(4)} shares</div>
                    <div className="text-xs text-muted-foreground">{money(Math.abs(r.delta))} @ {money(r.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RebalancePlanner;
