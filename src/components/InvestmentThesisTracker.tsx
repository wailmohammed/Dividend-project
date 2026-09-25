import { useState, useEffect, useCallback } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { BookOpen, Target, TrendingUp, TrendingDown, Edit3, Save, X, Plus, FlaskConical, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Thesis {
  id: string;
  symbol: string;
  thesis: string;
  fair_value: number | null;
  conviction: string;
  status: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const DEMO_THESES: Thesis[] = [
  { id: '1', symbol: 'AAPL', thesis: 'Strong ecosystem lock-in with Services revenue growing 15%+ YoY. AI integration in devices will drive upgrade cycles. Fair value based on 25x forward earnings.', fair_value: 210, conviction: 'high', status: 'active', tags: ['growth', 'quality'], created_at: '2025-06-15', updated_at: '2025-12-01' },
  { id: '2', symbol: 'MSFT', thesis: 'Cloud dominance with Azure growing 30%+. AI monetization through Copilot creates new revenue streams. Dividend aristocrat with strong buybacks.', fair_value: 480, conviction: 'high', status: 'active', tags: ['cloud', 'AI', 'dividend'], created_at: '2025-04-20', updated_at: '2025-11-15' },
  { id: '3', symbol: 'O', thesis: 'Monthly dividend REIT with 5%+ yield. Diversified tenants, long lease terms. Good inflation hedge through rent escalators.', fair_value: 62, conviction: 'medium', status: 'active', tags: ['income', 'REIT'], created_at: '2025-08-10', updated_at: '2025-10-20' },
];

export const InvestmentThesisTracker = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { activePortfolio } = usePortfolio();
  const holdings = activePortfolio?.holdings || [];

  const [theses, setTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', thesis: '', fair_value: '', conviction: 'medium', tags: '' });

  const fetchTheses = useCallback(async () => {
    if (isDemoMode) { setTheses(DEMO_THESES); setLoading(false); return; }
    const { data, error } = await supabase
      .from('investment_theses')
      .select('*')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false });
    if (!error && data) setTheses(data as Thesis[]);
    setLoading(false);
  }, [isDemoMode, user]);

  useEffect(() => { fetchTheses(); }, [fetchTheses]);

  const handleSave = async () => {
    if (!form.symbol || !form.thesis) { toast.error('Symbol and thesis are required'); return; }
    if (isDemoMode) { toast.info('Sign in to save theses'); return; }

    const payload = {
      user_id: user!.id,
      symbol: form.symbol.toUpperCase(),
      thesis: form.thesis,
      fair_value: form.fair_value ? parseFloat(form.fair_value) : null,
      conviction: form.conviction,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
    };

    if (editingId) {
      const { error } = await supabase.from('investment_theses').update(payload).eq('id', editingId);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Thesis updated');
    } else {
      const { error } = await supabase.from('investment_theses').insert(payload);
      if (error) { toast.error(error.message.includes('duplicate') ? 'Thesis for this symbol already exists' : 'Failed to save'); return; }
      toast.success('Thesis saved');
    }
    setForm({ symbol: '', thesis: '', fair_value: '', conviction: 'medium', tags: '' });
    setEditingId(null);
    setShowAdd(false);
    fetchTheses();
  };

  const handleEdit = (t: Thesis) => {
    setForm({ symbol: t.symbol, thesis: t.thesis, fair_value: t.fair_value?.toString() || '', conviction: t.conviction, tags: t.tags.join(', ') });
    setEditingId(t.id);
    setShowAdd(true);
  };

  const handleDelete = async (id: string) => {
    if (isDemoMode) return;
    await supabase.from('investment_theses').delete().eq('id', id);
    toast.success('Thesis removed');
    fetchTheses();
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (isDemoMode) return;
    await supabase.from('investment_theses').update({ status }).eq('id', id);
    fetchTheses();
  };

  const getConvictionBadge = (c: string) => {
    switch (c) {
      case 'high': return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">High Conviction</Badge>;
      case 'medium': return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Medium</Badge>;
      case 'low': return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Low</Badge>;
      default: return null;
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reviewing': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'closed': return <X className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getUpsideDownside = (symbol: string, fairValue: number | null) => {
    if (!fairValue) return null;
    const holding = holdings.find(h => h.symbol === symbol);
    if (!holding) return null;
    const diff = ((fairValue - holding.currentPrice) / holding.currentPrice) * 100;
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Investment Thesis Tracker
          </h2>
          <p className="text-muted-foreground">Track your reasoning and fair value for each holding</p>
        </div>
        <Button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm({ symbol: '', thesis: '', fair_value: '', conviction: 'medium', tags: '' }); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Thesis
        </Button>
      </div>

      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Sign in to create and track your own investment theses.
          </AlertDescription>
        </Alert>
      )}

      {showAdd && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? 'Edit Thesis' : 'New Investment Thesis'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Symbol</label>
                <Input placeholder="AAPL" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} disabled={!!editingId} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Fair Value ($)</label>
                <Input type="number" placeholder="150.00" value={form.fair_value} onChange={e => setForm(f => ({ ...f, fair_value: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Conviction</label>
                <Select value={form.conviction} onValueChange={v => setForm(f => ({ ...f, conviction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Your Thesis</label>
              <Textarea placeholder="Why do you own this stock? What's your bull case?" rows={4} value={form.thesis} onChange={e => setForm(f => ({ ...f, thesis: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Tags (comma-separated)</label>
              <Input placeholder="growth, AI, dividend" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />{editingId ? 'Update' : 'Save'}</Button>
              <Button variant="outline" onClick={() => { setShowAdd(false); setEditingId(null); }}><X className="w-4 h-4 mr-2" />Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Valuation Summary */}
      {theses.length > 0 && (() => {
        const withFairValue = theses.filter(t => t.fair_value && t.status === 'active');
        const valuationData = withFairValue.map(t => {
          const holding = holdings.find(h => h.symbol === t.symbol);
          const marketPrice = holding?.currentPrice || 0;
          const shares = holding?.shares || 0;
          return { symbol: t.symbol, fairValue: t.fair_value!, marketPrice, shares, conviction: t.conviction };
        }).filter(v => v.marketPrice > 0 && v.shares > 0);

        if (valuationData.length === 0) return null;

        const totalFairValue = valuationData.reduce((s, v) => s + v.fairValue * v.shares, 0);
        const totalMarketValue = valuationData.reduce((s, v) => s + v.marketPrice * v.shares, 0);
        const aggregateUpside = ((totalFairValue - totalMarketValue) / totalMarketValue) * 100;
        const undervalued = valuationData.filter(v => v.fairValue > v.marketPrice).length;
        const overvalued = valuationData.length - undervalued;

        return (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Portfolio Valuation Summary
              </CardTitle>
              <CardDescription>Aggregate fair value vs market price across {valuationData.length} theses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Total Fair Value</div>
                  <div className="text-xl font-bold text-primary">${totalFairValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Market Value</div>
                  <div className="text-xl font-bold">${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Aggregate Upside</div>
                  <div className={`text-xl font-bold flex items-center justify-center gap-1 ${aggregateUpside >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {aggregateUpside >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {aggregateUpside >= 0 ? '+' : ''}{aggregateUpside.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Valuation Split</div>
                  <div className="text-sm font-medium">
                    <span className="text-green-500">{undervalued} undervalued</span>
                    {' / '}
                    <span className="text-red-500">{overvalued} overvalued</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Theses List */}
      <div className="grid grid-cols-1 gap-4">
        {theses.map(t => {
          const upside = getUpsideDownside(t.symbol, t.fair_value);
          const holding = holdings.find(h => h.symbol === t.symbol);
          return (
            <Card key={t.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusIcon(t.status)}
                      <span className="font-bold text-lg">{t.symbol}</span>
                      {getConvictionBadge(t.conviction)}
                      {t.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{t.thesis}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                      <span>Updated {new Date(t.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 min-w-[180px]">
                    {t.fair_value && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Fair Value</div>
                        <div className="text-xl font-bold">${t.fair_value.toFixed(2)}</div>
                        {holding && (
                          <div className="text-xs text-muted-foreground">Current: ${holding.currentPrice.toFixed(2)}</div>
                        )}
                      </div>
                    )}
                    {upside !== null && (
                      <div className={`flex items-center gap-1 text-sm font-medium ${upside >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {upside >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% {upside >= 0 ? 'upside' : 'downside'}
                      </div>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(t)}><Edit3 className="w-3 h-3" /></Button>
                      <Select value={t.status} onValueChange={v => handleStatusChange(t.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="reviewing">Reviewing</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {theses.length === 0 && !loading && (
        <Card className="py-12">
          <CardContent className="text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Theses Yet</h3>
            <p className="text-muted-foreground mb-4">Start documenting why you own each stock to make better decisions.</p>
            <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Create Your First Thesis</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InvestmentThesisTracker;
