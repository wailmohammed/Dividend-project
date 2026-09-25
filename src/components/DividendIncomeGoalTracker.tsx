import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Target, TrendingUp, Edit2, Check, X, Trophy, PartyPopper } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

interface DividendIncomeGoalTrackerProps {
  currentAnnualIncome: number;
  currentMonthlyIncome: number;
  onGoalChange?: (goal: GoalData | null) => void;
}

interface GoalData {
  target: number;
  type: 'monthly' | 'annual';
}

export type { GoalData };

const STORAGE_KEY = 'dividend-income-goal';

const loadGoal = (): GoalData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveGoal = (goal: GoalData | null) => {
  if (goal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goal));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const DividendIncomeGoalTracker = ({ currentAnnualIncome, currentMonthlyIncome, onGoalChange }: DividendIncomeGoalTrackerProps) => {
  const [goal, setGoal] = useState<GoalData | null>(loadGoal);
  const [editing, setEditing] = useState(!goal);
  const [draftTarget, setDraftTarget] = useState(goal?.target?.toString() || '');
  const [draftType, setDraftType] = useState<'monthly' | 'annual'>(goal?.type || 'monthly');
  const notifiedMilestones = useRef<Set<number>>(new Set());

  const MILESTONES = [50, 75, 100];

  const stats = useMemo(() => {
    if (!goal) return null;
    const currentValue = goal.type === 'monthly' ? currentMonthlyIncome : currentAnnualIncome;
    const progress = goal.target > 0 ? Math.min((currentValue / goal.target) * 100, 100) : 0;
    const remaining = Math.max(goal.target - currentValue, 0);
    const isAchieved = currentValue >= goal.target;
    return { currentValue, progress, remaining, isAchieved };
  }, [goal, currentAnnualIncome, currentMonthlyIncome]);

  // Notify parent of goal changes
  useEffect(() => {
    onGoalChange?.(goal);
  }, [goal, onGoalChange]);

  // Milestone notifications
  useEffect(() => {
    if (!stats || !goal) return;
    for (const milestone of MILESTONES) {
      if (stats.progress >= milestone && !notifiedMilestones.current.has(milestone)) {
        notifiedMilestones.current.add(milestone);
        const icon = milestone === 100 ? '🎉' : milestone === 75 ? '🏆' : '🚀';
        const label = goal.type === 'monthly' ? 'monthly' : 'annual';
        toast.success(
          `${icon} ${milestone}% of your ${label} dividend income goal reached!`,
          { duration: 6000 }
        );
      }
    }
  }, [stats, goal]);

  const handleSave = () => {
    const target = parseFloat(draftTarget);
    if (!target || target <= 0) return;
    const newGoal: GoalData = { target, type: draftType };
    setGoal(newGoal);
    saveGoal(newGoal);
    setEditing(false);
  };

  const handleCancel = () => {
    if (goal) {
      setDraftTarget(goal.target.toString());
      setDraftType(goal.type);
      setEditing(false);
    }
  };

  const handleClear = () => {
    setGoal(null);
    saveGoal(null);
    setDraftTarget('');
    setDraftType('monthly');
    setEditing(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="w-5 h-5 text-primary" />
          Income Goal Tracker
        </CardTitle>
        {goal && !editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Target Amount ($)</Label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={draftTarget}
                onChange={e => setDraftTarget(e.target.value)}
                min={0}
                className="h-9"
              />
            </div>
            <div className="w-full sm:w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Period</Label>
              <Select value={draftType} onValueChange={(v: 'monthly' | 'annual') => setDraftType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!draftTarget || parseFloat(draftTarget) <= 0} className="gap-1">
                <Check className="w-4 h-4" /> Set Goal
              </Button>
              {goal && (
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {goal!.type === 'monthly' ? 'Monthly' : 'Annual'} Goal
                </p>
                <p className="text-2xl font-bold text-foreground">
                  ${stats.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}/ ${goal!.target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
              {stats.isAchieved ? (
                <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-semibold">Goal Achieved!</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ${stats.remaining.toFixed(2)} to go
                </p>
              )}
            </div>
            <Progress value={stats.progress} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">
              {stats.progress.toFixed(1)}% of goal
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
