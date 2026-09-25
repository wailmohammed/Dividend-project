import { useState, useEffect } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePortfolio } from '@/context/PortfolioContext';

export const CashBalanceForm = () => {
  const { activePortfolio, refetchPortfolio } = usePortfolio();
  const [cashBalance, setCashBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (activePortfolio?.cashBalance !== undefined) {
      setCashBalance(activePortfolio.cashBalance.toString());
    }
  }, [activePortfolio?.cashBalance]);

  const handleSave = async () => {
    if (!activePortfolio?.id || activePortfolio.id === 'loading') {
      toast.error('No portfolio selected');
      return;
    }

    const parsedAmount = parseFloat(cashBalance);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('portfolios')
        .update({ cash_balance: parsedAmount, updated_at: new Date().toISOString() })
        .eq('id', activePortfolio.id);

      if (error) throw error;

      await refetchPortfolio();
      toast.success('Cash balance updated successfully');
    } catch (err: any) {
      console.error('Failed to update cash balance:', err);
      toast.error(err.message || 'Failed to update cash balance');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Cash Balance
        </CardTitle>
        <CardDescription>
          Set your available cash balance for portfolio "{activePortfolio?.name || 'Loading...'}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cash-balance">Available Cash</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="cash-balance"
              type="number"
              step="0.01"
              min="0"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              placeholder="0.00"
              className="pl-7"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter your uninvested cash that's available in your brokerage account
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSaving ? 'Saving...' : 'Update Cash Balance'}
          </Button>
          {activePortfolio?.cashBalance !== undefined && (
            <span className="text-sm text-muted-foreground">
              Current: ${activePortfolio.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
