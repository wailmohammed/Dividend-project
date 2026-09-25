import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, AlertTriangle, Search, TrendingUp, TrendingDown, Shield, DollarSign } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Holding } from '@/types';

interface CheckItem {
  label: string;
  pass: boolean;
  detail: string;
  category: 'value' | 'growth' | 'health' | 'dividend' | 'risk';
}

const getChecklist = (h: Holding): CheckItem[] => {
  const items: CheckItem[] = [];
  const snowflake = h.snowflake;
  const totalReturn = ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100;

  // Value checks
  items.push({
    label: 'Trading below fair value',
    pass: snowflake.value >= 3,
    detail: snowflake.value >= 3 ? `Value score ${snowflake.value}/5 — appears undervalued` : `Value score ${snowflake.value}/5 — may be overvalued`,
    category: 'value',
  });
  items.push({
    label: 'Good value vs peers',
    pass: snowflake.value >= 4,
    detail: snowflake.value >= 4 ? 'Strong value compared to industry peers' : 'Value is average or below compared to peers',
    category: 'value',
  });

  // Growth checks
  items.push({
    label: 'Earnings expected to grow',
    pass: snowflake.future >= 3,
    detail: snowflake.future >= 3 ? `Future score ${snowflake.future}/5 — positive growth outlook` : `Future score ${snowflake.future}/5 — limited growth expected`,
    category: 'growth',
  });
  items.push({
    label: 'Revenue growing faster than market',
    pass: snowflake.past >= 4,
    detail: snowflake.past >= 4 ? 'Strong historical performance above market average' : 'Historical growth has been average or below',
    category: 'growth',
  });

  // Health checks
  items.push({
    label: 'Healthy balance sheet',
    pass: snowflake.health >= 3,
    detail: snowflake.health >= 3 ? `Health score ${snowflake.health}/5 — solid financial position` : `Health score ${snowflake.health}/5 — financial health concerns`,
    category: 'health',
  });
  items.push({
    label: 'Well-covered by assets',
    pass: snowflake.health >= 4,
    detail: snowflake.health >= 4 ? 'Strong asset coverage relative to liabilities' : 'Asset coverage could be improved',
    category: 'health',
  });

  // Dividend checks
  if (h.dividendYield > 0) {
    items.push({
      label: 'Paying a reliable dividend',
      pass: snowflake.dividend >= 3,
      detail: `${h.dividendYield.toFixed(2)}% yield — ${snowflake.dividend >= 3 ? 'reliable payer' : 'dividend may not be sustainable'}`,
      category: 'dividend',
    });
    items.push({
      label: 'Dividend yield above market average',
      pass: h.dividendYield > 2,
      detail: h.dividendYield > 2 ? `${h.dividendYield.toFixed(2)}% is above market avg of ~2%` : `${h.dividendYield.toFixed(2)}% is below market average`,
      category: 'dividend',
    });
  }

  // Risk checks
  items.push({
    label: 'Position is profitable',
    pass: totalReturn > 0,
    detail: totalReturn > 0 ? `Up ${totalReturn.toFixed(1)}% from cost basis` : `Down ${Math.abs(totalReturn).toFixed(1)}% from cost basis`,
    category: 'risk',
  });
  items.push({
    label: 'Safety score is adequate',
    pass: h.safetyScore >= 50,
    detail: `Safety score: ${h.safetyScore}/100 — ${h.safetyScore >= 50 ? 'acceptable risk level' : 'elevated risk'}`,
    category: 'risk',
  });

  return items;
};

const categoryIcons: Record<string, React.ReactNode> = {
  value: <DollarSign className="w-4 h-4" />,
  growth: <TrendingUp className="w-4 h-4" />,
  health: <Shield className="w-4 h-4" />,
  dividend: <DollarSign className="w-4 h-4" />,
  risk: <AlertTriangle className="w-4 h-4" />,
};

const categoryLabels: Record<string, string> = {
  value: 'Value',
  growth: 'Growth',
  health: 'Financial Health',
  dividend: 'Dividend',
  risk: 'Risk',
};

const RisksRewardsChecklist: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];
  const [search, setSearch] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const filteredHoldings = useMemo(() =>
    holdings.filter(h => h.symbol.toLowerCase().includes(search.toLowerCase()) || h.name.toLowerCase().includes(search.toLowerCase())),
    [holdings, search]
  );

  const activeHolding = selectedSymbol ? holdings.find(h => h.symbol === selectedSymbol) : filteredHoldings[0];
  const checklist = activeHolding ? getChecklist(activeHolding) : [];
  const rewards = checklist.filter(c => c.pass);
  const risks = checklist.filter(c => !c.pass);

  const categories = ['value', 'growth', 'health', 'dividend', 'risk'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Risks & Rewards</h2>
        <p className="text-muted-foreground">Green/red flag checklist for each stock — inspired by Simply Wall St</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Stock selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredHoldings.map(h => {
                const checks = getChecklist(h);
                const passCount = checks.filter(c => c.pass).length;
                return (
                  <button
                    key={h.symbol}
                    onClick={() => setSelectedSymbol(h.symbol)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
                      activeHolding?.symbol === h.symbol ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium">{h.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[120px]">{h.name}</div>
                    </div>
                    <Badge variant={passCount >= checks.length * 0.7 ? 'default' : passCount >= checks.length * 0.4 ? 'secondary' : 'destructive'} className="text-xs">
                      {passCount}/{checks.length}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <div className="lg:col-span-3 space-y-4">
          {activeHolding ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{activeHolding.symbol} — {activeHolding.name}</CardTitle>
                      <CardDescription>{activeHolding.sector} · {activeHolding.assetType}</CardDescription>
                    </div>
                    <div className="flex gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{rewards.length}</div>
                        <div className="text-xs text-muted-foreground">Rewards</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{risks.length}</div>
                        <div className="text-xs text-muted-foreground">Risks</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Rewards */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" /> Rewards ({rewards.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rewards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No green flags identified</p>
                  ) : rewards.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                      </div>
                      <Badge variant="outline" className="text-xs ml-auto shrink-0">{categoryLabels[item.category]}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Risks */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                    <XCircle className="w-5 h-5" /> Risks ({risks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No red flags identified</p>
                  ) : risks.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
                      <XCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                      </div>
                      <Badge variant="outline" className="text-xs ml-auto shrink-0">{categoryLabels[item.category]}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* By Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map(cat => {
                  const items = checklist.filter(c => c.category === cat);
                  if (items.length === 0) return null;
                  const passed = items.filter(c => c.pass).length;
                  return (
                    <Card key={cat}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          {categoryIcons[cat]}
                          <span className="font-medium text-sm">{categoryLabels[cat]}</span>
                          <Badge variant={passed === items.length ? 'default' : passed > 0 ? 'secondary' : 'destructive'} className="ml-auto text-xs">
                            {passed}/{items.length}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {item.pass ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              <span className="text-muted-foreground">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Add holdings to your portfolio to see their risk/reward analysis
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default RisksRewardsChecklist;
