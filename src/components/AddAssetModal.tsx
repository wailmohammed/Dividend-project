import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, TrendingUp, DollarSign, Calendar, Car, Home, CreditCard, Landmark, Globe, Briefcase, Loader2 } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { ManualAssetType } from '../types';
import { EXCHANGE_RATES } from '../services/marketData';
import { supabase } from '@/integrations/supabase/client';

interface SearchAsset {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  assetType: string;
}

type ModalTab = 'investment' | 'asset' | 'liability';

const AddAssetModal: React.FC = () => {
  const { closeAddAssetModal, addTransaction, addManualAsset, addLiability, preSelectedAssetTicker, portfolios, activePortfolioId } = usePortfolio();
  const [activeTab, setActiveTab] = useState<ModalTab>('investment');

  // Portfolio Selection
  const [targetPortfolioId, setTargetPortfolioId] = useState(activePortfolioId);

  // Investment State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchResults, setSearchResults] = useState<SearchAsset[]>([]);
  const [popularAssets, setPopularAssets] = useState<SearchAsset[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Manual Asset State
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<ManualAssetType>('Real Estate');
  const [assetValue, setAssetValue] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [assetCurrency, setAssetCurrency] = useState('USD');

  // Liability State
  const [liabilityName, setLiabilityName] = useState('');
  const [liabilityType, setLiabilityType] = useState('Mortgage');
  const [liabilityAmount, setLiabilityAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');

  useEffect(() => {
      if (activePortfolioId) setTargetPortfolioId(activePortfolioId);
  }, [activePortfolioId]);

  // Fetch popular assets on mount
  useEffect(() => {
    const fetchPopular = async () => {
      const { data } = await supabase
        .from('market_data_cache')
        .select('symbol, price, sector')
        .order('market_cap', { ascending: false, nullsFirst: false })
        .limit(5);
      if (data && data.length > 0) {
        setPopularAssets(data.map(r => ({
          id: r.symbol,
          symbol: r.symbol,
          name: r.symbol,
          currentPrice: Number(r.price) || 0,
          assetType: 'Stock',
        })));
      }
    };
    fetchPopular();
  }, []);

  // Search market_data_cache + holdings
  const searchAssets = useCallback(async (term: string) => {
    if (!term || term.length < 1) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const upperTerm = term.toUpperCase();
      // Search market_data_cache
      const { data: cacheData } = await supabase
        .from('market_data_cache')
        .select('symbol, price, sector')
        .ilike('symbol', `%${upperTerm}%`)
        .limit(10);
      
      // Also search holdings for names
      const { data: holdingsData } = await supabase
        .from('holdings')
        .select('symbol, name, current_price, asset_type')
        .or(`symbol.ilike.%${upperTerm}%,name.ilike.%${term}%`)
        .limit(10);

      const assetMap = new Map<string, SearchAsset>();
      
      holdingsData?.forEach(h => {
        assetMap.set(h.symbol, {
          id: h.symbol,
          symbol: h.symbol,
          name: h.name,
          currentPrice: Number(h.current_price) || 0,
          assetType: h.asset_type || 'Stock',
        });
      });
      
      cacheData?.forEach(r => {
        if (!assetMap.has(r.symbol)) {
          assetMap.set(r.symbol, {
            id: r.symbol,
            symbol: r.symbol,
            name: r.symbol,
            currentPrice: Number(r.price) || 0,
            assetType: 'Stock',
          });
        }
      });
      
      setSearchResults(Array.from(assetMap.values()).slice(0, 6));
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchAssets(searchTerm), 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, searchAssets]);

  // Pre-select asset if ticker is passed
  useEffect(() => {
    if (preSelectedAssetTicker) {
      setSelectedAssetId(preSelectedAssetTicker);
      setActiveTab('investment');
      // Fetch price for pre-selected
      supabase.from('market_data_cache').select('price').eq('symbol', preSelectedAssetTicker).maybeSingle().then(({ data }) => {
        if (data?.price) setPrice(String(data.price));
      });
    }
  }, [preSelectedAssetTicker]);

  const displayResults = searchTerm ? searchResults : popularAssets;
  const selectedAsset = selectedAssetId
    ? (searchResults.find(a => a.id === selectedAssetId) || popularAssets.find(a => a.id === selectedAssetId) || { id: selectedAssetId, symbol: selectedAssetId, name: selectedAssetId, currentPrice: parseFloat(price) || 0, assetType: 'Stock' })
    : null;

  const handleInvestmentSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedAssetId && shares && price) {
          addTransaction(selectedAssetId, 'BUY', parseFloat(shares), parseFloat(price), date, targetPortfolioId);
          closeAddAssetModal();
      }
  };

  const handleAssetSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (assetName && assetValue) {
          addManualAsset({
              name: assetName,
              type: assetType,
              value: parseFloat(assetValue),
              currency: assetCurrency,
              purchaseDate: date,
              purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined
          }, targetPortfolioId);
          closeAddAssetModal();
      }
  };

  const handleLiabilitySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (liabilityName && liabilityAmount) {
          addLiability({
              name: liabilityName,
              type: liabilityType as 'Mortgage' | 'Loan' | 'Credit Card' | 'Other',
              amount: parseFloat(liabilityAmount),
              interestRate: parseFloat(interestRate) || 0,
              monthlyPayment: parseFloat(monthlyPayment) || 0
          }, targetPortfolioId);
          closeAddAssetModal();
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
            <h3 className="text-xl font-bold text-white">Add to Portfolio</h3>
            <button onClick={closeAddAssetModal} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
            <button
                onClick={() => setActiveTab('investment')}
                className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'investment' ? 'bg-slate-800 text-white border-b-2 border-brand-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
            >
                <TrendingUp className="w-4 h-4" /> Investment
            </button>
            <button
                onClick={() => setActiveTab('asset')}
                className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'asset' ? 'bg-slate-800 text-white border-b-2 border-brand-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
            >
                <Home className="w-4 h-4" /> Asset
            </button>
            <button
                onClick={() => setActiveTab('liability')}
                className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'liability' ? 'bg-slate-800 text-white border-b-2 border-brand-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
            >
                <CreditCard className="w-4 h-4" /> Liability
            </button>
        </div>

        <div className="p-6 overflow-y-auto">
            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Target Portfolio</label>
                <div className="relative">
                    <Briefcase className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <select
                        value={targetPortfolioId}
                        onChange={(e) => setTargetPortfolioId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none appearance-none cursor-pointer"
                    >
                        {portfolios.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* INVESTMENT TAB */}
            {activeTab === 'investment' && (
                !selectedAsset ? (
                    <div className="space-y-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search by symbol or name..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {searchTerm ? (searchLoading ? 'Searching...' : 'Search Results') : 'Popular Assets'}
                            </div>
                            {searchLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>}
                            {displayResults.map(asset => (
                                <button
                                    key={asset.id}
                                    onClick={() => {
                                        setSelectedAssetId(asset.id);
                                        setPrice(asset.currentPrice.toString());
                                    }}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-800 rounded-xl transition-colors group text-left border border-transparent hover:border-slate-700"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-400 border border-slate-700 group-hover:border-brand-500/30 group-hover:text-brand-400 transition-colors">
                                            {asset.symbol[0]}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{asset.symbol}</div>
                                            <div className="text-xs text-slate-500">{asset.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-medium text-white">${asset.currentPrice}</div>
                                        <div className="text-xs text-emerald-400 flex items-center justify-end gap-1">
                                            <Plus className="w-3 h-3" /> Add
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {searchTerm && !searchLoading && searchResults.length === 0 && (
                                <div className="text-center py-8 text-slate-500">No assets found.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Step 2: Investment Details */
                    <form onSubmit={handleInvestmentSubmit} className="space-y-6 animate-fade-in">
                        <div className="flex items-center gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                            <div className="w-12 h-12 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-brand-600/20">
                                {selectedAsset.symbol[0]}
                            </div>
                            <div className="flex-1">
                                <div className="text-lg font-bold text-white">{selectedAsset.name}</div>
                                <div className="text-sm text-slate-400">{selectedAsset.symbol} • {selectedAsset.assetType}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAssetId(null)}
                                className="text-xs text-brand-400 hover:underline"
                            >
                                Change
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">Quantity</label>
                                <div className="relative">
                                    <TrendingUp className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                        placeholder="0.00"
                                        value={shares}
                                        onChange={e => setShares(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">Price per Share</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                        placeholder="0.00"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none [color-scheme:dark]"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <div className="flex justify-between text-sm mb-4 px-2">
                                <span className="text-slate-400">Total Cost</span>
                                <span className="font-bold text-white text-lg">
                                    ${(parseFloat(shares || '0') * parseFloat(price || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" /> Add Transaction
                            </button>
                        </div>
                    </form>
                )
            )}

            {/* ASSET TAB */}
            {activeTab === 'asset' && (
                <form onSubmit={handleAssetSubmit} className="space-y-5 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Asset Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                            placeholder="e.g. Downtown Apartment, Rolex Submariner"
                            value={assetName}
                            onChange={e => setAssetName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                value={assetType}
                                onChange={e => setAssetType(e.target.value as ManualAssetType)}
                            >
                                <option value="Real Estate">Real Estate</option>
                                <option value="Vehicle">Vehicle</option>
                                <option value="Art/Collectibles">Art/Collectibles</option>
                                <option value="Private Equity">Private Equity</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Current Value</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                <input
                                    type="number"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                    placeholder="0.00"
                                    value={assetValue}
                                    onChange={e => setAssetValue(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Currency</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                    value={assetCurrency}
                                    onChange={e => setAssetCurrency(e.target.value)}
                                >
                                    {Object.keys(EXCHANGE_RATES).map(curr => (
                                        <option key={curr} value={curr}>{curr}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Purchase Price</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                    placeholder="Optional"
                                    value={purchasePrice}
                                    onChange={e => setPurchasePrice(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Purchase Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                            <input
                                type="date"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none [color-scheme:dark]"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 mt-4"
                    >
                        <Plus className="w-5 h-5" /> Add Asset
                    </button>
                </form>
            )}

            {/* LIABILITY TAB */}
            {activeTab === 'liability' && (
                <form onSubmit={handleLiabilitySubmit} className="space-y-5 animate-fade-in">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Liability Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                            placeholder="e.g. Chase Mortgage, Student Loan"
                            value={liabilityName}
                            onChange={e => setLiabilityName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
                            <select
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 outline-none"
                                value={liabilityType}
                                onChange={e => setLiabilityType(e.target.value as any)}
                            >
                                <option value="Mortgage">Mortgage</option>
                                <option value="Loan">Loan</option>
                                <option value="Credit Card">Credit Card</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Amount Owed</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                <input
                                    type="number"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                    placeholder="0.00"
                                    value={liabilityAmount}
                                    onChange={e => setLiabilityAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Interest Rate (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:border-brand-500 outline-none"
                                placeholder="e.g. 4.5"
                                value={interestRate}
                                onChange={e => setInterestRate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1.5">Monthly Payment</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-500 outline-none"
                                    placeholder="Optional"
                                    value={monthlyPayment}
                                    onChange={e => setMonthlyPayment(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 mt-4"
                    >
                        <Plus className="w-5 h-5" /> Add Liability
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default AddAssetModal;
