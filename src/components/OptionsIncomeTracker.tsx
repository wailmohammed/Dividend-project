import { useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Plus, DollarSign, TrendingUp, Calendar, Target, ArrowUpRight, ArrowDownRight, Trash2, Edit2 } from 'lucide-react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { toast } from 'sonner';

interface OptionsPosition {
  id: string;
  symbol: string;
  type: 'covered_call' | 'cash_secured_put';
  strikePrice: number;
  premium: number;
  contracts: number;
  expirationDate: string;
  openDate: string;
  status: 'open' | 'closed' | 'assigned' | 'expired';
  closingPremium?: number;
  notes?: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', '#10b981', '#f59e0b'];

export const OptionsIncomeTracker = () => {
  const { activePortfolio } = usePortfolio();
  const [positions, setPositions] = useState<OptionsPosition[]>([
    // Sample data
    {
      id: '1',
      symbol: 'AAPL',
      type: 'covered_call',
      strikePrice: 185,
      premium: 3.50,
      contracts: 1,
      expirationDate: '2025-01-17',
      openDate: '2024-12-20',
      status: 'open',
    },
    {
      id: '2',
      symbol: 'MSFT',
      type: 'cash_secured_put',
      strikePrice: 370,
      premium: 5.25,
      contracts: 1,
      expirationDate: '2025-01-24',
      openDate: '2024-12-15',
      status: 'open',
    },
    {
      id: '3',
      symbol: 'NVDA',
      type: 'covered_call',
      strikePrice: 140,
      premium: 8.00,
      contracts: 2,
      expirationDate: '2024-12-27',
      openDate: '2024-12-01',
      status: 'expired',
    },
  ]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<OptionsPosition | null>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    type: 'covered_call' as 'covered_call' | 'cash_secured_put',
    strikePrice: '',
    premium: '',
    contracts: '1',
    expirationDate: '',
    openDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  // Calculate income metrics
  const metrics = useMemo(() => {
    const totalPremiumCollected = positions.reduce((sum, p) => {
      return sum + (p.premium * p.contracts * 100);
    }, 0);

    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status !== 'open');
    
    const realizedIncome = closedPositions.reduce((sum, p) => {
      if (p.status === 'expired') {
        return sum + (p.premium * p.contracts * 100);
      }
      if (p.status === 'closed' && p.closingPremium !== undefined) {
        return sum + ((p.premium - p.closingPremium) * p.contracts * 100);
      }
      return sum;
    }, 0);

    const unrealizedIncome = openPositions.reduce((sum, p) => {
      return sum + (p.premium * p.contracts * 100);
    }, 0);

    const coveredCalls = positions.filter(p => p.type === 'covered_call');
    const cashSecuredPuts = positions.filter(p => p.type === 'cash_secured_put');

    // Monthly income projection
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = format(addDays(new Date(), i * 30), 'MMM');
      const expiringPositions = openPositions.filter(p => {
        const expDate = parseISO(p.expirationDate);
        const monthStart = addDays(new Date(), i * 30);
        const monthEnd = addDays(new Date(), (i + 1) * 30);
        return expDate >= monthStart && expDate < monthEnd;
      });
      const income = expiringPositions.reduce((sum, p) => sum + (p.premium * p.contracts * 100), 0);
      return { month, income };
    });

    return {
      totalPremiumCollected,
      realizedIncome,
      unrealizedIncome,
      openCount: openPositions.length,
      closedCount: closedPositions.length,
      coveredCallsCount: coveredCalls.length,
      cashSecuredPutsCount: cashSecuredPuts.length,
      monthlyData,
    };
  }, [positions]);

  // Strategy breakdown for pie chart
  const strategyData = [
    { name: 'Covered Calls', value: metrics.coveredCallsCount },
    { name: 'Cash Secured Puts', value: metrics.cashSecuredPutsCount },
  ];

  const handleSubmit = () => {
    if (!formData.symbol || !formData.strikePrice || !formData.premium || !formData.expirationDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newPosition: OptionsPosition = {
      id: editingPosition?.id || Date.now().toString(),
      symbol: formData.symbol.toUpperCase(),
      type: formData.type,
      strikePrice: parseFloat(formData.strikePrice),
      premium: parseFloat(formData.premium),
      contracts: parseInt(formData.contracts),
      expirationDate: formData.expirationDate,
      openDate: formData.openDate,
      status: 'open',
      notes: formData.notes,
    };

    if (editingPosition) {
      setPositions(prev => prev.map(p => p.id === editingPosition.id ? newPosition : p));
      toast.success('Position updated');
    } else {
      setPositions(prev => [...prev, newPosition]);
      toast.success('Position added');
    }

    setIsDialogOpen(false);
    setEditingPosition(null);
    setFormData({
      symbol: '',
      type: 'covered_call',
      strikePrice: '',
      premium: '',
      contracts: '1',
      expirationDate: '',
      openDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
  };

  const handleDelete = (id: string) => {
    setPositions(prev => prev.filter(p => p.id !== id));
    toast.success('Position deleted');
  };

  const handleClosePosition = (id: string, status: 'closed' | 'assigned' | 'expired') => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    toast.success(`Position marked as ${status}`);
  };

  const getDaysUntilExpiration = (expDate: string) => {
    const days = differenceInDays(parseISO(expDate), new Date());
    return days < 0 ? 0 : days;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-blue-500">Open</Badge>;
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>;
      case 'assigned':
        return <Badge className="bg-yellow-500">Assigned</Badge>;
      case 'expired':
        return <Badge className="bg-green-500">Expired (Profit)</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Options Income Tracker
          </h2>
          <p className="text-sm text-muted-foreground">Track covered calls and cash-secured puts</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingPosition(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPosition ? 'Edit Position' : 'Add Options Position'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Symbol</Label>
                  <Input 
                    value={formData.symbol}
                    onChange={e => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                    placeholder="AAPL"
                  />
                </div>
                <div>
                  <Label>Strategy</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="covered_call">Covered Call</SelectItem>
                      <SelectItem value="cash_secured_put">Cash Secured Put</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Strike Price</Label>
                  <Input 
                    type="number"
                    value={formData.strikePrice}
                    onChange={e => setFormData(prev => ({ ...prev, strikePrice: e.target.value }))}
                    placeholder="150.00"
                  />
                </div>
                <div>
                  <Label>Premium</Label>
                  <Input 
                    type="number"
                    value={formData.premium}
                    onChange={e => setFormData(prev => ({ ...prev, premium: e.target.value }))}
                    placeholder="3.50"
                  />
                </div>
                <div>
                  <Label>Contracts</Label>
                  <Input 
                    type="number"
                    value={formData.contracts}
                    onChange={e => setFormData(prev => ({ ...prev, contracts: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Open Date</Label>
                  <Input 
                    type="date"
                    value={formData.openDate}
                    onChange={e => setFormData(prev => ({ ...prev, openDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Expiration Date</Label>
                  <Input 
                    type="date"
                    value={formData.expirationDate}
                    onChange={e => setFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input 
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any notes about this position"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingPosition ? 'Update Position' : 'Add Position'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Premium Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${metrics.totalPremiumCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Realized Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.realizedIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Unrealized (Open)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${metrics.unrealizedIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.openCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expected Monthly Income</CardTitle>
            <CardDescription>Based on open positions expiration dates</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Income']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Strategy Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {strategyData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={strategyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {strategyData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground">No positions yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Options Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Symbol</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Strategy</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Strike</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Premium</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Expiry</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">DTE</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(position => (
                    <tr key={position.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{position.symbol}</td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={position.type === 'covered_call' ? 'border-blue-500 text-blue-500' : 'border-purple-500 text-purple-500'}>
                          {position.type === 'covered_call' ? (
                            <><ArrowUpRight className="w-3 h-3 mr-1" /> CC</>
                          ) : (
                            <><ArrowDownRight className="w-3 h-3 mr-1" /> CSP</>
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">${position.strikePrice.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right">${position.premium.toFixed(2)}</td>
                      <td className="py-3 px-2 text-right font-medium text-green-500">
                        ${(position.premium * position.contracts * 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-2 text-center text-sm">
                        {format(parseISO(position.expirationDate), 'MMM dd')}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={getDaysUntilExpiration(position.expirationDate) <= 7 ? 'destructive' : 'secondary'}>
                          {getDaysUntilExpiration(position.expirationDate)}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {getStatusBadge(position.status)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end gap-1">
                          {position.status === 'open' && (
                            <Select onValueChange={(v: any) => handleClosePosition(position.id, v)}>
                              <SelectTrigger className="w-20 h-7 text-xs">
                                <SelectValue placeholder="Close" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDelete(position.id)}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No options positions yet</p>
              <p className="text-sm mt-1">Add covered calls or cash-secured puts to track income</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
