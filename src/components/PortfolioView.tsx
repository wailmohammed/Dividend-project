import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, ComposedChart, Legend, Treemap } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { PieChart as PieIcon, List, Layers, Globe, Download, Map as MapIcon, History, TrendingUp, Scale, AlertCircle, RefreshCcw, LayoutGrid, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Home, Car, Watch, DollarSign, ArrowUp, ArrowDown, ArrowUpDown, Plus, Pencil, Trash2, X, Save, Eye, RefreshCw, Clock, CheckCircle, XCircle, FlaskConical, Shield } from 'lucide-react';
import ProofOfWealthModal from './ProofOfWealthModal';
import SnowflakeChart from './SnowflakeChart';
import PortfolioBenchmark from './PortfolioBenchmark';
import PortfolioOverviewTab from './PortfolioOverviewTab';
import { Holding } from '../types';
import { convertToUSD } from '../services/marketData';
import { cleanSymbol } from '@/lib/utils';
import { useBrokerSync } from '@/hooks/useBrokerSync';
import { useBrokerConnections } from '@/hooks/useBrokerConnections';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Alert, AlertDescription } from './ui/alert';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Moved CustomContent outside to prevent re-creation on render
const CustomizedContent = (props: any) => {
    const { x, y, width, height, index, payload, name, size, totalValue } = props;

    // Robust dimension check - allow rendering if we have valid dimensions
    if (
        typeof x !== 'number' ||
        typeof y !== 'number' ||
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height) ||
        width <= 0 || height <= 0
    ) {
        return <g />;
    }

    const fill = payload?.fill || COLORS[(index || 0) % COLORS.length] || '#6366f1';

    // Calculation with finite check - use size from props or payload
    const displaySize = size || payload?.size || 0;
    const percent = (totalValue > 0 && Number.isFinite(displaySize)) ? (displaySize / totalValue) * 100 : 0;
    const percentStr = Number.isFinite(percent) ? `${percent.toFixed(1)}%` : '0%';
    const displayName = name || payload?.name || '';

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fill,
            stroke: 'hsl(var(--border))',
            strokeWidth: 2,
            strokeOpacity: 0.5,
          }}
          rx={4}
        />
        {width > 50 && height > 30 && displayName && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontWeight="bold"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
          >
            {displayName}
          </text>
        )}
        {width > 50 && height > 50 && (
           <text
            x={x + width / 2}
            y={y + height / 2 + 14}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fillOpacity={0.9}
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
          >
            {percentStr}
          </text>
        )}
      </g>
    );
};

const PortfolioView: React.FC = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio, viewStock, openAddAssetModal, updateHolding, deleteHolding } = usePortfolio();
  const { syncing, syncAllBrokers, lastSyncResult } = useBrokerSync();
  const { connections } = useBrokerConnections();
  const [viewMode, setViewMode] = useState<'overview' | 'allocation' | 'holdings' | 'transactions' | 'performance' | 'rebalancing' | 'proof-of-wealth'>('overview');
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [holdingViewType, setHoldingViewType] = useState<'list' | 'cards'>('cards');

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Edit Holding State
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editShares, setEditShares] = useState<string>('');
  const [editAvgPrice, setEditAvgPrice] = useState<string>('');

  // Rebalancing State
  const [localTargets, setLocalTargets] = useState<Record<string, number>>({});
  const [totalTarget, setTotalTarget] = useState(0);

  // Defensive access to portfolio data
  const holdings = activePortfolio?.holdings || [];
  const transactions = activePortfolio?.transactions || [];
  const manualAssets = activePortfolio?.manualAssets || [];

  // Initialize targets from holdings
  useEffect(() => {
      const initialTargets: Record<string, number> = {};
      holdings.forEach(h => {
          initialTargets[h.id] = h.targetAllocation || 0;
      });
      setLocalTargets(initialTargets);
  }, [holdings]);

  // Update Total Target % sum
  useEffect(() => {
      const sum = Object.values(localTargets).reduce((a: number, b: number) => a + b, 0);
      setTotalTarget(sum);
  }, [localTargets]);

  const handleTargetChange = (id: string, val: string) => {
      const num = parseFloat(val);
      setLocalTargets(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  // Sorting Logic
  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const sortedHoldings = useMemo(() => {
      if (!sortConfig) return holdings;

      return [...holdings].sort((a, b) => {
          let aValue: any = a[sortConfig.key as keyof Holding];
          let bValue: any = b[sortConfig.key as keyof Holding];

          // Handle computed fields that aren't direct properties
          if (sortConfig.key === 'value') {
              aValue = (a.shares || 0) * (a.currentPrice || 0);
              bValue = (b.shares || 0) * (b.currentPrice || 0);
          } else if (sortConfig.key === 'return') {
              aValue = ((a.shares || 0) * (a.currentPrice || 0)) - ((a.shares || 0) * (a.avgPrice || 0));
              bValue = ((b.shares || 0) * (b.currentPrice || 0)) - ((b.shares || 0) * (b.avgPrice || 0));
          } else if (sortConfig.key === 'snowflake') {
              aValue = a.snowflake?.total || 0;
              bValue = b.snowflake?.total || 0;
          }

          // Handle undefined/null safely for imported data
          if (aValue === undefined || aValue === null) aValue = 0;
          if (bValue === undefined || bValue === null) bValue = 0;

          // Handle Strings vs Numbers
          if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortConfig.direction === 'asc'
                  ? aValue.localeCompare(bValue)
                  : bValue.localeCompare(aValue);
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [holdings, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
      if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
      return sortConfig.direction === 'asc'
          ? <ArrowUp className="w-3 h-3 text-brand-500" />
          : <ArrowDown className="w-3 h-3 text-brand-500" />;
  };

  // Calculations, helpers

  // Portfolio Snowflake (Weighted Average)
  const calculatePortfolioSnowflake = () => {
    if (!activePortfolio || !activePortfolio.holdings || !activePortfolio.totalValue || activePortfolio.totalValue <= 0) {
        return { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };
    }

    const acc = { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };

    activePortfolio.holdings.forEach(h => {
        const val = (h.shares || 0) * (h.currentPrice || 0);
        const weight = (val > 0 && activePortfolio.totalValue > 0) ? val / activePortfolio.totalValue : 0;
        const sf = h.snowflake || { value: 0, future: 0, past: 0, health: 0, dividend: 0, total: 0 };

        acc.value += (sf.value || 0) * weight;
        acc.future += (sf.future || 0) * weight;
        acc.past += (sf.past || 0) * weight;
        acc.health += (sf.health || 0) * weight;
        acc.dividend += (sf.dividend || 0) * weight;
        acc.total += (sf.total || 0) * weight;
    });

    return {
        value: Math.round(acc.value) || 0,
        future: Math.round(acc.future) || 0,
        past: Math.round(acc.past) || 0,
        health: Math.round(acc.health) || 0,
        dividend: Math.round(acc.dividend) || 0,
        total: Math.round(acc.total) || 0
    };
  };

  const portfolioSnowflake = calculatePortfolioSnowflake();

  // Calculate Allocation Data
  const sectorDataMap = new Map<string, number>();
  const assetDataMap = new Map<string, number>();
  const countryDataMap = new Map<string, number>();

  holdings.forEach(h => {
      const val = (h.shares || 0) * (h.currentPrice || 0);
      if (isNaN(val) || val <= 0) return;

      const sector = h.sector || 'Unknown';
      const country = h.country || 'Unknown';
      const type = h.assetType || 'Stock';

      sectorDataMap.set(sector, (sectorDataMap.get(sector) || 0) + val);
      assetDataMap.set(type, (assetDataMap.get(type) || 0) + val);
      countryDataMap.set(country, (countryDataMap.get(country) || 0) + val);
  });

  // Helper to convert map to filtered array for charts
  const prepareChartData = (map: Map<string, number>) => {
      return Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .filter(item => item.value > 0.01 && Number.isFinite(item.value))
          .sort((a, b) => b.value - a.value);
  };

  const sectorData = prepareChartData(sectorDataMap);
  const assetData = prepareChartData(assetDataMap);
  const countryData = prepareChartData(countryDataMap);

  // Prepare Treemap Data - Use individual holdings for better visualization
  // Use currentPrice, fallback to avgPrice. If both are 0/missing, use shares * 1 as minimum visual
  const treemapData = holdings
      .map((h, index) => {
          const currentP = h.currentPrice && h.currentPrice > 0 ? h.currentPrice : 0;
          const avgP = h.avgPrice && h.avgPrice > 0 ? h.avgPrice : 0;
          const price = currentP > 0 ? currentP : (avgP > 0 ? avgP : 1); // fallback to 1 for visual
          const shares = h.shares || 0;
          const value = shares * price;
          return {
              name: cleanSymbol(h.symbol),
              fullName: h.name,
              size: value > 0 ? value : shares, // At minimum show by share count
              fill: COLORS[index % COLORS.length]
          };
      })
      .filter(item => item.size > 0 && Number.isFinite(item.size))
      .sort((a, b) => b.size - a.size);

  // Generate Mock Performance Data
  const generateChartData = () => {
      const data = [];
      let currentVal = activePortfolio && activePortfolio.totalValue > 0 ? activePortfolio.totalValue * 0.82 : 10000;
      let currentBench = activePortfolio && activePortfolio.totalValue > 0 ? activePortfolio.totalValue * 0.88 : 10000;

      for(let i=0; i<365; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (365 - i));
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const move = 1 + (Math.random() * 0.03 - 0.014);
          const benchMove = 1 + (Math.random() * 0.02 - 0.0095);

          currentVal = currentVal * move;
          currentBench = currentBench * benchMove;

          if (i > 350 && activePortfolio && activePortfolio.totalValue > 0) {
              currentVal = currentVal + (activePortfolio.totalValue - currentVal) / (365 - i);
          }

          data.push({
              date: dateStr,
              value: Math.round(currentVal),
              benchmark: Math.round(currentBench)
          });
      }
      return data;
  };

  const chartData = generateChartData();

  const handleExport = () => {
      const headers = ['Symbol,Name,Shares,AvgPrice,CurrentPrice,Value,Sector,Country'];
      const rows = holdings.map(h =>
        `${h.symbol},"${h.name}",${h.shares},${h.avgPrice},${h.currentPrice},${h.shares * h.currentPrice},${h.sector},${h.country}`
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `wealthos_${activePortfolio.name.replace(/\s/g,'_')}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Edit Helpers
  const openEditModal = (e: React.MouseEvent, holding: Holding) => {
      e.stopPropagation();
      setEditingHolding(holding);
      setEditShares(holding.shares.toString());
      setEditAvgPrice(holding.avgPrice.toString());
  };

  const closeEditModal = () => {
      setEditingHolding(null);
      setEditShares('');
      setEditAvgPrice('');
  };

  const saveHoldingEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingHolding) {
          const shares = parseFloat(editShares);
          const avgPrice = parseFloat(editAvgPrice);

          if (!isNaN(shares) && !isNaN(avgPrice)) {
              await updateHolding(editingHolding.id, { shares, avgPrice });
              closeEditModal();
          }
      }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      deleteHolding(id);
  };

  // Helpers
  const getValuationStatus = (h: Holding) => {
      const score = h.snowflake?.value || 3;
      if(score >= 5) return { label: 'Significantly Undervalued', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
      if(score >= 4) return { label: 'Undervalued', color: 'text-emerald-300', bg: 'bg-emerald-300/10' };
      if(score === 3) return { label: 'Fair Value', color: 'text-slate-400 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700/50' };
      if(score === 2) return { label: 'Overvalued', color: 'text-amber-400', bg: 'bg-amber-400/10' };
      return { label: 'High Valuation', color: 'text-red-400', bg: 'bg-red-400/10' };
  };

  const getAssetIcon = (type: string) => {
      switch (type) {
          case 'Real Estate': return <Home className="w-4 h-4 text-emerald-500" />;
          case 'Vehicle': return <Car className="w-4 h-4 text-blue-500" />;
          case 'Art/Collectibles': return <Watch className="w-4 h-4 text-amber-500" />;
          default: return <DollarSign className="w-4 h-4 text-slate-500" />;
      }
  };

  if (!activePortfolio) return <div className="p-12 text-center text-slate-500">Loading portfolio data...</div>;

  if (holdings.length === 0 && transactions.length === 0 && manualAssets.length === 0) {
      return (
          <div className="max-w-6xl mx-auto animate-fade-in text-center py-20">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <List className="w-8 h-8 text-slate-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Portfolio is Empty</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">Start by adding your first transaction to track your wealth.</p>
                  <button
                      onClick={() => openAddAssetModal()}
                      className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                      <Plus className="w-5 h-5" /> Add First Asset
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6 pb-20">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample portfolio data. Sign in to manage your real investments.
          </AlertDescription>
        </Alert>
      )}
      {/* Header Controls - simplified for now */}
      {/* Sync Status Banner */}
      {connections.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${connections.some(c => c.status === 'connected') ? 'bg-emerald-500' : connections.some(c => c.status === 'syncing') ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {connections.filter(c => c.status === 'connected').length} Broker{connections.filter(c => c.status === 'connected').length !== 1 ? 's' : ''} Connected
                </span>
                {connections.some(c => c.last_sync) && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last synced {formatDistanceToNow(new Date(connections.find(c => c.last_sync)?.last_sync || ''), { addSuffix: true })}
                  </span>
                )}
              </div>
              {connections.some(c => c.sync_error) && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {connections.find(c => c.sync_error)?.sync_error}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => activePortfolio?.id && syncAllBrokers(activePortfolio.id)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Portfolio</h1>
        <div className="flex flex-wrap items-center gap-3">
            <button
                onClick={() => activePortfolio?.id && syncAllBrokers(activePortfolio.id)}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
                onClick={() => openAddAssetModal()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-brand text-brand-foreground hover:bg-brand/90 transition-colors shadow-lg shadow-brand/20"
            >
                <Plus className="w-4 h-4" /> Add Asset
            </button>
            <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card text-foreground hover:bg-muted border border-border transition-colors shadow-sm"
            >
                <Download className="w-4 h-4" /> Export
            </button>
            <div className="flex bg-muted p-1 rounded-lg border border-border overflow-x-auto">
                <button
                    onClick={() => setViewMode('overview')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'overview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Eye className="w-4 h-4" /> Overview
                </button>
                <button
                    onClick={() => setViewMode('allocation')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'allocation' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <PieIcon className="w-4 h-4" /> Allocation
                </button>
                <button
                    onClick={() => setViewMode('performance')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'performance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <History className="w-4 h-4" /> Performance
                </button>
                <button
                    onClick={() => setViewMode('holdings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'holdings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> Holdings
                </button>
                <button
                    onClick={() => setViewMode('proof-of-wealth')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${viewMode === 'proof-of-wealth' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <Shield className="w-4 h-4" /> Proof of Wealth
                </button>
            </div>
        </div>
      </div>

      {/* OVERVIEW VIEW */}
      {viewMode === 'overview' && (
        <PortfolioOverviewTab />
      )}

      {/* ALLOCATION VIEW */}
      {viewMode === 'allocation' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in mb-6">
                {/* Sector Allocation */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" /> Sector Exposure
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={sectorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {sectorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                        {sectorData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-foreground/80 truncate">{entry.name}</span>
                                <span className="text-muted-foreground ml-auto">
                                    {activePortfolio.totalValue > 0 && Number.isFinite(entry.value) ? Math.round((entry.value / activePortfolio.totalValue) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Geographical Allocation */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-emerald-500" /> Geography
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={countryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {countryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                        {countryData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}></div>
                                <span className="text-foreground/80 truncate">{entry.name}</span>
                                <span className="text-muted-foreground ml-auto">
                                    {activePortfolio.totalValue > 0 && Number.isFinite(entry.value) ? Math.round((entry.value / activePortfolio.totalValue) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Asset Class */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-amber-500" /> Asset Class
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {assetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))', borderRadius: '8px' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-4">
                        {assetData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[(index + 5) % COLORS.length] }}></div>
                                <span className="text-foreground/80 truncate">{entry.name}</span>
                                <span className="text-muted-foreground ml-auto">
                                    {activePortfolio.totalValue > 0 && Number.isFinite(entry.value) ? Math.round((entry.value / activePortfolio.totalValue) * 100) : 0}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Asset Treemap */}
            {treemapData.length > 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 animate-fade-in shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-primary" /> Asset Allocation Map
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                data={treemapData}
                                dataKey="size"
                                aspectRatio={4 / 3}
                                stroke="hsl(var(--border))"
                                content={<CustomizedContent totalValue={activePortfolio.totalValue > 0 ? activePortfolio.totalValue : treemapData.reduce((s, d) => s + d.size, 0)} />}
                            >
                                <RechartsTooltip
                                    contentStyle={{ 
                                      backgroundColor: 'hsl(var(--popover))', 
                                      borderColor: 'hsl(var(--border))', 
                                      color: 'hsl(var(--popover-foreground))', 
                                      borderRadius: '8px' 
                                    }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                                    labelFormatter={(label) => label}
                                />
                            </Treemap>
                        </ResponsiveContainer>
                    </div>
                </div>
            ) : holdings.length > 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 animate-fade-in shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-primary" /> Asset Allocation Map
                    </h3>
                    <div className="h-[300px] flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                            <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Waiting for price data</p>
                            <p className="text-sm">Current prices are needed to display the allocation map</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl p-12 animate-fade-in shadow-sm text-center">
                    <div className="text-muted-foreground mb-2">No allocation data available</div>
                    <div className="text-sm text-muted-foreground/70">Add assets with value greater than $0 to see the map.</div>
                </div>
            )}
          </>
      )}

      {/* PERFORMANCE VIEW - With Benchmarking */}
      {viewMode === 'performance' && (
          <div className="animate-fade-in space-y-6">
            <PortfolioBenchmark />
          </div>
      )}

      {/* HOLDINGS VIEW - simplified*/}
      {viewMode === 'holdings' && (
          <div className="animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Holdings Overview</h2>
              <div className="space-y-4">
                {holdings.map(h => {
                  const value = (h.shares || 0) * (h.currentPrice || 0);
                  const pl = value - ((h.shares || 0) * (h.avgPrice || 0));
                  const plPercent = ((h.shares || 0) * (h.avgPrice || 0)) > 0 ? (pl / ((h.shares || 0) * (h.avgPrice || 0))) * 100 : 0;
                  const displaySymbol = cleanSymbol(h.symbol);
                  
                  return (
                    <div key={h.id} onClick={() => viewStock(h.symbol)} className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:border-brand-500 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500">
                            {displaySymbol[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{displaySymbol}</div>
                            <div className="text-xs text-slate-500">{h.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900 dark:text-white">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div className={`text-sm ${pl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {pl >= 0 ? '+' : ''}{plPercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
      )}

      {/* Edit Modal */}
      {editingHolding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-white">Edit {editingHolding.symbol}</h3>
                      <button onClick={closeEditModal} className="text-slate-400 hover:text-white">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <form onSubmit={saveHoldingEdit} className="p-6 space-y-5">
                      <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Total Shares</label>
                          <input
                              type="number"
                              step="any"
                              required
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                              value={editShares}
                              onChange={e => setEditShares(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-400 mb-1.5">Average Buy Price ($)</label>
                          <input
                              type="number"
                              step="any"
                              required
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                              value={editAvgPrice}
                              onChange={e => setEditAvgPrice(e.target.value)}
                          />
                      </div>
                      <div className="flex gap-3">
                          <button type="button" onClick={closeEditModal} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl">
                              Cancel
                          </button>
                          <button type="submit" className="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                              <Save className="w-4 h-4" /> Save
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* PROOF OF WEALTH VIEW */}
      {viewMode === 'proof-of-wealth' && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Proof of Wealth</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Generate a formal, self-attested financial statement with a signed net worth snapshot, itemized holdings annexure, and a secure shareable link.
            </p>
            <button
              onClick={() => setProofModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Shield className="w-4 h-4" /> Generate Statement
            </button>
          </div>
          <ProofOfWealthModal isOpen={proofModalOpen} onClose={() => setProofModalOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default PortfolioView;
