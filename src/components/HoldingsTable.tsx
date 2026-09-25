import { useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { useTaxLots } from '@/hooks/useTaxLots';
import { useTaxLotSelling } from '@/hooks/useTaxLotSelling';
import { cleanSymbol } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { 
  ArrowUpRight, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown,
  TrendingUp, TrendingDown, Pencil, Trash2, RefreshCcw, ExternalLink, Search, Filter, X, DollarSign, CheckSquare, Square, Eye, EyeOff, Calculator
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { BulkDeleteConfirmDialog } from './BulkDeleteConfirmDialog';
import { DeleteHoldingDialog } from './holdings/DeleteHoldingDialog';
import { LotSelectionDialog, LotSelectionMethod } from './tax/LotSelectionDialog';
import { QuickAddAlertButton } from './QuickAddAlertButton';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

type StockViewFilter = 'all' | 'active' | 'sold';

export const HoldingsTable = () => {
  const { activePortfolio, viewStock, deleteHolding, loadingPortfolio, addTransaction } = usePortfolio();
  const { taxLots } = useTaxLots(activePortfolio?.id);
  const { sellWithLotSelection } = useTaxLotSelling();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'value', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');
  const [gainFilter, setGainFilter] = useState<string>('all');
  const [stockViewFilter, setStockViewFilter] = useState<StockViewFilter>('active');
  
  // Bulk delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Single delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    holding: any | null;
  }>({ open: false, holding: null });
  const [isSingleDeleting, setIsSingleDeleting] = useState(false);
  
  // Sell modal state
  const [sellModal, setSellModal] = useState<{
    open: boolean;
    holding: any | null;
    closePosition?: boolean;
  }>({ open: false, holding: null, closePosition: false });
  const [sellShares, setSellShares] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Tax lot selection dialog state
  const [lotSelectionOpen, setLotSelectionOpen] = useState(false);
  
  const handleOpenSellModal = (holding: any, closePosition = false) => {
    setSellModal({ open: true, holding, closePosition });
    setSellShares(closePosition ? holding.shares.toString() : '');
    setSellPrice(holding.currentPrice.toFixed(2));
  };
  
  // Get tax lots for the current symbol in sell modal
  const symbolTaxLots = useMemo(() => {
    if (!sellModal.holding) return [];
    return taxLots.filter(lot => 
      lot.symbol === sellModal.holding.symbol && 
      !lot.is_closed && 
      lot.shares > 0
    );
  }, [taxLots, sellModal.holding]);

  const hasTaxLots = symbolTaxLots.length > 0;

  const handleSell = async () => {
    if (!sellModal.holding || !sellPrice) return;
    
    const shares = sellModal.closePosition 
      ? sellModal.holding.shares 
      : parseFloat(sellShares);
    const price = parseFloat(sellPrice);
    
    if (isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) {
      toast.error('Please enter valid shares and price');
      return;
    }
    
    if (!sellModal.closePosition && shares > sellModal.holding.shares) {
      toast.error('Cannot sell more shares than you own');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addTransaction(
        sellModal.holding.symbol,
        'SELL',
        shares,
        price,
        new Date().toISOString()
      );
      
      if (sellModal.closePosition) {
        toast.success(`Position closed: ${sellModal.holding.symbol} (${shares} shares at $${price.toFixed(2)})`);
      } else {
        toast.success(`Sold ${shares} shares of ${sellModal.holding.symbol} at $${price.toFixed(2)}`);
      }
      
      setSellModal({ open: false, holding: null, closePosition: false });
      setSellShares('');
      setSellPrice('');
    } catch (err) {
      console.error('Sell failed:', err);
      toast.error('Failed to record sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSellWithLotSelection = async (
    selectedLots: { lotId: string; shares: number }[],
    method: LotSelectionMethod
  ) => {
    if (!sellModal.holding || !sellPrice) return;
    
    const price = parseFloat(sellPrice);
    const shares = selectedLots.reduce((sum, l) => sum + l.shares, 0);
    
    setIsSubmitting(true);
    try {
      // Process the sale with tax lot tracking
      const result = await sellWithLotSelection(
        selectedLots,
        price,
        new Date().toISOString().split('T')[0],
        method
      );

      if (result.success) {
        // Also record the transaction
        await addTransaction(
          sellModal.holding.symbol,
          'SELL',
          shares,
          price,
          new Date().toISOString()
        );
      }
      
      setSellModal({ open: false, holding: null, closePosition: false });
      setSellShares('');
      setSellPrice('');
      setLotSelectionOpen(false);
    } catch (err) {
      console.error('Sell with lot selection failed:', err);
      toast.error('Failed to process sale');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const holdings = activePortfolio?.holdings || [];
  const symbols = useMemo(() => holdings.map(h => cleanSymbol(h.symbol)), [holdings]);
  const { prices, loading: pricesLoading, refreshNow } = useStockPrices(symbols, 60000);
  
  // Get unique sectors and asset types for filters
  const sectors = useMemo(() => {
    const sectorSet = new Set(holdings.map(h => h.sector || 'Other'));
    return Array.from(sectorSet).sort();
  }, [holdings]);
  
  const assetTypes = useMemo(() => {
    const typeSet = new Set(holdings.map(h => h.assetType || 'Stock'));
    return Array.from(typeSet).sort();
  }, [holdings]);

  // Calculate portfolio total for allocation %
  const portfolioTotal = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const priceData = prices.get(cleanSymbol(h.symbol));
      const currentPrice = priceData?.price || h.currentPrice || h.avgPrice || 0;
      return sum + (h.shares * currentPrice);
    }, 0);
  }, [holdings, prices]);

  // Enhanced holdings data with live prices
  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const clean = cleanSymbol(h.symbol);
      const priceData = prices.get(clean);
      const currentPrice = priceData?.price || h.currentPrice || h.avgPrice || 0;
      const avgPrice = h.avgPrice || 0;
      const shares = h.shares || 0;
      const value = shares * currentPrice;
      const cost = shares * avgPrice;
      const gain = value - cost;
      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
      const dayChange = priceData?.change || 0;
      const dayChangePercent = priceData?.changePercent || 0;
      const allocation = portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0;

      return {
        ...h,
        symbol: clean, // Use clean symbol for display
        originalSymbol: h.symbol,
        currentPrice,
        value,
        cost,
        gain,
        gainPercent,
        dayChange,
        dayChangePercent,
        allocation,
        source: priceData?.source || 'db'
      };
    });
  }, [holdings, prices, portfolioTotal]);

  // Count sold stocks (shares < 0.0001)
  const soldStocksCount = useMemo(() => {
    return enrichedHoldings.filter(h => h.shares < 0.0001).length;
  }, [enrichedHoldings]);

  // Filter holdings
  const filteredHoldings = useMemo(() => {
    return enrichedHoldings.filter(h => {
      // Stock view filter (active/sold/all)
      const isSold = h.shares < 0.0001;
      if (stockViewFilter === 'active' && isSold) return false;
      if (stockViewFilter === 'sold' && !isSold) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSymbol = h.symbol.toLowerCase().includes(query);
        const matchesName = h.name?.toLowerCase().includes(query);
        if (!matchesSymbol && !matchesName) return false;
      }
      
      // Sector filter
      if (sectorFilter !== 'all') {
        const holdingSector = h.sector || 'Other';
        if (holdingSector !== sectorFilter) return false;
      }
      
      // Asset type filter
      if (assetTypeFilter !== 'all') {
        const holdingType = h.assetType || 'Stock';
        if (holdingType !== assetTypeFilter) return false;
      }
      
      // Gain/Loss filter
      if (gainFilter === 'gainers' && h.gainPercent <= 0) return false;
      if (gainFilter === 'losers' && h.gainPercent >= 0) return false;
      
      return true;
    });
  }, [enrichedHoldings, searchQuery, sectorFilter, assetTypeFilter, gainFilter, stockViewFilter]);

  // Sort holdings
  const sortedHoldings = useMemo(() => {
    if (!sortConfig) return filteredHoldings;

    return [...filteredHoldings].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof typeof a];
      let bValue: any = b[sortConfig.key as keyof typeof b];

      if (aValue === undefined || aValue === null) aValue = 0;
      if (bValue === undefined || bValue === null) bValue = 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredHoldings, sortConfig]);
  
  const hasActiveFilters = searchQuery || sectorFilter !== 'all' || assetTypeFilter !== 'all' || gainFilter !== 'all' || stockViewFilter !== 'active';
  
  const clearFilters = () => {
    setSearchQuery('');
    setSectorFilter('all');
    setAssetTypeFilter('all');
    setGainFilter('all');
    setStockViewFilter('active');
  };

  // Bulk select handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === sortedHoldings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedHoldings.map(h => h.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteHolding(id);
      }
      toast.success(`Deleted ${selectedIds.size} holding(s)`);
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Failed to delete some holdings');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Single holding delete handlers
  const handleOpenDeleteDialog = (holding: any) => {
    setDeleteDialog({ open: true, holding });
  };
  
  const handleConfirmSingleDelete = async () => {
    if (!deleteDialog.holding) return;
    
    setIsSingleDeleting(true);
    try {
      await deleteHolding(deleteDialog.holding.id);
      toast.success(`Removed ${deleteDialog.holding.symbol} from portfolio`);
      setDeleteDialog({ open: false, holding: null });
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to remove holding');
    } finally {
      setIsSingleDeleting(false);
    }
  };

  // Get selected holdings for confirmation dialog
  const selectedHoldings = useMemo(() => {
    return enrichedHoldings.filter(h => selectedIds.has(h.id));
  }, [enrichedHoldings, selectedIds]);

  // Quick select all sold stocks
  const selectAllSold = () => {
    const soldIds = enrichedHoldings.filter(h => h.shares < 0.0001).map(h => h.id);
    setSelectedIds(new Set(soldIds));
    if (soldIds.length > 0 && stockViewFilter === 'active') {
      setStockViewFilter('all');
    }
  };

  // Top movers
  const topGainers = useMemo(() => {
    return [...enrichedHoldings]
      .filter(h => h.dayChangePercent > 0)
      .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
      .slice(0, 3);
  }, [enrichedHoldings]);

  const topLosers = useMemo(() => {
    return [...enrichedHoldings]
      .filter(h => h.dayChangePercent < 0)
      .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
      .slice(0, 3);
  }, [enrichedHoldings]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-muted-foreground" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  if (loadingPortfolio) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Holdings Yet</h3>
          <p className="text-muted-foreground">
            Add holdings to your portfolio to track performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Movers Section */}
      {(topGainers.length > 0 || topLosers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Gainers */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Top Gainers Today
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topGainers.length > 0 ? (
                <div className="space-y-2">
                  {topGainers.map(h => (
                    <div 
                      key={h.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-background cursor-pointer transition-colors"
                      onClick={() => viewStock(h.symbol)}
                    >
                      <div className="flex items-center gap-3">
                        {h.logoUrl ? (
                          <img src={h.logoUrl} alt={h.symbol} className="w-8 h-8 rounded-full object-contain bg-background" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {h.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-sm">{h.symbol}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[100px]">{h.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-500 font-semibold text-sm flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          +{h.dayChangePercent.toFixed(2)}%
                        </span>
                        <span className="text-xs text-muted-foreground">${h.currentPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No gainers today</p>
              )}
            </CardContent>
          </Card>

          {/* Top Losers */}
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Top Losers Today
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topLosers.length > 0 ? (
                <div className="space-y-2">
                  {topLosers.map(h => (
                    <div 
                      key={h.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-background cursor-pointer transition-colors"
                      onClick={() => viewStock(h.symbol)}
                    >
                      <div className="flex items-center gap-3">
                        {h.logoUrl ? (
                          <img src={h.logoUrl} alt={h.symbol} className="w-8 h-8 rounded-full object-contain bg-background" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {h.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-sm">{h.symbol}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[100px]">{h.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-red-500 font-semibold text-sm flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3" />
                          {h.dayChangePercent.toFixed(2)}%
                        </span>
                        <span className="text-xs text-muted-foreground">${h.currentPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No losers today</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Holdings Table */}
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <CardTitle className="text-lg">Holdings ({sortedHoldings.length}{filteredHoldings.length !== holdings.length ? ` of ${holdings.length}` : ''})</CardTitle>
              {selectedIds.size > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDeleteClick}
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedIds.size})
                </Button>
              )}
              {soldStocksCount > 0 && selectedIds.size === 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllSold}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Select All Sold ({soldStocksCount})
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Select value={stockViewFilter} onValueChange={(v) => setStockViewFilter(v as StockViewFilter)}>
                <SelectTrigger className="w-[150px]">
                  {stockViewFilter === 'active' ? <Eye className="w-4 h-4 mr-2" /> : 
                   stockViewFilter === 'sold' ? <EyeOff className="w-4 h-4 mr-2" /> :
                   <Eye className="w-4 h-4 mr-2" />}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <span className="flex items-center gap-2">Active Only</span>
                  </SelectItem>
                  <SelectItem value="sold">
                    <span className="flex items-center gap-2">Sold Only ({soldStocksCount})</span>
                  </SelectItem>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">Show All</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={refreshNow} disabled={pricesLoading}>
                <RefreshCcw className={`w-4 h-4 mr-2 ${pricesLoading ? 'animate-spin' : ''}`} />
                Refresh Prices
              </Button>
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by symbol or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map(sector => (
                  <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Asset Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {assetTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={gainFilter} onValueChange={setGainFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="gainers">Gainers Only</SelectItem>
                <SelectItem value="losers">Losers Only</SelectItem>
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-2 w-10">
                    <Checkbox
                      checked={selectedIds.size === sortedHoldings.length && sortedHoldings.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider"
                      onClick={() => handleSort('symbol')}
                    >
                      Asset <SortIcon columnKey="symbol" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Price <SortIcon columnKey="currentPrice" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('dayChangePercent')}
                    >
                      Day <SortIcon columnKey="dayChangePercent" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('shares')}
                    >
                      Shares <SortIcon columnKey="shares" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('value')}
                    >
                      Value <SortIcon columnKey="value" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('allocation')}
                    >
                      Alloc% <SortIcon columnKey="allocation" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-2">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('gainPercent')}
                    >
                      Gain/Loss <SortIcon columnKey="gainPercent" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((h) => (
                  <tr 
                    key={h.id} 
                    className={`border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer ${h.shares < 0.0001 ? 'opacity-50 bg-muted/30' : ''} ${selectedIds.has(h.id) ? 'bg-primary/5' : ''}`}
                    onClick={() => viewStock(h.symbol)}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(h.id)}
                        onCheckedChange={() => toggleSelectOne(h.id)}
                        aria-label={`Select ${h.symbol}`}
                      />
                    </td>
                    {/* Asset */}
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        {h.logoUrl ? (
                          <img src={h.logoUrl} alt={h.symbol} className="w-8 h-8 rounded-full object-contain bg-muted" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {h.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold">{h.symbol}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">{h.name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3 px-2 text-right font-medium">
                      ${h.currentPrice.toFixed(2)}
                    </td>

                    {/* Day Change */}
                    <td className={`py-3 px-2 text-right ${h.dayChange >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      <div className="flex items-center justify-end gap-1">
                        {h.dayChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span className="font-medium">{h.dayChangePercent >= 0 ? '+' : ''}{h.dayChangePercent.toFixed(2)}%</span>
                      </div>
                      <span className="text-xs opacity-70">${Math.abs(h.dayChange).toFixed(2)}</span>
                    </td>

                    {/* Shares */}
                    <td className="py-3 px-2 text-right">
                      {h.shares.toFixed(h.shares < 1 ? 6 : 2)}
                    </td>

                    {/* Value */}
                    <td className="py-3 px-2 text-right font-medium">
                      ${h.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Allocation */}
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(h.allocation, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{h.allocation.toFixed(1)}%</span>
                      </div>
                    </td>

                    {/* Gain/Loss */}
                    <td className={`py-3 px-2 text-right ${h.gain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      <div className="font-medium">
                        {h.gain >= 0 ? '+' : ''}${h.gain.toFixed(2)}
                      </div>
                      <span className="text-xs opacity-70">
                        {h.gainPercent >= 0 ? '+' : ''}{h.gainPercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                          onClick={() => handleOpenSellModal(h)}
                          title="Sell shares"
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Sell
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleOpenSellModal(h, true)}
                          title="Close position (sell all shares)"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Close
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => viewStock(h.symbol)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => viewStock(h.symbol)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <QuickAddAlertButton symbol={h.symbol} holdingName={h.name} />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleOpenDeleteDialog(h)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Row */}
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{holdings.length} holdings</span>
            </div>
            <div className="flex items-center gap-6">
              <div>
                Portfolio Value: <span className="font-bold text-foreground">${portfolioTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {pricesLoading ? 'Updating...' : 'Live'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Sell Modal */}
      <Dialog open={sellModal.open} onOpenChange={(open) => !open && setSellModal({ open: false, holding: null, closePosition: false })}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sellModal.closePosition ? (
                <>
                  <X className="w-5 h-5 text-red-500" />
                  Close Position: {sellModal.holding?.symbol}
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  Sell {sellModal.holding?.symbol}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {sellModal.holding && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {sellModal.holding.logoUrl ? (
                  <img src={sellModal.holding.logoUrl} alt={sellModal.holding.symbol} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                    {sellModal.holding.symbol.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{sellModal.holding.symbol}</div>
                  <div className="text-sm text-muted-foreground">{sellModal.holding.name}</div>
                </div>
              </div>
              
              {sellModal.closePosition && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-500 font-medium">
                    ⚠️ This will sell ALL shares and remove this holding from your portfolio.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-2 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Current Holdings</div>
                  <div className="font-semibold">{sellModal.holding.shares.toFixed(4)} shares</div>
                </div>
                <div className="p-2 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Current Value</div>
                  <div className="font-semibold">${sellModal.holding.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              
              <div className="space-y-3">
                {!sellModal.closePosition && (
                  <div>
                    <Label htmlFor="sellShares">Shares to Sell</Label>
                    <Input
                      id="sellShares"
                      type="number"
                      step="0.0001"
                      min="0"
                      max={sellModal.holding.shares}
                      value={sellShares}
                      onChange={(e) => setSellShares(e.target.value)}
                      className="mt-1"
                    />
                    <button 
                      type="button"
                      onClick={() => setSellShares(sellModal.holding.shares.toString())}
                      className="text-xs text-primary mt-1 hover:underline"
                    >
                      Sell all
                    </button>
                  </div>
                )}
                <div>
                  <Label htmlFor="sellPrice">Sell Price ($)</Label>
                  <Input
                    id="sellPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="mt-1"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Market price: ${sellModal.holding.currentPrice.toFixed(2)}
                  </div>
                </div>
              </div>
              
              {(sellShares || sellModal.closePosition) && sellPrice && (
                <div className={`p-3 border rounded-lg ${sellModal.closePosition ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                  <div className="text-sm text-muted-foreground">Total Proceeds</div>
                  <div className={`text-xl font-bold ${sellModal.closePosition ? 'text-red-500' : 'text-amber-600'}`}>
                    ${((sellModal.closePosition ? sellModal.holding.shares : parseFloat(sellShares)) * parseFloat(sellPrice)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSellModal({ open: false, holding: null, closePosition: false })}>
              Cancel
            </Button>
            {hasTaxLots && (
              <Button 
                variant="secondary"
                onClick={() => setLotSelectionOpen(true)}
                disabled={isSubmitting || (!sellModal.closePosition && !sellShares) || !sellPrice}
                className="gap-2"
              >
                <Calculator className="w-4 h-4" />
                Tax-Optimized Sell
              </Button>
            )}
            <Button 
              onClick={handleSell} 
              disabled={isSubmitting || (!sellModal.closePosition && !sellShares) || !sellPrice}
              className={sellModal.closePosition ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}
            >
              {isSubmitting ? 'Processing...' : sellModal.closePosition ? 'Close Position' : 'Quick Sell (FIFO)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tax Lot Selection Dialog */}
      {sellModal.holding && (
        <LotSelectionDialog
          open={lotSelectionOpen}
          onOpenChange={setLotSelectionOpen}
          symbol={sellModal.holding.symbol}
          sharesToSell={sellModal.closePosition ? sellModal.holding.shares : (parseFloat(sellShares) || 0)}
          salePrice={parseFloat(sellPrice) || sellModal.holding.currentPrice}
          availableLots={symbolTaxLots}
          currentPrice={sellModal.holding.currentPrice}
          onConfirm={handleSellWithLotSelection}
        />
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        holdings={selectedHoldings}
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={isDeleting}
      />
      
      {/* Single Delete Confirmation Dialog */}
      <DeleteHoldingDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, holding: null })}
        holdingSymbol={deleteDialog.holding?.symbol || ''}
        holdingName={deleteDialog.holding?.name}
        onConfirm={handleConfirmSingleDelete}
        isDeleting={isSingleDeleting}
      />
    </div>
  );
};