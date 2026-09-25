// Demo transaction history for sample data display
export interface DemoTransaction {
  id: string;
  date: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  shares: number;
  price: number;
  totalValue: number;
  notes?: string;
}

export const DEMO_TRANSACTIONS: DemoTransaction[] = [
  // Recent Buy transactions
  {
    id: 'demo-txn-1',
    date: '2025-01-15',
    type: 'BUY',
    symbol: 'AAPL',
    shares: 10,
    price: 185.50,
    totalValue: 1855.00,
    notes: 'Adding to core tech position'
  },
  {
    id: 'demo-txn-2',
    date: '2025-01-10',
    type: 'BUY',
    symbol: 'MSFT',
    shares: 5,
    price: 425.00,
    totalValue: 2125.00,
    notes: 'Long-term hold'
  },
  {
    id: 'demo-txn-3',
    date: '2025-01-08',
    type: 'SELL',
    symbol: 'NVDA',
    shares: 3,
    price: 520.00,
    totalValue: 1560.00,
    notes: 'Taking partial profits'
  },
  {
    id: 'demo-txn-4',
    date: '2024-12-20',
    type: 'BUY',
    symbol: 'JNJ',
    shares: 15,
    price: 155.25,
    totalValue: 2328.75,
    notes: 'Healthcare sector allocation'
  },
  {
    id: 'demo-txn-5',
    date: '2024-12-15',
    type: 'BUY',
    symbol: 'O',
    shares: 20,
    price: 58.50,
    totalValue: 1170.00,
    notes: 'Monthly dividend REIT'
  },
  {
    id: 'demo-txn-6',
    date: '2024-12-10',
    type: 'BUY',
    symbol: 'NVDA',
    shares: 8,
    price: 475.00,
    totalValue: 3800.00,
    notes: 'AI growth position'
  },
  {
    id: 'demo-txn-7',
    date: '2024-11-28',
    type: 'SELL',
    symbol: 'AAPL',
    shares: 5,
    price: 192.00,
    totalValue: 960.00,
    notes: 'Rebalancing portfolio'
  },
  {
    id: 'demo-txn-8',
    date: '2024-11-15',
    type: 'BUY',
    symbol: 'AAPL',
    shares: 25,
    price: 178.00,
    totalValue: 4450.00,
    notes: 'Initial position'
  },
  {
    id: 'demo-txn-9',
    date: '2024-11-10',
    type: 'BUY',
    symbol: 'MSFT',
    shares: 10,
    price: 410.00,
    totalValue: 4100.00,
    notes: 'Cloud computing exposure'
  },
  {
    id: 'demo-txn-10',
    date: '2024-10-25',
    type: 'BUY',
    symbol: 'VTI',
    shares: 15,
    price: 242.50,
    totalValue: 3637.50,
    notes: 'Total market ETF'
  },
  {
    id: 'demo-txn-11',
    date: '2024-10-15',
    type: 'SELL',
    symbol: 'VTI',
    shares: 5,
    price: 245.00,
    totalValue: 1225.00,
    notes: 'Tax loss harvesting swap'
  },
  {
    id: 'demo-txn-12',
    date: '2024-09-20',
    type: 'BUY',
    symbol: 'SCHD',
    shares: 30,
    price: 78.25,
    totalValue: 2347.50,
    notes: 'Dividend growth ETF'
  }
];

// Calculate demo transaction portfolio value
export const DEMO_TRANSACTIONS_TOTAL_BOUGHT = DEMO_TRANSACTIONS
  .filter(t => t.type === 'BUY')
  .reduce((sum, t) => sum + t.totalValue, 0);

export const DEMO_TRANSACTIONS_TOTAL_SOLD = DEMO_TRANSACTIONS
  .filter(t => t.type === 'SELL')
  .reduce((sum, t) => sum + t.totalValue, 0);
