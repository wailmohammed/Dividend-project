import React, { useState, useEffect } from 'react';
import { TaxLot } from '@/hooks/useTaxLots';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil } from 'lucide-react';

interface TaxLotEditDialogProps {
  lot: TaxLot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (lotId: string, updates: Partial<Pick<TaxLot, 'symbol' | 'shares' | 'cost_basis' | 'purchase_date'>>) => Promise<void>;
}

export const TaxLotEditDialog: React.FC<TaxLotEditDialogProps> = ({
  lot,
  open,
  onOpenChange,
  onSave
}) => {
  const [formData, setFormData] = useState({
    symbol: '',
    shares: '',
    cost_basis: '',
    purchase_date: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lot) {
      setFormData({
        symbol: lot.symbol,
        shares: lot.shares.toString(),
        cost_basis: lot.cost_basis.toString(),
        purchase_date: lot.purchase_date.split('T')[0]
      });
    }
  }, [lot]);

  const handleSave = async () => {
    if (!lot) return;
    
    setSaving(true);
    try {
      await onSave(lot.id, {
        symbol: formData.symbol.toUpperCase(),
        shares: parseFloat(formData.shares),
        cost_basis: parseFloat(formData.cost_basis),
        purchase_date: formData.purchase_date
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = lot && (
    formData.symbol.toUpperCase() !== lot.symbol ||
    parseFloat(formData.shares) !== lot.shares ||
    parseFloat(formData.cost_basis) !== lot.cost_basis ||
    formData.purchase_date !== lot.purchase_date.split('T')[0]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Tax Lot
          </DialogTitle>
        </DialogHeader>
        
        {lot && (
          <div className="grid gap-4 py-4">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Original Values</p>
              <p className="text-sm">
                {lot.shares} shares of <span className="font-bold">{lot.symbol}</span> @ ${lot.cost_basis.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Purchased: {new Date(lot.purchase_date).toLocaleDateString()}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-symbol">Symbol</Label>
              <Input
                id="edit-symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-shares">Shares</Label>
                <Input
                  id="edit-shares"
                  type="number"
                  step="0.0001"
                  value={formData.shares}
                  onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-cost-basis">Cost Basis / Share</Label>
                <Input
                  id="edit-cost-basis"
                  type="number"
                  step="0.01"
                  value={formData.cost_basis}
                  onChange={(e) => setFormData({ ...formData, cost_basis: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-purchase-date">Purchase Date</Label>
              <Input
                id="edit-purchase-date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>

            {formData.shares && formData.cost_basis && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-muted-foreground">Total Cost Basis</p>
                <p className="text-lg font-bold">
                  ${(parseFloat(formData.shares) * parseFloat(formData.cost_basis)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
