import React, { useState, useMemo } from 'react';
import { useTaxLots, TaxLot } from '@/hooks/useTaxLots';
import { usePortfolio } from '@/context/PortfolioContext';
import { useStockPrices } from '@/hooks/useStockPrices';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TaxLotEditDialog } from '@/components/tax/TaxLotEditDialog';
import { QuarterlyTaxCalculator } from '@/components/tax/QuarterlyTaxCalculator';
import { QuarterlyPaymentReminders } from '@/components/tax/QuarterlyPaymentReminders';
import { QuarterlyTaxPaymentTracker } from '@/components/tax/QuarterlyTaxPaymentTracker';
import { TaxLotImporter } from '@/components/tax/TaxLotImporter';
import { CapitalGainsOptimizer } from '@/components/tax/CapitalGainsOptimizer';
import { WashSaleEnforcementPanel } from '@/components/tax/WashSaleEnforcementPanel';
import { YearEndTaxPlanner } from '@/components/tax/YearEndTaxPlanner';
import { TaxHarvestingReminders } from '@/components/tax/TaxHarvestingReminders';
import { TaxDocumentVault } from '@/components/tax/TaxDocumentVault';
import { StateTaxSettings } from '@/components/tax/StateTaxSettings';
import { TaxDocumentReconciliation } from '@/components/tax/TaxDocumentReconciliation';
import { MultiYearTaxReport } from '@/components/tax/MultiYearTaxReport';
import { TaxProjectionCalculator } from '@/components/tax/TaxProjectionCalculator';
import { TaxLossHarvestingAdvisor } from '@/components/tax/TaxLossHarvestingAdvisor';
import { TaxBracketOptimizer } from '@/components/tax/TaxBracketOptimizer';
import { useWashSaleEnforcement } from '@/hooks/useWashSaleEnforcement';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  DollarSign, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Pencil,
  Upload,
  Lightbulb,
  AlertTriangle,
  Target,
  Bell,
  CalendarClock,
  FileText,
  MapPin,
  FileSearch,
  History,
  Eye,
  TrendingUp as Projection,
  Leaf,
  Timer
} from 'lucide-react';

const TaxLotTracker: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { user } = useAuth();
  const { taxLots, loading, addTaxLot, updateTaxLot, closeTaxLot, deleteTaxLot, calculateTaxSummary } = useTaxLots(activePortfolio?.id);
  const symbols = useMemo(() => [...new Set(taxLots.map(l => l.symbol))], [taxLots]);
  const { prices } = useStockPrices(symbols);
  
  const isDemoMode = !user || user.id === 'demo-user';
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<TaxLot | null>(null);
  const [newLot, setNewLot] = useState({
    symbol: '',
    shares: '',
    cost_basis: '',
    purchase_date: new Date().toISOString().split('T')[0]
  });
  const [saleData, setSaleData] = useState({
    sale_price: '',
    sale_date: new Date().toISOString().split('T')[0]
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    prices.forEach(p => {
      map[p.symbol] = p.price;
    });
    return map;
  }, [prices]);

  const taxSummary = useMemo(() => calculateTaxSummary(priceMap), [taxLots, priceMap]);

  // Wash sale enforcement
  const { washSaleAdjustments, totalDisallowedLoss, isWashSaleLot, getAdjustedCostBasis } = useWashSaleEnforcement(taxLots);

  // Calculate quarterly payment estimates for reminders
  const estimatedQuarterlyPayments = useMemo(() => {
    const totalTax = (taxSummary.shortTermGains * 0.32) + (taxSummary.longTermGains * 0.15);
    const quarterlyPayment = Math.max(0, totalTax / 4);
    return [
      { quarter: 'Q1', payment: quarterlyPayment },
      { quarter: 'Q2', payment: quarterlyPayment },
      { quarter: 'Q3', payment: quarterlyPayment },
      { quarter: 'Q4', payment: quarterlyPayment }
    ];
  }, [taxSummary]);

  const openLots = taxLots.filter(l => !l.is_closed);
  const closedLots = taxLots.filter(l => l.is_closed);

  const handleAddLot = async () => {
    if (!activePortfolio || !newLot.symbol || !newLot.shares || !newLot.cost_basis) return;
    
    await addTaxLot({
      portfolio_id: activePortfolio.id,
      holding_id: null,
      symbol: newLot.symbol.toUpperCase(),
      shares: parseFloat(newLot.shares),
      cost_basis: parseFloat(newLot.cost_basis),
      purchase_date: newLot.purchase_date,
      lot_type: 'buy'
    });

    setNewLot({ symbol: '', shares: '', cost_basis: '', purchase_date: new Date().toISOString().split('T')[0] });
    setIsAddDialogOpen(false);
  };

  const handleCloseLot = async () => {
    if (!selectedLot || !saleData.sale_price) return;
    
    await closeTaxLot(selectedLot.id, parseFloat(saleData.sale_price), saleData.sale_date);
    setSelectedLot(null);
    setSaleData({ sale_price: '', sale_date: new Date().toISOString().split('T')[0] });
    setIsCloseDialogOpen(false);
  };

  const getHoldingPeriod = (purchaseDate: string) => {
    const purchase = new Date(purchaseDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    
    if (years > 0) return `${years}y ${months}m`;
    if (months > 0) return `${months}m`;
    return `${days}d`;
  };

  const isLongTerm = (purchaseDate: string) => {
    const purchase = new Date(purchaseDate);
    const now = new Date();
    const days = (now.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 365;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="bg-primary/10 border-primary/30">
          <Eye className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center gap-2">
            <span className="font-medium text-primary">Demo Mode</span>
            <span className="text-muted-foreground">— You're viewing sample tax lots. Log in to see your real data.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cost Basis</p>
                <p className="text-2xl font-bold">${taxSummary.totalCostBasis.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unrealized Gains</p>
                <p className="text-2xl font-bold text-emerald-500">+${taxSummary.unrealizedGains.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unrealized Losses</p>
                <p className="text-2xl font-bold text-red-500">-${taxSummary.unrealizedLosses.toLocaleString()}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Realized Gains</p>
                <p className="text-2xl font-bold">${(taxSummary.realizedGains - taxSummary.realizedLosses).toLocaleString()}</p>
              </div>
              <Calculator className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Term Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Capital Gains by Holding Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">Short-Term (&lt; 1 year)</span>
              </div>
              <p className={`text-xl font-bold ${taxSummary.shortTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {taxSummary.shortTermGains >= 0 ? '+' : ''}{taxSummary.shortTermGains.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Taxed at ordinary income rates</p>
            </div>
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-green-600 dark:text-green-400">Long-Term (≥ 1 year)</span>
              </div>
              <p className={`text-xl font-bold ${taxSummary.longTermGains >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {taxSummary.longTermGains >= 0 ? '+' : ''}{taxSummary.longTermGains.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Taxed at preferential capital gains rates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wash Sale Alert */}
      {washSaleAdjustments.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <div>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  {washSaleAdjustments.length} Wash Sale{washSaleAdjustments.length > 1 ? 's' : ''} Detected
                </p>
                <p className="text-sm text-muted-foreground">
                  ${totalDisallowedLoss.toLocaleString()} in losses disallowed. Cost basis has been adjusted on replacement shares.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Lots Table */}
      <Tabs defaultValue="open" className="w-full">
        {/* Action button row - separate from tabs */}
        <div className="flex justify-end mb-4">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Tax Lot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Tax Lot</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="AAPL"
                    value={newLot.symbol}
                    onChange={(e) => setNewLot({ ...newLot, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shares">Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    placeholder="100"
                    value={newLot.shares}
                    onChange={(e) => setNewLot({ ...newLot, shares: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cost_basis">Cost Basis Per Share</Label>
                  <Input
                    id="cost_basis"
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={newLot.cost_basis}
                    onChange={(e) => setNewLot({ ...newLot, cost_basis: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={newLot.purchase_date}
                    onChange={(e) => setNewLot({ ...newLot, purchase_date: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleAddLot}>Add Tax Lot</Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs list - now on its own row with horizontal scroll */}
        <div className="overflow-x-auto mb-4">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="open">Open ({openLots.length})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({closedLots.length})</TabsTrigger>
            <TabsTrigger value="wash-sales">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Wash Sales
            </TabsTrigger>
            <TabsTrigger value="year-end">
              <Target className="w-4 h-4 mr-1" />
              Year-End
            </TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
            <TabsTrigger value="payment-reminders">
              <CalendarClock className="w-4 h-4 mr-1" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="w-4 h-4 mr-1" />
              Import
            </TabsTrigger>
            <TabsTrigger value="optimizer">
              <Lightbulb className="w-4 h-4 mr-1" />
              Optimizer
            </TabsTrigger>
            <TabsTrigger value="reminders">
              <Bell className="w-4 h-4 mr-1" />
              Reminders
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="w-4 h-4 mr-1" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="reconciliation">
              <FileSearch className="w-4 h-4 mr-1" />
              Reconcile
            </TabsTrigger>
            <TabsTrigger value="multi-year">
              <History className="w-4 h-4 mr-1" />
              Multi-Year
            </TabsTrigger>
            <TabsTrigger value="state-tax">
              <MapPin className="w-4 h-4 mr-1" />
              State Tax
            </TabsTrigger>
            <TabsTrigger value="projection">
              <Projection className="w-4 h-4 mr-1" />
              Projection
            </TabsTrigger>
            <TabsTrigger value="harvesting">
              <Leaf className="w-4 h-4 mr-1" />
              Harvesting
            </TabsTrigger>
            <TabsTrigger value="bracket-optimizer">
              <Timer className="w-4 h-4 mr-1" />
              Hold Timer
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="open">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Cost Basis</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Gain/Loss</TableHead>
                  <TableHead>Holding Period</TableHead>
                  <TableHead>Tax Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openLots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No open tax lots. Add one to start tracking.
                    </TableCell>
                  </TableRow>
                ) : (
                  openLots.map((lot) => {
                    const adjustedCostBasis = getAdjustedCostBasis(lot.id);
                    const effectiveCostBasis = adjustedCostBasis || lot.cost_basis;
                    const currentPrice = priceMap[lot.symbol] || lot.cost_basis;
                    const gainLoss = (currentPrice - effectiveCostBasis) * lot.shares;
                    const gainLossPercent = ((currentPrice - effectiveCostBasis) / effectiveCostBasis) * 100;
                    const longTerm = isLongTerm(lot.purchase_date);
                    const hasWashSale = isWashSaleLot(lot.id);

                    return (
                      <TableRow key={lot.id} className={hasWashSale ? 'bg-amber-500/5' : ''}>
                        <TableCell className="font-bold">
                          <div className="flex items-center gap-2">
                            {lot.symbol}
                            {hasWashSale && (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-xs">
                                W
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lot.shares}</TableCell>
                        <TableCell>
                          {adjustedCostBasis ? (
                            <div>
                              <span className="line-through text-muted-foreground text-xs">${lot.cost_basis.toFixed(2)}</span>
                              <span className="ml-1 text-amber-600">${adjustedCostBasis.toFixed(2)}</span>
                            </div>
                          ) : (
                            `$${lot.cost_basis.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell>${currentPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <span className={gainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {gainLoss >= 0 ? '+' : ''}{gainLoss.toFixed(2)} ({gainLossPercent.toFixed(1)}%)
                          </span>
                        </TableCell>
                        <TableCell>{getHoldingPeriod(lot.purchase_date)}</TableCell>
                        <TableCell>
                          <Badge variant={longTerm ? 'default' : 'secondary'}>
                            {longTerm ? 'Long-Term' : 'Short-Term'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedLot(lot);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLot(lot);
                                setIsCloseDialogOpen(true);
                              }}
                            >
                              Close
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteTaxLot(lot.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="closed">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Shares</TableHead>
                  <TableHead>Cost Basis</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Realized Gain/Loss</TableHead>
                  <TableHead>Sale Date</TableHead>
                  <TableHead>Tax Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedLots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No closed positions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  closedLots.map((lot) => {
                    const longTerm = lot.sale_date ? 
                      (new Date(lot.sale_date).getTime() - new Date(lot.purchase_date).getTime()) >= 365 * 24 * 60 * 60 * 1000 
                      : false;

                    return (
                      <TableRow key={lot.id}>
                        <TableCell className="font-bold">{lot.symbol}</TableCell>
                        <TableCell>{lot.shares}</TableCell>
                        <TableCell>${lot.cost_basis.toFixed(2)}</TableCell>
                        <TableCell>${lot.sale_price?.toFixed(2) || '-'}</TableCell>
                        <TableCell>
                          <span className={lot.realized_gain_loss && lot.realized_gain_loss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                            {lot.realized_gain_loss && lot.realized_gain_loss >= 0 ? '+' : ''}
                            ${lot.realized_gain_loss?.toFixed(2) || '0.00'}
                          </span>
                        </TableCell>
                        <TableCell>{lot.sale_date ? new Date(lot.sale_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={longTerm ? 'default' : 'secondary'}>
                            {longTerm ? 'Long-Term' : 'Short-Term'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="quarterly">
          <QuarterlyTaxCalculator
            transactions={closedLots.map(lot => ({
              symbol: lot.symbol,
              shares: lot.shares,
              purchaseDate: lot.purchase_date,
              saleDate: lot.sale_date || '',
              costBasis: lot.cost_basis * lot.shares,
              salePrice: (lot.sale_price || 0) * lot.shares,
              gainLoss: lot.realized_gain_loss || 0,
              isLongTerm: lot.sale_date ? 
                (new Date(lot.sale_date).getTime() - new Date(lot.purchase_date).getTime()) >= 365 * 24 * 60 * 60 * 1000 
                : false
            }))}
          />
        </TabsContent>

        <TabsContent value="wash-sales">
          <WashSaleEnforcementPanel taxLots={taxLots} />
        </TabsContent>

        <TabsContent value="year-end">
          <YearEndTaxPlanner taxLots={taxLots} currentPrices={priceMap} />
        </TabsContent>

        <TabsContent value="payment-reminders">
          <div className="space-y-6">
            <QuarterlyPaymentReminders estimatedQuarterlyPayments={estimatedQuarterlyPayments} />
            <QuarterlyTaxPaymentTracker estimatedQuarterlyPayments={estimatedQuarterlyPayments} />
          </div>
        </TabsContent>

        <TabsContent value="import">
          <TaxLotImporter />
        </TabsContent>

        <TabsContent value="optimizer">
          <CapitalGainsOptimizer />
        </TabsContent>

        <TabsContent value="reminders">
          <TaxHarvestingReminders />
        </TabsContent>

        <TabsContent value="documents">
          <TaxDocumentVault />
        </TabsContent>

        <TabsContent value="reconciliation">
          <TaxDocumentReconciliation />
        </TabsContent>

        <TabsContent value="multi-year">
          <MultiYearTaxReport />
        </TabsContent>

        <TabsContent value="state-tax">
          <StateTaxSettings 
            shortTermGains={taxSummary.shortTermGains} 
            longTermGains={taxSummary.longTermGains} 
          />
        </TabsContent>

        <TabsContent value="projection">
          <TaxProjectionCalculator />
        </TabsContent>

        <TabsContent value="harvesting">
          <TaxLossHarvestingAdvisor />
        </TabsContent>

        <TabsContent value="bracket-optimizer">
          <TaxBracketOptimizer />
        </TabsContent>
      </Tabs>

      {/* Close Lot Dialog */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Tax Lot</DialogTitle>
          </DialogHeader>
          {selectedLot && (
            <div className="grid gap-4 py-4">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Closing position</p>
                <p className="font-bold">{selectedLot.shares} shares of {selectedLot.symbol}</p>
                <p className="text-sm">Cost basis: ${selectedLot.cost_basis}/share</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sale_price">Sale Price Per Share</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  placeholder="175.00"
                  value={saleData.sale_price}
                  onChange={(e) => setSaleData({ ...saleData, sale_price: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sale_date">Sale Date</Label>
                <Input
                  id="sale_date"
                  type="date"
                  value={saleData.sale_date}
                  onChange={(e) => setSaleData({ ...saleData, sale_date: e.target.value })}
                />
              </div>
              {saleData.sale_price && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Estimated Gain/Loss</p>
                  <p className={`font-bold ${(parseFloat(saleData.sale_price) - selectedLot.cost_basis) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    ${((parseFloat(saleData.sale_price) - selectedLot.cost_basis) * selectedLot.shares).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}
          <Button onClick={handleCloseLot}>Close Position</Button>
        </DialogContent>
      </Dialog>

      {/* Edit Tax Lot Dialog */}
      <TaxLotEditDialog
        lot={selectedLot}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={updateTaxLot}
      />
    </div>
  );
};

export default TaxLotTracker;
