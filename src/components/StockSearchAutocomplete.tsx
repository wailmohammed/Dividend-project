import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { fetchMarketPrices } from '@/services/marketDataService';

interface StockSearchResult {
  symbol: string;
  name: string;
  type?: string;
}

interface StockSearchAutocompleteProps {
  onSelect: (symbol: string, name: string) => void;
  placeholder?: string;
}

// Popular stocks for quick suggestions
const POPULAR_STOCKS: StockSearchResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble Co.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'HD', name: 'The Home Depot Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'PEP', name: 'PepsiCo Inc.' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.' },
  { symbol: 'T', name: 'AT&T Inc.' },
  { symbol: 'VZ', name: 'Verizon Communications Inc.' },
  { symbol: 'BAC', name: 'Bank of America Corporation' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { symbol: 'SCHD', name: 'Schwab US Dividend Equity ETF' },
];

export const StockSearchAutocomplete = ({ onSelect, placeholder = 'Search stocks...' }: StockSearchAutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter popular stocks based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults(POPULAR_STOCKS.slice(0, 8));
      return;
    }

    const q = query.toUpperCase();
    const filtered = POPULAR_STOCKS.filter(
      s => s.symbol.includes(q) || s.name.toUpperCase().includes(q)
    );

    // If no match found in popular stocks, add the typed symbol as custom option
    if (filtered.length === 0) {
      setResults([{ symbol: query.toUpperCase(), name: 'Custom symbol', type: 'custom' }]);
    } else {
      setResults(filtered.slice(0, 8));
    }
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (stock: StockSearchResult) => {
    // For custom symbols, try to validate by fetching price
    if (stock.type === 'custom') {
      setValidating(true);
      try {
        const prices = await fetchMarketPrices([stock.symbol], 'mixed');
        if (prices[stock.symbol]) {
          onSelect(stock.symbol, stock.symbol);
        } else {
          // Still allow adding even if price not found
          onSelect(stock.symbol, stock.symbol);
        }
      } catch {
        onSelect(stock.symbol, stock.symbol);
      } finally {
        setValidating(false);
      }
    } else {
      onSelect(stock.symbol, stock.name);
    }
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10"
          disabled={validating}
        />
        {(loading || validating) && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {!query.trim() && (
            <div className="px-3 py-2 text-xs text-muted-foreground font-medium border-b border-border">
              Popular Stocks
            </div>
          )}
          {results.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => handleSelect(stock)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent transition-colors text-left"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{stock.symbol}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {stock.name}
                </span>
              </div>
              {stock.type === 'custom' && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Custom
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
