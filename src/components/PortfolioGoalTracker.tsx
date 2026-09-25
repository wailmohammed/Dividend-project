import { useState, useMemo } from 'react';
import { Target, Trophy, Sparkles, TrendingUp, Plus, Edit2, Trash2, Check, X, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner';

interface Goal {
  id: string;
  name: string;
  targetValue: number;
  deadline?: string;
  createdAt: string;
}

interface PortfolioGoalTrackerProps {
  currentValue: number;
}

const MILESTONES = [
  { value: 1000, label: '$1K', icon: '🎯' },
  { value: 5000, label: '$5K', icon: '⭐' },
  { value: 10000, label: '$10K', icon: '🚀' },
  { value: 25000, label: '$25K', icon: '💎' },
  { value: 50000, label: '$50K', icon: '👑' },
  { value: 100000, label: '$100K', icon: '🏆' },
  { value: 250000, label: '$250K', icon: '🌟' },
  { value: 500000, label: '$500K', icon: '💰' },
  { value: 1000000, label: '$1M', icon: '🎉' },
];

export const PortfolioGoalTracker = ({ currentValue }: PortfolioGoalTrackerProps) => {
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('portfolio-goals');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);

  // Find achieved and next milestones
  const { achievedMilestones, nextMilestone } = useMemo(() => {
    const achieved = MILESTONES.filter(m => currentValue >= m.value);
    const next = MILESTONES.find(m => currentValue < m.value);
    return { achievedMilestones: achieved, nextMilestone: next };
  }, [currentValue]);

  // Calculate progress to next milestone
  const milestoneProgress = useMemo(() => {
    if (!nextMilestone) return 100;
    const prevMilestone = achievedMilestones[achievedMilestones.length - 1];
    const prevValue = prevMilestone?.value || 0;
    const range = nextMilestone.value - prevValue;
    const progress = ((currentValue - prevValue) / range) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [currentValue, achievedMilestones, nextMilestone]);

  const saveGoals = (updatedGoals: Goal[]) => {
    setGoals(updatedGoals);
    localStorage.setItem('portfolio-goals', JSON.stringify(updatedGoals));
  };

  const handleAddGoal = () => {
    if (!newGoalName.trim() || !newGoalTarget) return;
    
    const newGoal: Goal = {
      id: Date.now().toString(),
      name: newGoalName.trim(),
      targetValue: parseFloat(newGoalTarget),
      deadline: newGoalDeadline || undefined,
      createdAt: new Date().toISOString()
    };
    
    saveGoals([...goals, newGoal]);
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalDeadline('');
    setIsAddingGoal(false);
    toast.success('Goal added!');
  };

  const handleUpdateGoal = () => {
    if (!editingGoal || !newGoalName.trim() || !newGoalTarget) return;
    
    const updated = goals.map(g => 
      g.id === editingGoal.id 
        ? { ...g, name: newGoalName.trim(), targetValue: parseFloat(newGoalTarget), deadline: newGoalDeadline || undefined }
        : g
    );
    
    saveGoals(updated);
    setEditingGoal(null);
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalDeadline('');
    toast.success('Goal updated!');
  };

  const handleDeleteGoal = (id: string) => {
    saveGoals(goals.filter(g => g.id !== id));
    toast.success('Goal deleted');
  };

  const startEditing = (goal: Goal) => {
    setEditingGoal(goal);
    setNewGoalName(goal.name);
    setNewGoalTarget(goal.targetValue.toString());
    setNewGoalDeadline(goal.deadline || '');
  };

  const celebrateMilestone = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-emerald-500/20 flex items-center justify-center z-10 animate-pulse">
          <div className="text-center">
            <PartyPopper className="w-16 h-16 mx-auto mb-2 text-primary animate-bounce" />
            <p className="text-2xl font-bold text-foreground">Congratulations!</p>
            <p className="text-muted-foreground">You've reached a new milestone!</p>
          </div>
        </div>
      )}

      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Goals & Milestones
        </CardTitle>
        <Dialog open={isAddingGoal} onOpenChange={setIsAddingGoal}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-foreground">Goal Name</label>
                <Input
                  placeholder="e.g., Emergency Fund, Retirement Savings"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Target Amount ($)</label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Target Date (Optional)</label>
                <Input
                  type="date"
                  value={newGoalDeadline}
                  onChange={(e) => setNewGoalDeadline(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsAddingGoal(false)}>Cancel</Button>
                <Button onClick={handleAddGoal} disabled={!newGoalName.trim() || !newGoalTarget}>
                  Create Goal
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Next Milestone Progress */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-emerald-500/10 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-medium text-foreground">Next Milestone</span>
            </div>
            {nextMilestone && (
              <span className="text-lg font-bold text-primary">{nextMilestone.label}</span>
            )}
          </div>
          
          <Progress value={milestoneProgress} className="h-3 mb-2" />
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              ${currentValue.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              {nextMilestone 
                ? `$${(nextMilestone.value - currentValue).toLocaleString()} to go`
                : 'All milestones achieved!'
              }
            </span>
          </div>
        </div>

        {/* Achieved Milestones */}
        {achievedMilestones.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Achieved Milestones
            </h4>
            <div className="flex flex-wrap gap-2">
              {achievedMilestones.map((milestone) => (
                <div
                  key={milestone.value}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
                  onClick={celebrateMilestone}
                >
                  <span>{milestone.icon}</span>
                  <span className="text-sm font-medium">{milestone.label}</span>
                  <Check className="w-3 h-3" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Goals */}
        {goals.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Your Goals
            </h4>
            <div className="space-y-3">
              {goals.map((goal) => {
                const progress = Math.min(100, (currentValue / goal.targetValue) * 100);
                const isAchieved = currentValue >= goal.targetValue;
                
                return (
                  <div 
                    key={goal.id} 
                    className={`p-4 rounded-lg border transition-colors ${
                      isAchieved 
                        ? 'bg-emerald-500/5 border-emerald-500/30' 
                        : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{goal.name}</span>
                          {isAchieved && (
                            <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                              Achieved! 🎉
                            </span>
                          )}
                        </div>
                        {goal.deadline && (
                          <span className="text-xs text-muted-foreground">
                            Target: {new Date(goal.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => startEditing(goal)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <Progress 
                      value={progress} 
                      className={`h-2 mb-2 ${isAchieved ? '[&>div]:bg-emerald-500' : ''}`} 
                    />
                    
                    <div className="flex justify-between text-xs">
                      <span className={isAchieved ? 'text-emerald-500' : 'text-muted-foreground'}>
                        {progress.toFixed(1)}% complete
                      </span>
                      <span className="text-muted-foreground">
                        ${currentValue.toLocaleString()} / ${goal.targetValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Edit Goal Dialog */}
        <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-foreground">Goal Name</label>
                <Input
                  placeholder="e.g., Emergency Fund"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Target Amount ($)</label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Target Date (Optional)</label>
                <Input
                  type="date"
                  value={newGoalDeadline}
                  onChange={(e) => setNewGoalDeadline(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingGoal(null)}>Cancel</Button>
                <Button onClick={handleUpdateGoal} disabled={!newGoalName.trim() || !newGoalTarget}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {goals.length === 0 && (
          <p className="text-sm text-center text-muted-foreground py-4">
            No custom goals yet. Add one to track your progress!
          </p>
        )}
      </CardContent>
    </Card>
  );
};
