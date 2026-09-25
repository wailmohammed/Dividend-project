import { TaxLot } from '@/hooks/useTaxLots';
import { subDays, format } from 'date-fns';

const today = new Date();

/**
 * Demo tax lots for preview mode - shows realistic scenarios for:
 * - Positions approaching long-term status (different timeframes)
 * - Wash sale risk scenarios
 * - Realized gains/losses for Form 8949 export demo
 */
export const DEMO_TAX_LOTS: TaxLot[] = [
  // Open positions - approaching long-term status
  {
    id: 'demo-lot-1',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'AAPL',
    shares: 50,
    cost_basis: 195,
    purchase_date: format(subDays(today, 340), 'yyyy-MM-dd'), // 25 days to long-term
    sale_date: null,
    sale_price: null,
    realized_gain_loss: null,
    is_closed: false,
    lot_type: 'buy',
    created_at: format(subDays(today, 340), 'yyyy-MM-dd'),
  },
  {
    id: 'demo-lot-2',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'MSFT',
    shares: 30,
    cost_basis: 420,
    purchase_date: format(subDays(today, 350), 'yyyy-MM-dd'), // 15 days to long-term
    sale_date: null,
    sale_price: null,
    realized_gain_loss: null,
    is_closed: false,
    lot_type: 'buy',
    created_at: format(subDays(today, 350), 'yyyy-MM-dd'),
  },
  {
    id: 'demo-lot-3',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'GOOGL',
    shares: 20,
    cost_basis: 175,
    purchase_date: format(subDays(today, 400), 'yyyy-MM-dd'), // Already long-term
    sale_date: null,
    sale_price: null,
    realized_gain_loss: null,
    is_closed: false,
    lot_type: 'buy',
    created_at: format(subDays(today, 400), 'yyyy-MM-dd'),
  },
  {
    id: 'demo-lot-4',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'NVDA',
    shares: 25,
    cost_basis: 550,
    purchase_date: format(subDays(today, 120), 'yyyy-MM-dd'), // Far from long-term
    sale_date: null,
    sale_price: null,
    realized_gain_loss: null,
    is_closed: false,
    lot_type: 'buy',
    created_at: format(subDays(today, 120), 'yyyy-MM-dd'),
  },
  {
    id: 'demo-lot-5',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'META',
    shares: 15,
    cost_basis: 580,
    purchase_date: format(subDays(today, 60), 'yyyy-MM-dd'), // Recent purchase
    sale_date: null,
    sale_price: null,
    realized_gain_loss: null,
    is_closed: false,
    lot_type: 'buy',
    created_at: format(subDays(today, 60), 'yyyy-MM-dd'),
  },
  // Wash sale risk scenario - recent sale at a loss
  {
    id: 'demo-lot-6',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'AAPL',
    shares: 20,
    cost_basis: 200,
    purchase_date: format(subDays(today, 180), 'yyyy-MM-dd'),
    sale_date: format(subDays(today, 10), 'yyyy-MM-dd'), // Sold 10 days ago at a loss
    sale_price: 175,
    realized_gain_loss: -500, // $25 loss x 20 shares
    is_closed: true,
    lot_type: 'buy',
    created_at: format(subDays(today, 180), 'yyyy-MM-dd'),
  },
  // Closed positions for Form 8949 demo
  {
    id: 'demo-lot-7',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'TSLA',
    shares: 10,
    cost_basis: 180,
    purchase_date: format(subDays(today, 200), 'yyyy-MM-dd'),
    sale_date: format(subDays(today, 30), 'yyyy-MM-dd'),
    sale_price: 250,
    realized_gain_loss: 700, // Short-term gain
    is_closed: true,
    lot_type: 'buy',
    created_at: format(subDays(today, 200), 'yyyy-MM-dd'),
  },
  {
    id: 'demo-lot-8',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'AMD',
    shares: 40,
    cost_basis: 140,
    purchase_date: format(subDays(today, 400), 'yyyy-MM-dd'),
    sale_date: format(subDays(today, 45), 'yyyy-MM-dd'),
    sale_price: 165,
    realized_gain_loss: 1000, // Long-term gain
    is_closed: true,
    lot_type: 'buy',
    created_at: format(subDays(today, 400), 'yyyy-MM-dd'),
  },
  {
    id: 'demo-lot-9',
    user_id: 'demo-user',
    portfolio_id: 'demo-portfolio',
    holding_id: null,
    symbol: 'INTC',
    shares: 100,
    cost_basis: 45,
    purchase_date: format(subDays(today, 150), 'yyyy-MM-dd'),
    sale_date: format(subDays(today, 20), 'yyyy-MM-dd'),
    sale_price: 32,
    realized_gain_loss: -1300, // Short-term loss
    is_closed: true,
    lot_type: 'buy',
    created_at: format(subDays(today, 150), 'yyyy-MM-dd'),
  },
];

// Demo prices for the demo lots (simulating current market prices)
export const DEMO_PRICES: Record<string, number> = {
  'AAPL': 178, // At a loss from $195 cost basis
  'MSFT': 395, // At a loss from $420 cost basis
  'GOOGL': 185, // At a gain from $175 cost basis
  'NVDA': 480, // At a loss from $550 cost basis
  'META': 520, // At a loss from $580 cost basis
};
