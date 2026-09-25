import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Copy, Check, RefreshCw, Eye, Link as LinkIcon,
  Calendar, Trash2, FileText
} from 'lucide-react';
import { format, addDays } from 'date-fns';

interface ProofOfWealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProofRecord {
  id: string;
  share_code: string;
  full_name: string;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  is_active: boolean;
  views_count: number;
  expires_at: string | null;
  generated_at: string;
}

const ProofOfWealthModal: React.FC<ProofOfWealthModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { activePortfolio } = usePortfolio();
  const { toast } = useToast();

  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState('90');

  useEffect(() => {
    if (isOpen && user) fetchProofs();
  }, [isOpen, user]);

  const fetchProofs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('proof_of_wealth')
        .select('*')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false }) as any;

      if (error) throw error;
      setProofs(data || []);
    } catch (err) {
      console.error('Error fetching proofs:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateShareCode = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleGenerate = async () => {
    if (!user || !activePortfolio) return;
    setGenerating(true);

    try {
      // Get user profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const fullName = profile?.full_name || user.email || 'Portfolio Owner';

      // Calculate totals from active portfolio
      const holdingsValue = activePortfolio.holdings.reduce((sum, h) => {
        return sum + (h.shares * (h.currentPrice || h.avgPrice));
      }, 0);

      const manualAssetsValue = (activePortfolio.manualAssets || []).reduce(
        (sum, a) => sum + a.value, 0
      );

      const totalAssets = holdingsValue + manualAssetsValue + (activePortfolio.cashBalance || 0);

      const totalLiabilities = (activePortfolio.liabilities || []).reduce(
        (sum, l) => sum + l.amount, 0
      );

      const netWorth = totalAssets - totalLiabilities;

      // Snapshot holdings (hide exact shares for privacy)
      const holdingsSnapshot = activePortfolio.holdings.map(h => ({
        symbol: h.symbol,
        name: h.name,
        value: h.shares * (h.currentPrice || h.avgPrice),
        assetType: h.assetType,
        sector: h.sector || null,
        source: 'verified',
      }));

      // Add manual assets
      (activePortfolio.manualAssets || []).forEach(a => {
        holdingsSnapshot.push({
          symbol: a.name,
          name: a.name,
          value: a.value,
          assetType: a.type as any,
          sector: null,
          source: 'self_reported',
        });
      });

      const days = parseInt(expiryDays);
      const expiresAt = days > 0 ? addDays(new Date(), days).toISOString() : null;

      const { error } = await supabase
        .from('proof_of_wealth')
        .insert({
          user_id: user.id,
          share_code: generateShareCode(),
          full_name: fullName,
          net_worth: netWorth,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          holdings_snapshot: holdingsSnapshot,
          currency: 'USD',
          expires_at: expiresAt,
        } as any);

      if (error) throw error;

      toast({ title: 'Proof of Wealth generated!', description: 'Your signed statement is ready to share.' });
      await fetchProofs();
    } catch (err: any) {
      console.error('Error generating proof:', err);
      toast({ title: 'Failed to generate proof', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const revokeProof = async (id: string) => {
    try {
      const { error } = await supabase
        .from('proof_of_wealth')
        .update({ is_active: false } as any)
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Proof revoked' });
      await fetchProofs();
    } catch {
      toast({ title: 'Failed to revoke', variant: 'destructive' });
    }
  };

  const copyLink = async (shareCode: string) => {
    const url = `${window.location.origin}/proof/${shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(shareCode);
      toast({ title: 'Link copied!' });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Proof of Wealth
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Explainer */}
          <div className="p-4 rounded-xl bg-muted/50 border text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">What is Proof of Wealth?</p>
            <p>
              A self-attested, timestamped statement of your assets, liabilities, and net worth.
              Delivered as a shareable link — no login required for the recipient.
            </p>
          </div>

          {/* Generate New */}
          <div className="p-4 rounded-xl border space-y-3">
            <Label className="font-semibold">Generate New Proof</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Expires in</Label>
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="0">No expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="mt-5"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                Generate
              </Button>
            </div>
          </div>

          {/* Existing Proofs */}
          {loading ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : proofs.length > 0 ? (
            <div className="space-y-3">
              <Label className="font-semibold">Your Proofs</Label>
              {proofs.map((proof) => {
                const isExpired = proof.expires_at && new Date(proof.expires_at) < new Date();
                const isActive = proof.is_active && !isExpired;

                return (
                  <div key={proof.id} className={`p-4 rounded-xl border space-y-2 ${!isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                          {isActive ? 'Active' : isExpired ? 'Expired' : 'Revoked'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {proof.views_count}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(proof.generated_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Worth</p>
                        <p className="text-lg font-bold">{formatCurrency(Number(proof.net_worth))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Assets</p>
                        <p className="text-sm font-semibold">{formatCurrency(Number(proof.total_assets))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Liabilities</p>
                        <p className="text-sm font-semibold">{formatCurrency(Number(proof.total_liabilities))}</p>
                      </div>
                    </div>

                    {proof.expires_at && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires {format(new Date(proof.expires_at), 'MMM d, yyyy')}
                      </p>
                    )}

                    {isActive && (
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => copyLink(proof.share_code)} className="flex-1">
                          {copied === proof.share_code ? (
                            <Check className="w-3 h-3 mr-1 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3 mr-1" />
                          )}
                          Copy Link
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => revokeProof(proof.id)}>
                          <Trash2 className="w-3 h-3 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              No proofs generated yet. Click "Generate" to create your first.
            </p>
          )}

          {/* Use Cases */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs font-semibold text-foreground mb-1">Common use cases</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Real estate purchases</li>
              <li>Accredited investor verification</li>
              <li>Credit applications</li>
              <li>Immigration and residency applications</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofOfWealthModal;
