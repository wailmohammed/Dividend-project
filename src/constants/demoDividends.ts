import { format, subDays, addDays } from 'date-fns';

const today = new Date();

export interface DemoDividend {
  id: string;
  holding_id: string;
  portfolio_id: string;
  symbol: string;
  amount: number;
  ex_date: string;
  pay_date: string;
  frequency: 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual' | 'Irregular';
  is_estimated: boolean;
}

/**
 * Demo dividends for preview mode - shows realistic dividend income scenarios
 */
export const DEMO_DIVIDENDS: DemoDividend[] = [
  // Recent past dividends
  {
    id: 'demo-div-1',
    holding_id: 'demo-holding-1',
    portfolio_id: 'demo-portfolio',
    symbol: 'AAPL',
    amount: 24.00,
    ex_date: format(subDays(today, 45), 'yyyy-MM-dd'),
    pay_date: format(subDays(today, 30), 'yyyy-MM-dd'),
    frequency: 'Quarterly',
    is_estimated: false,
  },
  {
    id: 'demo-div-2',
    holding_id: 'demo-holding-2',
    portfolio_id: 'demo-portfolio',
    symbol: 'MSFT',
    amount: 22.50,
    ex_date: format(subDays(today, 60), 'yyyy-MM-dd'),
    pay_date: format(subDays(today, 45), 'yyyy-MM-dd'),
    frequency: 'Quarterly',
    is_estimated: false,
  },
  {
    id: 'demo-div-3',
    holding_id: 'demo-holding-3',
    portfolio_id: 'demo-portfolio',
    symbol: 'JNJ',
    amount: 47.60,
    ex_date: format(subDays(today, 30), 'yyyy-MM-dd'),
    pay_date: format(subDays(today, 15), 'yyyy-MM-dd'),
    frequency: 'Quarterly',
    is_estimated: false,
  },
  {
    id: 'demo-div-4',
    holding_id: 'demo-holding-4',
    portfolio_id: 'demo-portfolio',
    symbol: 'O',
    amount: 16.20,
    ex_date: format(subDays(today, 15), 'yyyy-MM-dd'),
    pay_date: format(subDays(today, 5), 'yyyy-MM-dd'),
    frequency: 'Monthly',
    is_estimated: false,
  },
  // Upcoming dividends
  {
    id: 'demo-div-5',
    holding_id: 'demo-holding-5',
    portfolio_id: 'demo-portfolio',
    symbol: 'KO',
    amount: 18.60,
    ex_date: format(addDays(today, 10), 'yyyy-MM-dd'),
    pay_date: format(addDays(today, 25), 'yyyy-MM-dd'),
    frequency: 'Quarterly',
    is_estimated: true,
  },
  {
    id: 'demo-div-6',
    holding_id: 'demo-holding-6',
    portfolio_id: 'demo-portfolio',
    symbol: 'PG',
    amount: 37.56,
    ex_date: format(addDays(today, 20), 'yyyy-MM-dd'),
    pay_date: format(addDays(today, 35), 'yyyy-MM-dd'),
    frequency: 'Quarterly',
    is_estimated: true,
  },
  {
    id: 'demo-div-7',
    holding_id: 'demo-holding-4',
    portfolio_id: 'demo-portfolio',
    symbol: 'O',
    amount: 16.20,
    ex_date: format(addDays(today, 15), 'yyyy-MM-dd'),
    pay_date: format(addDays(today, 25), 'yyyy-MM-dd'),
    frequency: 'Monthly',
    is_estimated: true,
  },
  {
    id: 'demo-div-8',
    holding_id: 'demo-holding-7',
    portfolio_id: 'demo-portfolio',
    symbol: 'VZ',
    amount: 33.15,
    ex_date: format(addDays(today, 30), 'yyyy-MM-dd'),
    pay_date: format(addDays(today, 45), 'yyyy-MM-dd'),
    frequency: 'Quarterly',
    is_estimated: true,
  },
];

// Demo dividend summary stats
export const DEMO_DIVIDEND_STATS = {
  totalAnnualIncome: 2847.24,
  monthlyAverage: 237.27,
  averageYield: 3.42,
  dividendPayingCount: 8,
};
