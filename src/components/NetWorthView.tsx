import React from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Car, Home, Watch, TrendingUp, DollarSign, Landmark, CreditCard, Percent, FlaskConical } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { convertToUSD } from '../services/marketData';
import { Alert, AlertDescription } from './ui/alert';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';

const NetWorthView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio } = usePortfolio();

  const manualAssets = activePortfolio.manualAssets || [];
  const liabilities = activePortfolio.liabilities || [];

  // Calculate Totals with Currency Conversion
  const totalManualAssetsValue = manualAssets.reduce((acc, curr) => {
      const valInUSD = convertToUSD(curr.value, curr.currency || 'USD');
      return acc + valInUSD;
  }, 0);

  const totalAssetsValue = activePortfolio.totalValue + activePortfolio.cashBalance + totalManualAssetsValue;
  const totalLiabilitiesValue = liabilities.reduce((acc, curr) => acc + curr.amount, 0);
  const netWorth = totalAssetsValue - totalLiabilitiesValue;

  // Mock Net Worth History Trend
  // Generating a more detailed historical dataset for the chart
  const netWorthHistory = [
      { date: 'Jan', assets: totalAssetsValue * 0.85, liabilities: totalLiabilitiesValue * 1.02, netWorth: (totalAssetsValue * 0.85) - (totalLiabilitiesValue * 1.02) },
      { date: 'Feb', assets: totalAssetsValue * 0.88, liabilities: totalLiabilitiesValue * 1.01, netWorth: (totalAssetsValue * 0.88) - (totalLiabilitiesValue * 1.01) },
      { date: 'Mar', assets: totalAssetsValue * 0.90, liabilities: totalLiabilitiesValue * 1.01, netWorth: (totalAssetsValue * 0.90) - (totalLiabilitiesValue * 1.01) },
      { date: 'Apr', assets: totalAssetsValue * 0.92, liabilities: totalLiabilitiesValue * 1.00, netWorth: (totalAssetsValue * 0.92) - totalLiabilitiesValue },
      { date: 'May', assets: totalAssetsValue * 0.96, liabilities: totalLiabilitiesValue * 0.99, netWorth: (totalAssetsValue * 0.96) - (totalLiabilitiesValue * 0.99) },
      { date: 'Jun', assets: totalAssetsValue * 0.98, liabilities: totalLiabilitiesValue * 0.99, netWorth: (totalAssetsValue * 0.98) - (totalLiabilitiesValue * 0.99) },
      { date: 'Jul', assets: totalAssetsValue, liabilities: totalLiabilitiesValue, netWorth: netWorth },
  ];

  const getAssetIcon = (type: string) => {
      switch (type) {
          case 'Real Estate': return <Home className="w-5 h-5 text-emerald-500" />;
          case 'Vehicle': return <Car className="w-5 h-5 text-blue-500" />;
          case 'Art/Collectibles': return <Watch className="w-5 h-5 text-amber-500" />;
          default: return <DollarSign className="w-5 h-5 text-slate-500" />;
      }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6 pb-12">
        {isDemoMode && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <FlaskConical className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>Demo Mode:</strong> Viewing sample net worth data. Sign in to track your real assets and liabilities.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between mb-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-950 dark:text-white">Total Net Worth</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Track everything you own and owe in one place.</p>
            </div>
            <div className="text-right">
                <div className="text-4xl font-bold text-slate-950 dark:text-white">${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="text-emerald-500 text-sm font-bold flex items-center justify-end gap-1">
                    <TrendingUp className="w-4 h-4" /> +12.4% YTD
                </div>
            </div>
        </div>

        {/* Historical Trend Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-[350px] shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Net Worth Trend</h3>
            <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={netWorthHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorNw" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" strokeDashoffset={2} vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px' }}
                        formatter={(value: number) => [`$${Math.round(value).toLocaleString()}`]}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Area type="monotone" name="Assets" dataKey="assets" stroke="#10b981" strokeWidth={2} fillOpacity={0} dot={false} />
                    <Area type="monotone" name="Liabilities" dataKey="liabilities" stroke="#ef4444" strokeWidth={2} fillOpacity={0} dot={false} />
                    <Area type="monotone" name="Net Worth" dataKey="netWorth" stroke="#6366f1" fillOpacity={1} fill="url(#colorNw)" strokeWidth={3} />
                </AreaChart>
            </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ASSETS COLUMN */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" /> Assets
                    <span className="ml-auto text-emerald-500">${totalAssetsValue.toLocaleString()}</span>
                </h2>

                {/* Liquid Assets Group */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">Liquid Investments</div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                         <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                     <TrendingUp className="w-4 h-4" />
                                 </div>
                                 <span className="font-bold text-slate-900 dark:text-white">Stock Portfolio</span>
                             </div>
                             <div className="font-bold text-slate-900 dark:text-white">${activePortfolio.totalValue.toLocaleString()}</div>
                         </div>
                         <div className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                     <DollarSign className="w-4 h-4" />
                                 </div>
                                 <span className="font-bold text-slate-900 dark:text-white">Cash</span>
                             </div>
                             <div className="font-bold text-slate-900 dark:text-white">${activePortfolio.cashBalance.toLocaleString()}</div>
                         </div>
                    </div>
                </div>

                {/* Physical/Manual Assets Group */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 flex justify-between">
                        <span>Physical & Alternative</span>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {manualAssets.map(asset => {
                             const valInUSD = convertToUSD(asset.value, asset.currency || 'USD');
                             return (
                                 <div key={asset.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-brand-500/50 transition-colors">
                                            {getAssetIcon(asset.type)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">{asset.name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                {asset.purchasePrice && <span>Bot: ${asset.purchasePrice.toLocaleString()}</span>}
                                                {asset.purchaseDate && <span>• {asset.purchaseDate}</span>}
                                                {asset.currency && asset.currency !== 'USD' && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-[10px]">{asset.currency}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-slate-900 dark:text-white">${valInUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        {asset.currency && asset.currency !== 'USD' && (
                                            <div className="text-xs text-slate-500">{asset.value.toLocaleString()} {asset.currency}</div>
                                        )}
                                    </div>
                                </div>
                             );
                        })}
                        {manualAssets.length === 0 && (
                            <div className="p-4 text-center text-slate-500 text-sm">No manual assets added yet.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* LIABILITIES COLUMN */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <CreditCard className="w-5 h-5 text-red-500" /> Liabilities
                    <span className="ml-auto text-red-500">-${totalLiabilitiesValue.toLocaleString()}</span>
                </h2>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                     <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 flex justify-between">
                        <span>Loans & Debt</span>
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {liabilities.map(liab => (
                            <div key={liab.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 flex items-center justify-center">
                                        {liab.type === 'Mortgage' ? <Landmark className="w-4 h-4 text-red-500 dark:text-red-400" /> : <CreditCard className="w-4 h-4 text-red-500 dark:text-red-400" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white">{liab.name}</div>
                                        <div className="text-xs text-slate-500">{liab.interestRate}% APR • ${liab.monthlyPayment}/mo</div>
                                    </div>
                                </div>
                                <div className="font-bold text-slate-900 dark:text-white">-${liab.amount.toLocaleString()}</div>
                            </div>
                        ))}
                         {liabilities.length === 0 && (
                            <div className="p-6 text-center text-slate-500 text-sm">
                                Debt free! Add a mortgage or loan to track it.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/20 flex gap-3 items-start">
                    <Percent className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Liquidity Analysis</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            Your <span className="text-slate-900 dark:text-white font-medium">Asset-to-Liability Ratio</span> is <span className="text-slate-900 dark:text-white font-medium">{(totalAssetsValue / (totalLiabilitiesValue || 1)).toFixed(2)}</span>.
                            A ratio above 2.0 is considered healthy for long-term wealth building.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default NetWorthView;
