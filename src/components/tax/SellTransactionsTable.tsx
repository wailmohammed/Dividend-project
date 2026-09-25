import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowUpDown, Search, AlertTriangle, Clock, Timer, Filter } from 'lucide-react';

export interface SellWithPL {
  id: string;
  symbol: string;
  date: string;
  shares: number;
  price: number;
  total: number;
  costBasis: number;
  profitLoss: number;
  profitLossPercent: number;
  holdingDays: number;
  isLongTerm: boolean;
  purchaseDate: string;
  isWashSale?: boolean;
  washSaleDisallowed?: number;
}

interface Props {
  sells: SellWithPL[];
}

type SortKey = 'date' | 'symbol' | 'profitLoss' | 'holdingDays' | 'total';
type SortOrder = 'asc' | 'desc';
type TermFilter = 'all' | 'short' | 'long';
type WashSaleFilter = 'all' | 'wash' | 'clean';

export const SellTransactionsTable = ({ sells }: Props) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [termFilter, setTermFilter] = useState<TermFilter>('all');
  const [washSaleFilter, setWashSaleFilter] = useState<WashSaleFilter>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredSells = sells
    .filter(s => {
      const matchesSearch = s.symbol.toLowerCase().includes(search.toLowerCase());
      const matchesTerm = termFilter === 'all' || 
        (termFilter === 'short' && !s.isLongTerm) || 
        (termFilter === 'long' && s.isLongTerm);
      const matchesWash = washSaleFilter === 'all' ||
        (washSaleFilter === 'wash' && s.isWashSale) ||
        (washSaleFilter === 'clean' && !s.isWashSale);
      return matchesSearch && matchesTerm && matchesWash;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'profitLoss':
          comparison = a.profitLoss - b.profitLoss;
          break;
        case 'holdingDays':
          comparison = a.holdingDays - b.holdingDays;
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const washSaleCount = sells.filter(s => s.isWashSale).length;

  const SortButton = ({ column, label }: { column: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 -ml-3 font-medium"
      onClick={() => handleSort(column)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Detailed SELL Transactions
            <Badge variant="secondary">{sells.length} trades</Badge>
            {washSaleCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {washSaleCount} Wash Sales
              </Badge>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={termFilter} onValueChange={(v: TermFilter) => setTermFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              <SelectItem value="short">Short-Term Only</SelectItem>
              <SelectItem value="long">Long-Term Only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={washSaleFilter} onValueChange={(v: WashSaleFilter) => setWashSaleFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="wash">Wash Sales Only</SelectItem>
              <SelectItem value="clean">Clean Sales Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortButton column="date" label="Sale Date" /></TableHead>
                <TableHead><SortButton column="symbol" label="Symbol" /></TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="text-right"><SortButton column="total" label="Proceeds" /></TableHead>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right"><SortButton column="profitLoss" label="Gain/Loss" /></TableHead>
                <TableHead className="text-center"><SortButton column="holdingDays" label="Holding Period" /></TableHead>
                <TableHead className="text-center">Term</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSells.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No sell transactions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSells.map((sell) => (
                  <TableRow 
                    key={sell.id} 
                    className={sell.isWashSale ? 'bg-destructive/5' : ''}
                  >
                    <TableCell className="font-medium">
                      {format(new Date(sell.date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{sell.symbol}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {sell.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${sell.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${sell.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${sell.costBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${sell.profitLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {sell.profitLoss >= 0 ? '+' : ''}${sell.profitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <span className="text-xs font-normal block">
                        ({sell.profitLossPercent >= 0 ? '+' : ''}{sell.profitLossPercent.toFixed(1)}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-medium">{sell.holdingDays} days</span>
                        <span className="text-xs text-muted-foreground">
                          Acquired: {format(new Date(sell.purchaseDate), 'MMM d, yy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {sell.isLongTerm ? (
                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          <Clock className="w-3 h-3 mr-1" />
                          Long
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                          <Timer className="w-3 h-3 mr-1" />
                          Short
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {sell.isWashSale ? (
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Wash Sale
                          </Badge>
                          {sell.washSaleDisallowed && (
                            <span className="text-xs text-red-500">
                              -${sell.washSaleDisallowed.toFixed(2)} disallowed
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Clean
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
          <span>Showing {filteredSells.length} of {sells.length} transactions</span>
          <span>•</span>
          <span className="text-emerald-500">
            {filteredSells.filter(s => s.profitLoss >= 0).length} wins
          </span>
          <span className="text-red-500">
            {filteredSells.filter(s => s.profitLoss < 0).length} losses
          </span>
          {washSaleCount > 0 && (
            <>
              <span>•</span>
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {washSaleCount} wash sales detected
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
