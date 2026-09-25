import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  CheckCircle2, Circle, BookOpen, Calculator, PiggyBank, TrendingUp,
  Shield, ArrowRight, Save, Loader2,
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Know how much to invest', desc: 'Set aside 3–6 months of expenses as emergency fund. Reserve money for short-term goals. Invest the rest.', icon: PiggyBank },
  { id: 2, title: 'Understand why it matters', desc: 'Inflation erodes purchasing power. Doing nothing = losing money. Investing protects and grows it.', icon: TrendingUp },
  { id: 3, title: 'Choose where to invest', desc: 'Stocks, gold, real estate — each compliant option has trade-offs. Learn how to buy and on which platform.', icon: BookOpen },
  { id: 4, title: 'Automate & forget', desc: 'A fixed monthly amount, on autopilot. Simple and historically the most effective method.', icon: Shield },
];

const STORAGE_KEY = 'wealthos_halal_planner_v2';

const plannerSchema = z.object({
  monthly_expenses: z.number().min(0).max(1_000_000),
  emergency_months: z.number().int().min(1).max(24),
  emergency_saved: z.number().min(0).max(100_000_000),
  monthly_invest: z.number().min(0).max(1_000_000),
  invest_years: z.number().int().min(1).max(60),
  expected_return: z.number().min(0).max(30),
});

type PlannerState = z.infer<typeof plannerSchema> & {
  completed_steps: number[];
};

const DEFAULT_STATE: PlannerState = {
  monthly_expenses: 2500,
  emergency_months: 6,
  emergency_saved: 0,
  monthly_invest: 300,
  invest_years: 20,
  expected_return: 7,
  completed_steps: [],
};

const HalalEducationHub = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PlannerState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load from DB or localStorage
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (user?.id && user.id !== 'demo-user') {
          const { data } = await supabase
            .from('halal_planner' as any)
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data) {
            setState({
              monthly_expenses: Number((data as any).monthly_expenses) || 0,
              emergency_months: Number((data as any).emergency_months) || 6,
              emergency_saved: Number((data as any).emergency_saved) || 0,
              monthly_invest: Number((data as any).monthly_invest) || 0,
              invest_years: Number((data as any).invest_years) || 20,
              expected_return: Number((data as any).expected_return) || 7,
              completed_steps: ((data as any).completed_steps || []) as number[],
            });
            setLoading(false);
            return;
          }
        }
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
      } catch (err) {
        console.warn('Failed to load planner:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const update = (patch: Partial<PlannerState>) => {
    setState((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const toggleStep = (id: number) => {
    const next = state.completed_steps.includes(id)
      ? state.completed_steps.filter((x) => x !== id)
      : [...state.completed_steps, id];
    update({ completed_steps: next });
  };

  const save = async () => {
    const { completed_steps, ...numericFields } = state;
    const parsed = plannerSchema.safeParse(numericFields);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    try {
      // Always mirror to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      if (user?.id && user.id !== 'demo-user') {
        const { error } = await supabase
          .from('halal_planner' as any)
          .upsert({ user_id: user.id, ...state }, { onConflict: 'user_id' });
        if (error) throw error;
        toast.success('Saved to your profile');
      } else {
        toast.success('Saved locally (sign in to sync to your profile)');
      }
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const emergencyTarget = state.monthly_expenses * state.emergency_months;
  const emergencyProgress = emergencyTarget > 0 ? Math.min(100, (state.emergency_saved / emergencyTarget) * 100) : 0;
  const emergencyMissing = Math.max(0, emergencyTarget - state.emergency_saved);

  const monthlyRate = state.expected_return / 100 / 12;
  const months = state.invest_years * 12;
  const futureValue = monthlyRate > 0
    ? state.monthly_invest * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    : state.monthly_invest * months;
  const totalInvested = state.monthly_invest * months;
  const profit = futureValue - totalInvested;

  const stepProgress = (state.completed_steps.length / STEPS.length) * 100;

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            Halal Investing Education
          </h1>
          <p className="text-muted-foreground mt-1">
            Step-by-step guide to start investing in line with your values — not financial advice, a starting point.
          </p>
        </div>
        <Button onClick={save} disabled={saving || !dirty} className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {dirty ? 'Save to Profile' : 'Saved'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your Learning Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={stepProgress} className="flex-1 h-2" />
            <span className="text-sm font-semibold">{state.completed_steps.length}/{STEPS.length} steps</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const done = state.completed_steps.includes(step.id);
          return (
            <Card key={step.id} className={done ? 'border-emerald-500/40 bg-emerald-500/5' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleStep(step.id)} className="mt-1 shrink-0" aria-label={done ? 'Uncomplete step' : 'Complete step'}>
                    {done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">Step {step.id}</Badge>
                      <Icon className="w-4 h-4 text-emerald-500" />
                    </div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Emergency Fund */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4 text-emerald-500" /> Emergency Fund Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Monthly expenses ($)</Label>
              <Input type="number" min={0} max={1_000_000} value={state.monthly_expenses}
                onChange={(e) => update({ monthly_expenses: Number(e.target.value) || 0 })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Target months of cover</Label>
              <Input type="number" min={1} max={24} value={state.emergency_months}
                onChange={(e) => update({ emergency_months: Number(e.target.value) || 1 })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Already saved ($)</Label>
              <Input type="number" min={0} value={state.emergency_saved}
                onChange={(e) => update({ emergency_saved: Number(e.target.value) || 0 })} className="mt-1" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress to ${emergencyTarget.toLocaleString()} target</span>
              <span className="font-semibold text-emerald-500">{emergencyProgress.toFixed(0)}%</span>
            </div>
            <Progress value={emergencyProgress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">Target</div>
              <div className="text-xl font-bold">${emergencyTarget.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <div className="text-xs text-muted-foreground">{emergencyMissing > 0 ? 'Still needed' : 'Surplus'}</div>
              <div className="text-xl font-bold text-emerald-500">
                ${Math.abs(emergencyMissing > 0 ? emergencyMissing : state.emergency_saved - emergencyTarget).toLocaleString()}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Build this safety net first — keep it in a non-interest-bearing account to remain compliant.</p>
        </CardContent>
      </Card>

      {/* Auto-Invest Planner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Auto-Invest Planner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Monthly investment ($)</Label>
              <Input type="number" min={0} value={state.monthly_invest}
                onChange={(e) => update({ monthly_invest: Number(e.target.value) || 0 })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Time horizon (years)</Label>
              <Input type="number" min={1} max={60} value={state.invest_years}
                onChange={(e) => update({ invest_years: Number(e.target.value) || 1 })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Expected annual return (%)</Label>
              <Input type="number" min={0} max={30} step="0.1" value={state.expected_return}
                onChange={(e) => update({ expected_return: Number(e.target.value) || 0 })} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground">Total Invested</div>
              <div className="text-lg font-bold">${totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <div className="text-xs text-muted-foreground">Future Value</div>
              <div className="text-lg font-bold text-emerald-500">${futureValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <div className="text-xs text-muted-foreground">Growth</div>
              <div className="text-lg font-bold text-primary">+${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Past performance ≠ future results. Educational only — not financial advice.</p>
          <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save plan to my profile <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default HalalEducationHub;
