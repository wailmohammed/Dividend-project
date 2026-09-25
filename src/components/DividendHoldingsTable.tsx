import { useMemo, useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, RefreshCw, Loader2, Search, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, BellOff, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { cleanSymbol } from '@/lib/utils';
import { YieldSparkline } from './dividend/YieldSparkline';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { format, differenceInDays, parseISO, isFuture } from 'date-fns';

interface HoldingData {
  id: string;
  symbol: string;
  name?: string;
  shares: number;
  currentPrice?: number;
  dividendYield?: number;
  annualIncome: number;
  sector?: string;
  assetType?: string;
  nextExDate?: string;
}

interface DividendHoldingsTableProps {
  holdings: HoldingData[];
  onFetchSingle: (symbol: string) => void;
  singleFetchLoading: string | null;
  batchProgress: { current: number; total: number; currentSymbol: string } | null;
}

type SortKey = 'symbol' | 'shares' | 'currentPrice' | 'dividendYield' | 'annualIncome' | 'nextExDate';
type SortDirection = 'asc' | 'desc';

export const DividendHoldingsTable = ({
  holdings,
  onFetchSingle,
  singleFetchLoading,
  batchProgress
}: DividendHoldingsTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('nextExDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [yieldFilter, setYieldFilter] = useState<string>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showDividendPayingOnly, setShowDividendPayingOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [snoozedSymbols, setSnoozedSymbols] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('snoozed-exdate-alerts');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Clear snoozes older than 24 hours
        if (parsed.timestamp && Date.now() - parsed.timestamp < 86400000) {
          return parsed.symbols || [];
        }
      }
    } catch {}
    return [];
  });
  const pageSize = 10;

  // Get unique sectors for filter
  const sectors = useMemo(() => {
    const sectorSet = new Set<string>();
    holdings.forEach(h => {
      if (h.sector) sectorSet.add(h.sector);
    });
    return Array.from(sectorSet).sort();
  }, [holdings]);

  // Filter and sort holdings
  const filteredAndSorted = useMemo(() => {
    let result = [...holdings];

    // Toggle: show dividend-paying only
    if (showDividendPayingOnly) {
      result = result.filter(h => (h.dividendYield || 0) > 0 || h.annualIncome > 0);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(h => 
        h.symbol.toLowerCase().includes(query) ||
        (h.name?.toLowerCase().includes(query))
      );
    }

    // Yield filter
    if (yieldFilter !== 'all') {
      switch (yieldFilter) {
        case 'paying':
          result = result.filter(h => (h.dividendYield || 0) > 0);
          break;
        case 'high':
          result = result.filter(h => (h.dividendYield || 0) > 4);
          break;
        case 'medium':
          result = result.filter(h => (h.dividendYield || 0) >= 2 && (h.dividendYield || 0) <= 4);
          break;
        case 'low':
          result = result.filter(h => (h.dividendYield || 0) > 0 && (h.dividendYield || 0) < 2);
          break;
        case 'none':
          result = result.filter(h => (h.dividendYield || 0) === 0);
          break;
      }
    }

    // Sector filter
    if (sectorFilter !== 'all') {
      result = result.filter(h => h.sector === sectorFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortKey === 'nextExDate') {
        const aDate = a.nextExDate ? new Date(a.nextExDate).getTime() : Infinity;
        const bDate = b.nextExDate ? new Date(b.nextExDate).getTime() : Infinity;
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      let aVal: any = a[sortKey];
      let bVal: any = b[sortKey];
      
      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [holdings, searchQuery, yieldFilter, sectorFilter, sortKey, sortDirection, showDividendPayingOnly]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const paginatedHoldings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  // Summary stats for filtered holdings
  const summaryStats = useMemo(() => {
    const totalAnnual = filteredAndSorted.reduce((sum, h) => sum + h.annualIncome, 0);
    const totalValue = filteredAndSorted.reduce((sum, h) => sum + ((h.shares || 0) * (h.currentPrice || 0)), 0);
    const avgYield = totalValue > 0 ? (totalAnnual / totalValue) * 100 : 0;
    return { totalAnnual, totalMonthly: totalAnnual / 12, avgYield };
  }, [filteredAndSorted]);

  // Holdings with ex-dates within 3 days
  const urgentExDateHoldings = useMemo(() => {
    return filteredAndSorted.filter(h => {
      if (!h.nextExDate) return false;
      if (snoozedSymbols.includes(cleanSymbol(h.symbol))) return false;
      const exDate = parseISO(h.nextExDate);
      const days = differenceInDays(exDate, new Date());
      return isFuture(exDate) && days <= 3;
    });
  }, [filteredAndSorted, snoozedSymbols]);

  const handleSnoozeAll = useCallback(() => {
    const symbols = urgentExDateHoldings.map(h => cleanSymbol(h.symbol));
    const newSnoozed = [...new Set([...snoozedSymbols, ...symbols])];
    setSnoozedSymbols(newSnoozed);
    localStorage.setItem('snoozed-exdate-alerts', JSON.stringify({ symbols: newSnoozed, timestamp: Date.now() }));
  }, [urgentExDateHoldings, snoozedSymbols]);

  const handleExportCSV = useCallback(() => {
    const rows = [
      ['Symbol', 'Name', 'Shares', 'Price', 'Yield %', 'Annual Income', 'Monthly Income', 'Sector', 'Ex-Date'],
      ...filteredAndSorted.map(h => [
        cleanSymbol(h.symbol),
        h.name || '',
        (h.shares || 0).toFixed(2),
        (h.currentPrice || 0).toFixed(2),
        (h.dividendYield || 0).toFixed(2),
        h.annualIncome.toFixed(2),
        (h.annualIncome / 12).toFixed(2),
        h.sector || '',
        h.nextExDate ? format(parseISO(h.nextExDate), 'yyyy-MM-dd') : '',
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dividend-holdings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredAndSorted]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, yieldFilter, sectorFilter, showDividendPayingOnly]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="w-3 h-3 text-muted-foreground" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setYieldFilter('all');
    setSectorFilter('all');
  };

  const hasActiveFilters = searchQuery || yieldFilter !== 'all' || sectorFilter !== 'all';
  const totalDividendPaying = holdings.filter(h => (h.dividendYield || 0) > 0 || h.annualIncome > 0).length;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">Dividend Holdings ({filteredAndSorted.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="dividend-paying-toggle"
              checked={showDividendPayingOnly}
              onCheckedChange={setShowDividendPayingOnly}
            />
            <Label htmlFor="dividend-paying-toggle" className="text-xs text-muted-foreground cursor-pointer">
              Dividend paying only ({totalDividendPaying}/{holdings.length})
            </Label>
            {showDividendPayingOnly && totalDividendPaying < holdings.length && (
              <span className="text-[10px] text-muted-foreground/70">
                — {holdings.length - totalDividendPaying} hidden (yield not fetched?)
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[150px] h-9"
            />
          </div>
          
          {/* Toggle Filters */}
          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                {(yieldFilter !== 'all' ? 1 : 0) + (sectorFilter !== 'all' ? 1 : 0)}
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="w-4 h-4" />
              Clear
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            CSV
          </Button>

        </div>
      </CardHeader>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 pb-4 flex flex-wrap gap-4 border-b border-border">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Dividend Yield</label>
            <Select value={yieldFilter} onValueChange={setYieldFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Yields</SelectItem>
                <SelectItem value="paying">Dividend Paying Only</SelectItem>
                <SelectItem value="high">High (&gt;4%)</SelectItem>
                <SelectItem value="medium">Medium (2-4%)</SelectItem>
                <SelectItem value="low">Low (&lt;2%)</SelectItem>
                <SelectItem value="none">No Dividend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sectors.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Sector</label>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sectors</SelectItem>
                  {sectors.map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <CardContent>
        {/* Urgent ex-date alert */}
        {urgentExDateHoldings.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {urgentExDateHoldings.length} holding{urgentExDateHoldings.length > 1 ? 's' : ''} with ex-dividend date within 3 days
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {urgentExDateHoldings.map(h => {
                  const days = differenceInDays(parseISO(h.nextExDate!), new Date());
                  return `${cleanSymbol(h.symbol)} (${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d`})`;
                }).join(', ')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSnoozeAll} className="shrink-0 gap-1 text-muted-foreground hover:text-foreground">
              <BellOff className="w-4 h-4" />
              Dismiss
            </Button>
          </div>
        )}
        {filteredAndSorted.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No holdings match your filters</p>
            <p className="text-sm">Try adjusting your search or filter criteria</p>
            {showDividendPayingOnly && (
              <Button variant="link" size="sm" onClick={() => setShowDividendPayingOnly(false)} className="mt-2">
                Show all holdings
              </Button>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider"
                      onClick={() => handleSort('symbol')}
                    >
                      Symbol <SortIcon columnKey="symbol" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('shares')}
                    >
                      Shares <SortIcon columnKey="shares" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Price <SortIcon columnKey="currentPrice" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('dividendYield')}
                    >
                      Yield <SortIcon columnKey="dividendYield" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    12M Trend
                  </th>
                  <th className="text-right py-3 px-4">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('annualIncome')}
                    >
                      Annual Income <SortIcon columnKey="annualIncome" />
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Monthly
                  </th>
                  <th className="text-right py-3 px-4 hidden lg:table-cell">
                    <button 
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider ml-auto"
                      onClick={() => handleSort('nextExDate')}
                    >
                      Ex-Date <SortIcon columnKey="nextExDate" />
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedHoldings.map(holding => {
                  const cleanedSymbol = cleanSymbol(holding.symbol);
                  const isFetching = singleFetchLoading === cleanedSymbol;
                  
                  return (
                    <tr key={`${holding.symbol}-${holding.id}`} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{cleanedSymbol}</span>
                          {holding.sector && (
                            <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                              {holding.sector}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">{(holding.shares || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-foreground">${(holding.currentPrice || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${
                          (holding.dividendYield || 0) > 4 ? 'text-emerald-500' :
                          (holding.dividendYield || 0) > 2 ? 'text-blue-500' :
                          'text-foreground'
                        }`}>
                          {(holding.dividendYield || 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <YieldSparkline
                          currentYield={holding.dividendYield || 0}
                          symbol={holding.symbol}
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-500">
                        ${holding.annualIncome.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        ${(holding.annualIncome / 12).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right hidden lg:table-cell">
                        {holding.nextExDate ? (() => {
                          const exDate = parseISO(holding.nextExDate);
                          const daysUntil = differenceInDays(exDate, new Date());
                          const isUpcoming = isFuture(exDate) && daysUntil <= 14;
                          const isSoon = isFuture(exDate) && daysUntil <= 7;
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`text-sm font-medium inline-flex items-center gap-1 ${
                                  isSoon ? 'text-destructive' :
                                  isUpcoming ? 'text-chart-4' :
                                  isFuture(exDate) ? 'text-primary' :
                                  'text-muted-foreground'
                                }`}>
                                  <CalendarDays className="w-3 h-3" />
                                  {format(exDate, 'MMM d')}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{format(exDate, 'MMMM d, yyyy')}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isFuture(exDate) ? `${daysUntil} day${daysUntil !== 1 ? 's' : ''} away` : 'Past'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })() : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onFetchSingle(holding.symbol)}
                          disabled={isFetching || batchProgress !== null}
                          className="h-8 px-2"
                        >
                          {isFetching ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="py-3 px-4 font-semibold text-foreground" colSpan={3}>
                    Totals ({filteredAndSorted.length} holdings)
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-foreground">
                    {summaryStats.avgYield.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell" />
                  <td className="py-3 px-4 text-right font-semibold text-primary">
                    ${summaryStats.totalAnnual.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">
                    ${summaryStats.totalMonthly.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell" />
                  <td className="py-3 px-4" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredAndSorted.length)} of {filteredAndSorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && page - prev > 1;
                    return (
                      <span key={page} className="flex items-center">
                        {showEllipsis && <span className="px-1 text-muted-foreground text-sm">…</span>}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      </span>
                    );
                  })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
