import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePortfolio } from '@/context/PortfolioContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Share2, 
  Globe, 
  Lock, 
  Copy, 
  Check, 
  Eye, 
  Users,
  Link as LinkIcon,
  RefreshCw,
  Shield
} from 'lucide-react';
import ProofOfWealthModal from './ProofOfWealthModal';

interface PortfolioSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SharedPortfolio {
  id: string;
  portfolio_id: string;
  is_public: boolean;
  share_code: string | null;
  views_count: number;
}

const PortfolioSharingModal: React.FC<PortfolioSharingModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { activePortfolio } = usePortfolio();
  const { toast } = useToast();
  
  const [sharedData, setSharedData] = useState<SharedPortfolio | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);

  const shareUrl = sharedData?.share_code 
    ? `${window.location.origin}/shared/${sharedData.share_code}`
    : null;

  useEffect(() => {
    if (isOpen && activePortfolio && user) {
      fetchSharedData();
    }
  }, [isOpen, activePortfolio, user]);

  const fetchSharedData = async () => {
    if (!activePortfolio || !user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shared_portfolios')
        .select('*')
        .eq('portfolio_id', activePortfolio.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSharedData(data);
        setIsPublic(data.is_public);
      } else {
        setSharedData(null);
        setIsPublic(false);
      }
    } catch (error) {
      console.error('Error fetching shared data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateShareCode = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleTogglePublic = async (checked: boolean) => {
    if (!activePortfolio || !user) return;
    
    setSaving(true);
    setIsPublic(checked);

    try {
      if (sharedData) {
        // Update existing
        const { error } = await supabase
          .from('shared_portfolios')
          .update({ 
            is_public: checked,
            updated_at: new Date().toISOString()
          })
          .eq('id', sharedData.id);

        if (error) throw error;
        setSharedData({ ...sharedData, is_public: checked });
      } else {
        // Create new
        const shareCode = generateShareCode();
        const { data, error } = await supabase
          .from('shared_portfolios')
          .insert({
            portfolio_id: activePortfolio.id,
            user_id: user.id,
            is_public: checked,
            share_code: shareCode
          })
          .select()
          .single();

        if (error) throw error;
        setSharedData(data);
      }

      toast({ 
        title: checked ? 'Portfolio is now public!' : 'Portfolio is now private',
        description: checked ? 'Anyone with the link can view your portfolio.' : 'Only you can see your portfolio.'
      });
    } catch (error) {
      console.error('Error updating sharing:', error);
      setIsPublic(!checked);
      toast({ title: 'Failed to update sharing settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const regenerateLink = async () => {
    if (!sharedData) return;
    
    setSaving(true);
    const newCode = generateShareCode();

    try {
      const { error } = await supabase
        .from('shared_portfolios')
        .update({ share_code: newCode })
        .eq('id', sharedData.id);

      if (error) throw error;
      setSharedData({ ...sharedData, share_code: newCode });
      toast({ title: 'New share link generated!' });
    } catch (error) {
      console.error('Error regenerating link:', error);
      toast({ title: 'Failed to regenerate link', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Link copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-500" />
            Share Portfolio
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Portfolio Info */}
            <div className="p-4 rounded-xl bg-muted/50 border">
              <h3 className="font-bold text-foreground mb-1">{activePortfolio?.name}</h3>
              <p className="text-sm text-muted-foreground">
                {activePortfolio?.holdings?.length || 0} holdings
              </p>
            </div>

            {/* Public Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Globe className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Lock className="w-5 h-5 text-slate-400" />
                )}
                <div>
                  <Label className="font-semibold">Make Portfolio Public</Label>
                  <p className="text-xs text-muted-foreground">
                    {isPublic ? 'Anyone with the link can view' : 'Only you can see this portfolio'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={saving}
              />
            </div>

            {/* Share Link */}
            {isPublic && shareUrl && (
              <div className="space-y-3">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={regenerateLink}
                    disabled={saving}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Generate New Link
                  </Button>
                  {sharedData && (
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      {sharedData.views_count} views
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Proof of Wealth */}
            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <Label className="font-semibold">Proof of Wealth</Label>
                  <p className="text-xs text-muted-foreground">
                    Generate a signed, timestamped statement of your net worth
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowProofModal(true)}>
                Generate
              </Button>
            </div>

            {/* Privacy Note */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Privacy Note:</strong> Shared portfolios show holdings and allocations but hide personal information and exact dollar amounts by default.
              </p>
            </div>
          </div>
        )}
      </DialogContent>

      <ProofOfWealthModal isOpen={showProofModal} onClose={() => setShowProofModal(false)} />
    </Dialog>
  );
};

export default PortfolioSharingModal;
