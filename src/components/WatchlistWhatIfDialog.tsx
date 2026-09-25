import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { FlaskConical, TrendingUp, TrendingDown, PieChart, DollarSign } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';

interface WatchlistWhatIfDialogProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  name?: string;
  price?: number;
  dividendYield?: number; // percent
  sector?: string;
}

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export const WatchlistWhatIfDialog = ({ open, onClose, symbol, name, price = 0, dividendYield = 0, sector = 'Unknown' }: WatchlistWhatIfDialogProps) => {
  const { activePortfolio } = usePortfolio();
  const [shares, setShares] = useState<string>('10');

  const sharesNum = Math.max(0, parseFloat(shares) || 0);

  const result = useMemo(() => {
    const holdings = activePortfolio?.holdings || [];
    const currentValue = holdings.reduce((s, h) => s + h.shares * h.currentPrice, 0);
    const currentAnnualDiv = holdings.reduce((s, h) => s + h.shares * h.currentPrice * (h.dividendYield || 0) / 100, 0);
    const currentYield = currentValue > 0 ? (currentAnnualDiv / currentValue) * 100 : 0;

    const addCost = sharesNum * price;
    const addAnnualDiv = addCost * (dividendYield || 0) / 100;

    const newValue = currentValue + addCost;
    const newAnnualDiv = currentAnnualDiv + addAnnualDiv;
    const newYield = newValue > 0 ? (newAnnualDiv / newValue) * 100 : 0;
    const newAllocation = newValue > 0 ? (addCost / newValue) * 100 : 0;

    // Sector concentration change
    const sectorValueBefore = holdings.filter(h => (h.sector || 'Unknown') === sector).reduce((s, h) => s + h.shares * h.currentPrice, 0);
    const sectorPctBefore = currentValue > 0 ? (sectorValueBefore / currentValue) * 100 : 0;
    const sectorPctAfter = newValue > 0 ? ((sectorValueBefore + addCost) / newValue) * 100 : 0;

    return {
      currentValue, newValue, addCost,
      currentAnnualDiv, newAnnualDiv, addAnnualDiv,
      currentYield, newYield,
      newAllocation,
      sectorPctBefore, sectorPctAfter,
    };
  }, [activePortfolio?.holdings, sharesNum, price, dividendYield, sector]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            What-If: Adding {symbol}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
            <div>
              <p className="font-semibold">{symbol}</p>
              {name && <p className="text-xs text-muted-foreground">{name}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-mono">${fmt(price)}</p>
              <p className="text-xs text-muted-foreground">Yield {fmt(dividendYield)}%</p>
            </div>
          </div>

          <div>
            <Label htmlFor="whatif-shares">Shares to add</Label>
            <Input
              id="whatif-shares"
              type="number"
              min="0"
              step="1"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Investment: ${fmt(result.addCost)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Metric
              icon={<DollarSign className="w-3.5 h-3.5" />}
              label="Portfolio Value"
              before={`$${fmt(result.currentValue, 0)}`}
              after={`$${fmt(result.newValue, 0)}`}
              positive
            />
            <Metric
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Annual Income"
              before={`$${fmt(result.currentAnnualDiv, 0)}`}
              after={`$${fmt(result.newAnnualDiv, 0)}`}
              positive={result.addAnnualDiv > 0}
            />
            <Metric
              icon={<PieChart className="w-3.5 h-3.5" />}
              label="Portfolio Yield"
              before={`${fmt(result.currentYield)}%`}
              after={`${fmt(result.newYield)}%`}
              positive={result.newYield > result.currentYield}
            />
            <Metric
              icon={result.sectorPctAfter > result.sectorPctBefore ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              label={`${sector} Weight`}
              before={`${fmt(result.sectorPctBefore)}%`}
              after={`${fmt(result.sectorPctAfter)}%`}
              positive={false}
              warn={result.sectorPctAfter > 30}
            />
          </div>

          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-xs text-muted-foreground">New position allocation</p>
            <p className="text-lg font-bold text-primary">{fmt(result.newAllocation)}%</p>
            {result.newAllocation > 10 && (
              <Badge variant="outline" className="mt-1 border-amber-500/40 text-amber-500 text-[10px]">
                Concentration risk: single position &gt;10%
              </Badge>
            )}
          </div>

          <Button onClick={onClose} variant="outline" className="w-full">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Metric = ({ icon, label, before, after, positive, warn }: { icon: React.ReactNode; label: string; before: string; after: string; positive: boolean; warn?: boolean }) => (
  <div className="p-3 rounded-lg border border-border bg-card">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
      {icon} {label}
    </div>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground line-through">{before}</span>
      <span className={`text-sm font-bold ${warn ? 'text-amber-500' : positive ? 'text-emerald-500' : 'text-foreground'}`}>{after}</span>
    </div>
  </div>
);

export default WatchlistWhatIfDialog;
