import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { usePortfolio } from '@/context/PortfolioContext';
import { cleanSymbol } from '@/lib/utils';
import { 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertCircle,
  Calendar,
  Tag,
  PenLine,
  BarChart3,
  Clock,
  DollarSign,
  Percent,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface TradeNote {
  id: string;
  transactionId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  entryReason: string;
  exitReason?: string;
  tags: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  outcome?: 'win' | 'loss' | 'breakeven' | 'open';
  lessonsLearned?: string;
  createdAt: string;
}

interface TradeStats {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgHoldingDays: number;
  largestWin: number;
  largestLoss: number;
  byTag: Record<string, { wins: number; losses: number; pnl: number }>;
}

const PRESET_TAGS = [
  'Momentum', 'Value', 'Dividend', 'Breakout', 'Earnings', 'Technical', 
  'Fundamental', 'Swing', 'Day Trade', 'Long Term', 'Speculative', 'Hedge'
];

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899'];

export const TradeJournal = () => {
  const { activePortfolio } = usePortfolio();
  const transactions = activePortfolio?.transactions || [];
  const holdings = activePortfolio?.holdings || [];

  const [notes, setNotes] = useState<TradeNote[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  
  const [newNote, setNewNote] = useState({
    entryReason: '',
    exitReason: '',
    tags: [] as string[],
    sentiment: 'neutral' as 'bullish' | 'bearish' | 'neutral',
    lessonsLearned: ''
  });

  // Calculate P/L for transactions
  const transactionsWithPL = useMemo(() => {
    const costBasisMap: Record<string, { totalShares: number; totalCost: number }> = {};
    
    const sortedTxns = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const result: any[] = [];

    sortedTxns.forEach(txn => {
      const symbol = cleanSymbol(txn.symbol);
      const shares = txn.shares || 0;
      const price = txn.price || 0;
      const type = txn.type as 'BUY' | 'SELL';

      if (!costBasisMap[symbol]) {
        costBasisMap[symbol] = { totalShares: 0, totalCost: 0 };
      }

      let profitLoss = 0;
      let profitLossPercent = 0;
      let avgCostBasis = 0;

      if (type === 'BUY') {
        costBasisMap[symbol].totalShares += shares;
        costBasisMap[symbol].totalCost += shares * price;
        avgCostBasis = costBasisMap[symbol].totalCost / costBasisMap[symbol].totalShares;
      } else if (type === 'SELL') {
        const basis = costBasisMap[symbol];
        if (basis.totalShares > 0) {
          avgCostBasis = basis.totalCost / basis.totalShares;
          const costOfSoldShares = avgCostBasis * shares;
          const saleProceeds = shares * price;
          profitLoss = saleProceeds - costOfSoldShares;
          profitLossPercent = costOfSoldShares > 0 ? ((saleProceeds - costOfSoldShares) / costOfSoldShares) * 100 : 0;
          
          const remainingRatio = Math.max(0, (basis.totalShares - shares) / basis.totalShares);
          basis.totalShares = Math.max(0, basis.totalShares - shares);
          basis.totalCost = basis.totalCost * remainingRatio;
        }
      }

      const note = notes.find(n => n.transactionId === txn.id);
      
      result.push({
        ...txn,
        profitLoss,
        profitLossPercent,
        avgCostBasis,
        note,
        outcome: profitLoss > 0 ? 'win' : profitLoss < 0 ? 'loss' : 'breakeven'
      });
    });

    return result.reverse();
  }, [transactions, notes]);

  const closedTrades = useMemo(
    () => transactionsWithPL.filter(t => String(t.type).toUpperCase() === 'SELL'),
    [transactionsWithPL]
  );
  const hasClosedTrades = closedTrades.length > 0;

  // Calculate trade statistics
  const stats = useMemo((): TradeStats => {
    const sells = closedTrades;
    const wins = sells.filter(t => t.profitLoss > 0);
    const losses = sells.filter(t => t.profitLoss < 0);
    
    const totalWins = wins.reduce((sum, t) => sum + t.profitLoss, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.profitLoss, 0));
    
    const byTag: Record<string, { wins: number; losses: number; pnl: number }> = {};
    notes.forEach(note => {
      note.tags.forEach(tag => {
        if (!byTag[tag]) byTag[tag] = { wins: 0, losses: 0, pnl: 0 };
        const txn = transactionsWithPL.find(t => t.id === note.transactionId);
        if (txn && String(txn.type).toUpperCase() === 'SELL') {
          if (txn.profitLoss > 0) byTag[tag].wins++;
          else if (txn.profitLoss < 0) byTag[tag].losses++;
          byTag[tag].pnl += txn.profitLoss;
        }
      });
    });

    return {
      totalTrades: sells.length,
      winRate: sells.length > 0 ? (wins.length / sells.length) * 100 : 0,
      avgWin: wins.length > 0 ? totalWins / wins.length : 0,
      avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      avgHoldingDays: 30, // Would need buy date tracking
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.profitLoss)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.profitLoss)) : 0,
      byTag
    };
  }, [closedTrades, transactionsWithPL, notes]);

  // Performance by month
  const monthlyPerformance = useMemo(() => {
    const byMonth: Record<string, { wins: number; losses: number; pnl: number }> = {};

    closedTrades.forEach(txn => {
      const month = format(new Date(txn.date), 'MMM yyyy');
      if (!byMonth[month]) byMonth[month] = { wins: 0, losses: 0, pnl: 0 };
      if (txn.profitLoss > 0) byMonth[month].wins++;
      else if (txn.profitLoss < 0) byMonth[month].losses++;
      byMonth[month].pnl += txn.profitLoss;
    });

    return Object.entries(byMonth)
      .map(([month, data]) => ({
        month,
        ...data,
        winRate: (data.wins / (data.wins + data.losses)) * 100 || 0
      }))
      .slice(-12);
  }, [closedTrades]);

  // Outcome distribution
  const outcomeDistribution = useMemo(() => {
    const wins = closedTrades.filter(t => t.profitLoss > 0).length;
    const losses = closedTrades.filter(t => t.profitLoss < 0).length;
    const breakeven = closedTrades.filter(t => t.profitLoss === 0).length;
    
    return [
      { name: 'Wins', value: wins, color: '#10b981' },
      { name: 'Losses', value: losses, color: '#ef4444' },
      { name: 'Breakeven', value: breakeven, color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [closedTrades]);

  const handleAddNote = (transactionId: string, symbol: string, type: 'BUY' | 'SELL') => {
    const note: TradeNote = {
      id: `note-${Date.now()}`,
      transactionId,
      symbol,
      type,
      entryReason: newNote.entryReason,
      exitReason: newNote.exitReason,
      tags: newNote.tags,
      sentiment: newNote.sentiment,
      lessonsLearned: newNote.lessonsLearned,
      createdAt: new Date().toISOString()
    };
    
    setNotes([...notes, note]);
    setNewNote({ entryReason: '', exitReason: '', tags: [], sentiment: 'neutral', lessonsLearned: '' });
    setIsNoteDialogOpen(false);
    setSelectedTransaction(null);
  };

  const toggleTag = (tag: string) => {
    if (newNote.tags.includes(tag)) {
      setNewNote({ ...newNote, tags: newNote.tags.filter(t => t !== tag) });
    } else {
      setNewNote({ ...newNote, tags: [...newNote.tags, tag] });
    }
  };

  // Filter transactions
  const filteredTransactions = transactionsWithPL.filter(txn => {
    if (filterTag !== 'all' && !txn.note?.tags.includes(filterTag)) return false;
    if (filterOutcome !== 'all') {
      if (filterOutcome === 'win' && txn.profitLoss <= 0) return false;
      if (filterOutcome === 'loss' && txn.profitLoss >= 0) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          Trade Journal
        </h1>
        <p className="text-muted-foreground mt-1">Track, analyze, and learn from your trades</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">Total Trades</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalTrades}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs">Win Rate</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{stats.winRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs">Avg Win</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">${stats.avgWin.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs">Avg Loss</span>
            </div>
            <p className="text-2xl font-bold text-red-500">-${stats.avgLoss.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Percent className="w-4 h-4" />
              <span className="text-xs">Profit Factor</span>
            </div>
            <p className="text-2xl font-bold">
              {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs">Largest Win</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">${stats.largestWin.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Largest Loss</span>
            </div>
            <p className="text-2xl font-bold text-red-500">${stats.largestLoss.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Avg Hold</span>
            </div>
            <p className="text-2xl font-bold">{stats.avgHoldingDays}d</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Trade Log</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {PRESET_TAGS.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterOutcome} onValueChange={setFilterOutcome}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="win">Winners</SelectItem>
                <SelectItem value="loss">Losers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trade Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">P/L</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No trades found. Add transactions to start journaling.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.slice(0, 50).map(txn => (
                      <TableRow key={txn.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(txn.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-bold">{cleanSymbol(txn.symbol)}</TableCell>
                        <TableCell>
                          <Badge className={
                            txn.type === 'BUY' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }>
                            {txn.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{txn.shares}</TableCell>
                        <TableCell className="text-right">${txn.price?.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {txn.type === 'SELL' && (
                            <span className={txn.profitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                              {txn.profitLoss >= 0 ? '+' : ''}${txn.profitLoss.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {txn.note?.tags.map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {txn.note && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                              {txn.note.entryReason}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Dialog open={isNoteDialogOpen && selectedTransaction === txn.id} onOpenChange={(open) => {
                            setIsNoteDialogOpen(open);
                            if (open) setSelectedTransaction(txn.id);
                          }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="gap-1">
                                <PenLine className="w-3 h-3" />
                                {txn.note ? 'Edit' : 'Add Note'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <BookOpen className="w-5 h-5" />
                                  Trade Note: {txn.type} {cleanSymbol(txn.symbol)}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="p-3 rounded-lg bg-muted">
                                  <div className="flex justify-between text-sm">
                                    <span>{format(new Date(txn.date), 'PPP')}</span>
                                    <span>{txn.shares} shares @ ${txn.price?.toFixed(2)}</span>
                                  </div>
                                  {txn.type === 'SELL' && (
                                    <p className={`font-bold ${txn.profitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                      P/L: {txn.profitLoss >= 0 ? '+' : ''}${txn.profitLoss.toFixed(2)}
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label>Entry Reason</Label>
                                  <Textarea
                                    value={newNote.entryReason}
                                    onChange={(e) => setNewNote({ ...newNote, entryReason: e.target.value })}
                                    placeholder="Why did you enter this trade?"
                                  />
                                </div>

                                {txn.type === 'SELL' && (
                                  <div className="space-y-2">
                                    <Label>Exit Reason</Label>
                                    <Textarea
                                      value={newNote.exitReason}
                                      onChange={(e) => setNewNote({ ...newNote, exitReason: e.target.value })}
                                      placeholder="Why did you exit this trade?"
                                    />
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <Label>Sentiment</Label>
                                  <div className="flex gap-2">
                                    {['bullish', 'neutral', 'bearish'].map((s) => (
                                      <Badge
                                        key={s}
                                        variant={newNote.sentiment === s ? 'default' : 'outline'}
                                        className="cursor-pointer capitalize"
                                        onClick={() => setNewNote({ ...newNote, sentiment: s as any })}
                                      >
                                        {s}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Tags</Label>
                                  <div className="flex gap-1 flex-wrap">
                                    {PRESET_TAGS.map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant={newNote.tags.includes(tag) ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => toggleTag(tag)}
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Lessons Learned</Label>
                                  <Textarea
                                    value={newNote.lessonsLearned}
                                    onChange={(e) => setNewNote({ ...newNote, lessonsLearned: e.target.value })}
                                    placeholder="What did you learn from this trade?"
                                  />
                                </div>

                                <Button 
                                  onClick={() => handleAddNote(txn.id, cleanSymbol(txn.symbol), txn.type)}
                                  className="w-full"
                                >
                                  Save Note
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {!hasClosedTrades ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">No closed trades yet</CardTitle>
                <CardDescription>
                  Analytics and insights are based on realized P/L. Add at least one <strong>SELL</strong> transaction to see charts.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Tip: your Trade Log will still show all BUY transactions, but P/L charts require a completed round trip (BUY → SELL).
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Win/Loss Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Win/Loss Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={outcomeDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {outcomeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Monthly P/L</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" fontSize={10} />
                          <YAxis tickFormatter={(v) => `$${v}`} fontSize={10} />
                          <Tooltip />
                          <Bar
                            dataKey="pnl"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance by Tag */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance by Strategy Tag</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(stats.byTag).map(([tag, data]) => (
                      <div key={tag} className="p-4 rounded-lg bg-muted">
                        <Badge variant="outline" className="mb-2">{tag}</Badge>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-emerald-500">Wins: {data.wins}</span>
                            <span className="text-red-500">Losses: {data.losses}</span>
                          </div>
                          <p className={`font-bold ${data.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {Object.keys(stats.byTag).length === 0 && (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        Add tags to your trades to see performance breakdown.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {!hasClosedTrades ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">No insights yet</CardTitle>
                <CardDescription>
                  Insights are generated from your closed trades (SELL transactions). Once you close a position, this tab will highlight what’s working and what to improve.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    What's Working
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {stats.winRate > 50 && (
                      <li className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500 mt-1" />
                        <span>Your win rate of {stats.winRate.toFixed(0)}% is above average</span>
                      </li>
                    )}
                    {stats.profitFactor > 1.5 && (
                      <li className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500 mt-1" />
                        <span>Profit factor of {stats.profitFactor.toFixed(2)} shows strong risk/reward</span>
                      </li>
                    )}
                    {stats.avgWin > stats.avgLoss && (
                      <li className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500 mt-1" />
                        <span>Average win (${stats.avgWin.toFixed(0)}) exceeds average loss (${stats.avgLoss.toFixed(0)})</span>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Areas to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {stats.winRate < 50 && (
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-1" />
                        <span>Win rate of {stats.winRate.toFixed(0)}% could be improved with better entry timing</span>
                      </li>
                    )}
                    {stats.avgLoss > stats.avgWin && (
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-1" />
                        <span>Consider tighter stop losses - avg loss exceeds avg win</span>
                      </li>
                    )}
                    {stats.largestLoss < -stats.largestWin && (
                      <li className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-1" />
                        <span>Largest loss (${Math.abs(stats.largestLoss).toFixed(0)}) is bigger than largest win - review risk management</span>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
