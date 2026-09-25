import { PriceAlert } from '@/hooks/usePriceAlerts';

/**
 * Demo price alerts for preview mode
 */
export const DEMO_PRICE_ALERTS: PriceAlert[] = [
  {
    id: 'demo-alert-1',
    user_id: 'demo-user',
    symbol: 'AAPL',
    target_price: 200.00,
    alert_type: 'above',
    is_active: true,
    triggered_at: null,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-alert-2',
    user_id: 'demo-user',
    symbol: 'MSFT',
    target_price: 350.00,
    alert_type: 'below',
    is_active: true,
    triggered_at: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-alert-3',
    user_id: 'demo-user',
    symbol: 'JNJ',
    target_price: 165.00,
    alert_type: 'above',
    is_active: true,
    triggered_at: null,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-alert-4',
    user_id: 'demo-user',
    symbol: 'KO',
    target_price: 55.00,
    alert_type: 'below',
    is_active: false,
    triggered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-alert-5',
    user_id: 'demo-user',
    symbol: 'VZ',
    target_price: 40.00,
    alert_type: 'above',
    is_active: true,
    triggered_at: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
