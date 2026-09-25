import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, PieChart, Eye, User, Calendar, DollarSign, LineChart } from 'lucide-react';
import { cleanSymbol } from '@/lib/utils';
import { format } from 'date-fns';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
interface SharedPortfolioData {
  id: string;
  portfolio_id: string;
  is_public: boolean;
  share_code: string;
  views_count: number;
  created_at: string;
  user_name?: string;
}

interface SharedHolding {
  symbol: string;
  name: string;
  shares: number;
  avg_price: number;
  current_price: number | null;
  sector: string | null;
  asset_type: string;
}

interface PortfolioSnapshot {
  snapshot_date: string;
  total_value: number;
}

const SharedPortfolioPage = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portfolioInfo, setPortfolioInfo] = useState<SharedPortfolioData | null>(null);
  const [holdings, setHoldings] = useState<SharedHolding[]>([]);
  const [portfolioName, setPortfolioName] = useState('');
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);

  useEffect(() => {
    const fetchSharedPortfolio = async () => {
      if (!shareCode) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        // Find the shared portfolio by share code
        const { data: sharedData, error: sharedError } = await supabase
          .from('shared_portfolios')
          .select('*')
          .eq('share_code', shareCode)
          .eq('is_public', true)
          .maybeSingle();

        if (sharedError) throw sharedError;
        if (!sharedData) {
          setError('Portfolio not found or not public');
          setLoading(false);
          return;
        }

        // Increment view count
        await supabase
          .from('shared_portfolios')
          .update({ views_count: (sharedData.views_count || 0) + 1 })
          .eq('id', sharedData.id);

        // Fetch portfolio name
        const { data: portfolioData } = await supabase
          .from('portfolios')
          .select('name')
          .eq('id', sharedData.portfolio_id)
          .single();

        // Fetch user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', sharedData.user_id)
          .single();

        // Fetch holdings
        const { data: holdingsData, error: holdingsError } = await supabase
          .from('holdings')
          .select('symbol, name, shares, avg_price, current_price, sector, asset_type')
          .eq('portfolio_id', sharedData.portfolio_id);

        if (holdingsError) throw holdingsError;

        // Fetch portfolio snapshots for performance chart
        const { data: snapshotsData } = await supabase
          .from('portfolio_snapshots')
          .select('snapshot_date, total_value')
          .eq('portfolio_id', sharedData.portfolio_id)
          .order('snapshot_date', { ascending: true })
          .limit(90);

        setPortfolioInfo({
          ...sharedData,
          user_name: profileData?.full_name || 'Anonymous Investor'
        });
        setPortfolioName(portfolioData?.name || 'Shared Portfolio');
        setHoldings(holdingsData || []);
        setSnapshots(snapshotsData || []);
      } catch (err) {
        console.error('Error fetching shared portfolio:', err);
        setError('Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedPortfolio();
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (error || !portfolioInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PieChart className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2">Portfolio Not Found</h2>
            <p className="text-muted-foreground">{error || 'This portfolio does not exist or is no longer public.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalValue = holdings.reduce((sum, h) => {
    const price = h.current_price || h.avg_price;
    return sum + (h.shares * price);
  }, 0);

  const totalCost = holdings.reduce((sum, h) => sum + (h.shares * h.avg_price), 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Group by sector
  const sectorAllocation = holdings.reduce((acc, h) => {
    const sector = h.sector || 'Other';
    const value = h.shares * (h.current_price || h.avg_price);
    acc[sector] = (acc[sector] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <Badge variant="secondary" className="mb-2">Shared Portfolio</Badge>
              <h1 className="text-3xl font-bold text-foreground mb-2">{portfolioName}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {portfolioInfo.user_name}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {portfolioInfo.views_count} views
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Shared {format(new Date(portfolioInfo.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-3xl font-bold text-foreground">
                ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-sm flex items-center justify-end gap-1 ${totalGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalGainLoss >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {totalGainLoss >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Holdings</p>
              <p className="text-2xl font-bold">{holdings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Unrealized P/L</p>
              <p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {totalGainLoss >= 0 ? '+' : ''}${totalGainLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Sectors</p>
              <p className="text-2xl font-bold">{Object.keys(sectorAllocation).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Sector Allocation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Sector Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(sectorAllocation)
                .sort((a, b) => b[1] - a[1])
                .map(([sector, value]) => (
                  <div key={sector} className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground truncate">{sector}</p>
                    <p className="font-bold">{((value / totalValue) * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Chart */}
        {snapshots.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Performance History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={snapshots.map(s => ({
                    date: format(new Date(s.snapshot_date), 'MMM d'),
                    value: s.total_value
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Holdings Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Holdings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Symbol</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Shares</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Avg Cost</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Value</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings
                    .sort((a, b) => {
                      const valA = a.shares * (a.current_price || a.avg_price);
                      const valB = b.shares * (b.current_price || b.avg_price);
                      return valB - valA;
                    })
                    .map((holding) => {
                      const value = holding.shares * (holding.current_price || holding.avg_price);
                      const allocation = (value / totalValue) * 100;
                      return (
                        <tr key={holding.symbol} className="border-b last:border-0">
                          <td className="py-3 font-bold">{cleanSymbol(holding.symbol)}</td>
                          <td className="py-3 text-muted-foreground truncate max-w-[150px]">{holding.name}</td>
                          <td className="py-3 text-right">{holding.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-3 text-right">${holding.avg_price.toFixed(2)}</td>
                          <td className="py-3 text-right font-medium">${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${Math.min(100, allocation)}%` }} 
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {allocation.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Shared via WealthOS</p>
          <a href="/" className="text-primary hover:underline text-sm">Create your own portfolio →</a>
        </div>
      </div>
    </div>
  );
};

export default SharedPortfolioPage;
