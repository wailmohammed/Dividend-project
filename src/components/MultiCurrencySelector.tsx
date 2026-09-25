import React, { useState, useEffect, createContext, useContext } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // Rate to USD
}

const CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rate: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rate: 0.92 },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rate: 0.79 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', rate: 1.36 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', rate: 1.53 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', rate: 149.50 },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', flag: '🇨🇭', rate: 0.88 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', rate: 83.12 },
];

interface CurrencyContextType {
  currency: CurrencyConfig;
  setCurrencyCode: (code: string) => void;
  convert: (usdAmount: number) => number;
  format: (usdAmount: number, decimals?: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: CURRENCIES[0],
  setCurrencyCode: () => {},
  convert: (v) => v,
  format: (v) => `$${v.toFixed(2)}`,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencyCode, setCurrencyCode] = useState(() => localStorage.getItem('wealthos-currency') || 'USD');
  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];

  useEffect(() => {
    localStorage.setItem('wealthos-currency', currencyCode);
  }, [currencyCode]);

  const convert = (usdAmount: number) => usdAmount * currency.rate;
  
  const format = (usdAmount: number, decimals = 2) => {
    const converted = convert(usdAmount);
    if (currency.code === 'JPY') decimals = 0;
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrencyCode, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const CurrencySelector: React.FC<{ className?: string }> = ({ className }) => {
  const { currency, setCurrencyCode } = useCurrency();

  return (
    <Select value={currency.code} onValueChange={setCurrencyCode}>
      <SelectTrigger className={`w-[130px] h-8 text-xs ${className || ''}`}>
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span>{currency.flag}</span>
            <span className="font-medium">{currency.code}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map(c => (
          <SelectItem key={c.code} value={c.code}>
            <span className="flex items-center gap-2">
              <span>{c.flag}</span>
              <span className="font-medium">{c.code}</span>
              <span className="text-muted-foreground text-xs">{c.symbol}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CurrencySelector;
