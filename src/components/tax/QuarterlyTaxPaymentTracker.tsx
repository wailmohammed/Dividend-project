import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSign, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Receipt,
  TrendingUp,
  TrendingDown,
  Edit2
} from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { useQuarterlyTaxPayments, QuarterlyTaxPayment } from '@/hooks/useQuarterlyTaxPayments';

interface QuarterlyTaxPaymentTrackerProps {
  estimatedQuarterlyPayments: { quarter: string; payment: number }[];
  taxYear?: number;
}

const PAYMENT_METHODS = [
  'IRS Direct Pay',
  'EFTPS',
  'Credit/Debit Card',
  'Check/Money Order',
  'Bank Wire',
  'Other'
];

// IRS Quarterly payment deadlines
const getQuarterlyDeadlines = (year: number) => ({
  Q1: new Date(year, 3, 15), // April 15
  Q2: new Date(year, 5, 15), // June 15
  Q3: new Date(year, 8, 15), // September 15
  Q4: new Date(year + 1, 0, 15) // January 15 next year
});

export const QuarterlyTaxPaymentTracker: React.FC<QuarterlyTaxPaymentTrackerProps> = ({
  estimatedQuarterlyPayments,
  taxYear = new Date().getFullYear()
}) => {
  const { 
    payments, 
    loading, 
    recordPayment, 
    getPaymentForQuarter,
    getTotalEstimated,
    getTotalPaid,
    getBalance
  } = useQuarterlyTaxPayments(taxYear);

  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    confirmationNumber: '',
    paymentMethod: '',
    notes: ''
  });

  const deadlines = getQuarterlyDeadlines(taxYear);
  const today = new Date();

  const handleOpenDialog = (quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    const existing = getPaymentForQuarter(quarter);
    setSelectedQuarter(quarter);
    setFormData({
      amount: existing?.amount_paid ? String(existing.amount_paid) : '',
      paymentDate: existing?.payment_date || format(new Date(), 'yyyy-MM-dd'),
      confirmationNumber: existing?.confirmation_number || '',
      paymentMethod: existing?.payment_method || '',
      notes: existing?.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) return;

    await recordPayment(
      selectedQuarter,
      amount,
      formData.paymentDate,
      formData.confirmationNumber,
      formData.paymentMethod,
      formData.notes
    );
    setDialogOpen(false);
  };

  const getEstimatedForQuarter = (quarter: string) => {
    return estimatedQuarterlyPayments.find(p => p.quarter === quarter)?.payment || 0;
  };

  const quarters: ('Q1' | 'Q2' | 'Q3' | 'Q4')[] = ['Q1', 'Q2', 'Q3', 'Q4'];

  const totalEstimated = estimatedQuarterlyPayments.reduce((sum, p) => sum + p.payment, 0);
  const totalPaid = getTotalPaid();
  const balance = totalEstimated - totalPaid;
  const progressPercent = totalEstimated > 0 ? (totalPaid / totalEstimated) * 100 : 0;

  if (loading) {
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Total</p>
                <p className="text-2xl font-bold">${totalEstimated.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-500">${totalPaid.toLocaleString()}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${balance > 0 ? 'from-amber-500/10 to-amber-600/5 border-amber-500/20' : 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Balance Due</p>
                <p className={`text-2xl font-bold ${balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  ${Math.abs(balance).toLocaleString()}
                  {balance < 0 && ' overpaid'}
                </p>
              </div>
              {balance > 0 ? (
                <TrendingUp className="w-8 h-8 text-amber-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-emerald-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Payment Progress</p>
            <Progress value={progressPercent} className="h-2 mb-2" />
            <p className="text-sm font-medium">{progressPercent.toFixed(0)}% Complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Payment Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            {taxYear} Quarterly Payment Tracker
          </CardTitle>
          <CardDescription>
            Record your IRS estimated tax payments and compare against amounts due
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quarters.map((quarter) => {
              const estimated = getEstimatedForQuarter(quarter);
              const payment = getPaymentForQuarter(quarter);
              const paid = payment ? Number(payment.amount_paid) : 0;
              const deadline = deadlines[quarter];
              const isPastDue = isBefore(deadline, today) && paid < estimated;
              const isFullyPaid = paid >= estimated && estimated > 0;
              const difference = paid - estimated;

              return (
                <Card 
                  key={quarter}
                  className={`relative ${
                    isFullyPaid 
                      ? 'border-emerald-500/50 bg-emerald-500/5' 
                      : isPastDue 
                        ? 'border-red-500/50 bg-red-500/5' 
                        : ''
                  }`}
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={isFullyPaid ? 'default' : isPastDue ? 'destructive' : 'outline'}>
                        {quarter}
                      </Badge>
                      {isFullyPaid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : isPastDue ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Calendar className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Estimated:</span>
                        <span className="font-medium">${estimated.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid:</span>
                        <span className={`font-medium ${paid > 0 ? 'text-emerald-500' : ''}`}>
                          ${paid.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-1">
                        <span className="text-muted-foreground">Difference:</span>
                        <span className={`font-medium ${
                          difference >= 0 ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {difference >= 0 ? '+' : ''}${difference.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Due: {format(deadline, 'MMM d, yyyy')}
                    </div>

                    {payment?.confirmation_number && (
                      <div className="text-xs text-muted-foreground truncate">
                        Conf: {payment.confirmation_number}
                      </div>
                    )}

                    <Button 
                      size="sm" 
                      variant={paid > 0 ? 'outline' : 'default'}
                      className="w-full"
                      onClick={() => handleOpenDialog(quarter)}
                    >
                      {paid > 0 ? (
                        <>
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit Payment
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 mr-1" />
                          Record Payment
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record {selectedQuarter} Tax Payment</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount Paid</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(method => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmationNumber">Confirmation Number (optional)</Label>
              <Input
                id="confirmationNumber"
                value={formData.confirmationNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmationNumber: e.target.value }))}
                placeholder="e.g., 123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.amount || parseFloat(formData.amount) <= 0}>
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
