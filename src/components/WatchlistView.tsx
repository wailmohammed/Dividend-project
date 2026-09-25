import { useState, useEffect, useMemo } from 'react';
import { Eye, Plus, Trash2, Bell, BellOff, TrendingUp, TrendingDown, Search, Target, ExternalLink, RefreshCw, GripVertical, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { useWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cleanSymbol } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { fetchMarketPrices, PriceData } from '@/services/marketDataService';
import { StockSearchAutocomplete } from './StockSearchAutocomplete';
import { WatchlistWhatIfDialog } from './WatchlistWhatIfDialog';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  item: WatchlistItem;
  priceData?: PriceData;
  onEdit: (item: WatchlistItem) => void;
  onRemove: (id: string) => void;
  onViewStock: (symbol: string) => void;
  onSimulate: (item: WatchlistItem) => void;
}


const SortableRow = ({ item, priceData, onEdit, onRemove, onViewStock, onSimulate }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPositive = priceData && priceData.changePercent >= 0;

  return (
    <TableRow ref={setNodeRef} style={style} className="group">
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <button
          onClick={() => onViewStock(item.symbol)}
          className="font-bold text-primary hover:underline flex items-center gap-1"
        >
          {cleanSymbol(item.symbol)}
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {item.name || '-'}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {priceData ? (
          `$${priceData.price.toFixed(2)}`
        ) : (
          <Skeleton className="h-4 w-16 ml-auto" />
        )}
      </TableCell>
      <TableCell className="text-right">
        {priceData ? (
          <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="font-mono text-sm">
              {isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%
            </span>
          </div>
        ) : (
          <Skeleton className="h-4 w-12 ml-auto" />
        )}
      </TableCell>
      <TableCell>
        {item.target_price ? (
          <Badge variant="outline" className="flex items-center gap-1 w-fit">
            <Target className="w-3 h-3" />
            ${item.target_price.toFixed(2)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {item.alert_enabled ? (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <Bell className="w-3 h-3 mr-1" />
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <BellOff className="w-3 h-3 mr-1" />
            Off
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSimulate(item)}
            title="What-if simulation"
          >
            <FlaskConical className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(item)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>

    </TableRow>
  );
};

export const WatchlistView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { watchlist, loading, addToWatchlist, removeFromWatchlist, updateWatchlistItem, reorderWatchlist, refetch } = useWatchlist();
  const { viewStock } = usePortfolio();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTargetPrice, setEditTargetPrice] = useState('');
  const [editAlertEnabled, setEditAlertEnabled] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [simulateItem, setSimulateItem] = useState<WatchlistItem | null>(null);

  
  // Real-time price state
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch prices for all watchlist symbols
  const fetchPrices = async () => {
    if (watchlist.length === 0) return;

    // Demo mode: synthesize deterministic prices from symbol so UI is never stuck loading
    if (isDemoMode) {
      const seeded: Record<string, PriceData> = {};
      watchlist.forEach(w => {
        const seed = w.symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const price = 50 + (seed % 350) + (seed % 13) / 10;
        const changePercent = ((seed % 17) - 8) + (seed % 7) / 10;
        const change = (price * changePercent) / 100;
        seeded[w.symbol.toUpperCase()] = {
          symbol: w.symbol.toUpperCase(),
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
        } as PriceData;
      });
      setPrices(seeded);
      setLastUpdated(new Date());
      return;
    }

    const symbols = watchlist.map(w => w.symbol);
    setPricesLoading(true);
    try {
      const priceData = await fetchMarketPrices(symbols, 'mixed');
      setPrices(priceData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    } finally {
      setPricesLoading(false);
    }
  };

  // Fetch prices on mount and when watchlist changes
  useEffect(() => {
    fetchPrices();
  }, [watchlist.length, isDemoMode]);

  // Auto-refresh prices every 30 seconds (skip in demo to keep deterministic)
  useEffect(() => {
    if (isDemoMode) return;
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [watchlist, isDemoMode]);

  // Calculate stats
  const gainersCount = useMemo(() => {
    return Object.values(prices).filter(p => p.changePercent > 0).length;
  }, [prices]);

  const losersCount = useMemo(() => {
    return Object.values(prices).filter(p => p.changePercent < 0).length;
  }, [prices]);

  const handleAddSymbol = async () => {
    if (!newSymbol.trim()) return;
    await addToWatchlist(newSymbol.trim(), newName.trim() || undefined);
    setNewSymbol('');
    setNewName('');
    setIsAddDialogOpen(false);
  };

  const handleOpenEdit = (item: WatchlistItem) => {
    setEditingItem(item);
    setEditNotes(item.notes || '');
    setEditTargetPrice(item.target_price?.toString() || '');
    setEditAlertEnabled(item.alert_enabled);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    await updateWatchlistItem(editingItem.id, {
      notes: editNotes || null,
      target_price: editTargetPrice ? parseFloat(editTargetPrice) : null,
      alert_enabled: editAlertEnabled
    });
    setEditingItem(null);
    setIsEditDialogOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = watchlist.findIndex((item) => item.id === active.id);
      const newIndex = watchlist.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(watchlist, oldIndex, newIndex);
      reorderWatchlist(newOrder);
    }
  };

  const filteredWatchlist = watchlist.filter(item =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Demo Mode Indicator */}
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample watchlist data. Sign in to track your own stock watchlist.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Watchlist</h1>
          <p className="text-muted-foreground">Track stocks you're interested in. Drag to reorder.</p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPrices} disabled={pricesLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${pricesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Symbol
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Watchlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Search Stock</Label>
                  <StockSearchAutocomplete
                    onSelect={(symbol, name) => {
                      setNewSymbol(symbol);
                      setNewName(name);
                    }}
                    placeholder="Search by symbol or company name..."
                  />
                </div>
                {newSymbol && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Selected: {newSymbol}</p>
                    {newName && <p className="text-xs text-muted-foreground">{newName}</p>}
                  </div>
                )}
                <Button onClick={handleAddSymbol} className="w-full" disabled={!newSymbol}>
                  Add to Watchlist
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search watchlist..."
          className="pl-10 max-w-md"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Watching</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{watchlist.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Stocks in watchlist</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Gainers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{gainersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Stocks up today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-red-500" /> Losers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{losersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Stocks down today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{watchlist.filter(w => w.alert_enabled).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Price alerts active</p>
          </CardContent>
        </Card>
      </div>

      {/* Watchlist Table with Drag and Drop */}
      {filteredWatchlist.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No matches found' : 'Your watchlist is empty'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Add stocks you want to track'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Stock
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Target Price</TableHead>
                    <TableHead>Alert</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={filteredWatchlist.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredWatchlist.map((item) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        priceData={prices[item.symbol.toUpperCase()]}
                        onEdit={handleOpenEdit}
                        onRemove={removeFromWatchlist}
                        onViewStock={viewStock}
                        onSimulate={(it) => setSimulateItem(it)}
                      />

                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingItem?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="target_price">Target Price</Label>
              <Input
                id="target_price"
                type="number"
                step="0.01"
                value={editTargetPrice}
                onChange={(e) => setEditTargetPrice(e.target.value)}
                placeholder="150.00"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="alert_enabled"
                checked={editAlertEnabled}
                onChange={(e) => setEditAlertEnabled(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="alert_enabled">Enable price alert</Label>
            </div>
            <div>
              <Label htmlFor="notes">Research Notes</Label>
              <Textarea
                id="notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Your research notes..."
                className="mt-1"
                rows={4}
              />
            </div>
            <Button onClick={handleSaveEdit} className="w-full">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* What-If Simulator */}
      {simulateItem && (
        <WatchlistWhatIfDialog
          open={!!simulateItem}
          onClose={() => setSimulateItem(null)}
          symbol={simulateItem.symbol}
          name={simulateItem.name || undefined}
          price={prices[simulateItem.symbol.toUpperCase()]?.price || 0}
          dividendYield={0}
          sector={'Unknown'}
        />
      )}
    </div>
  );
};
