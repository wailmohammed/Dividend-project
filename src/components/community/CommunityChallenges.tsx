import React, { useState, useEffect } from 'react';
import { Target, Users, Clock, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePortfolio } from '@/context/PortfolioContext';

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  participants: number;
  daysLeft: number;
  reward: string;
  category: 'savings' | 'learning' | 'investing' | 'community';
  relatedView?: string;
  checkProgress: () => number;
}

const CommunityChallenges: React.FC = () => {
  const { activePortfolio, switchView } = usePortfolio();
  const [joinedChallenges, setJoinedChallenges] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('wealthos_joined_challenges');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('wealthos_joined_challenges', JSON.stringify(Array.from(joinedChallenges)));
  }, [joinedChallenges]);

  const holdingsCount = activePortfolio?.holdings?.length || 0;
  const completedLessons = JSON.parse(localStorage.getItem('wealthos_completed_lessons') || '[]').length;

  const CHALLENGES: Challenge[] = [
    {
      id: 'savings-sprint',
      title: '30-Day Savings Sprint',
      description: 'Track $1,000+ in your portfolio cash balance',
      icon: '💰',
      participants: 2847,
      daysLeft: 18,
      reward: '500 XP + Gold Badge',
      category: 'savings',
      relatedView: 'dashboard',
      checkProgress: () => {
        const cash = activePortfolio?.cashBalance || 0;
        return Math.min(100, Math.round((cash / 1000) * 100));
      },
    },
    {
      id: 'dividend-builder',
      title: 'Dividend Portfolio Builder',
      description: 'Add 5+ dividend-paying stocks to your portfolio',
      icon: '📊',
      participants: 1523,
      daysLeft: 45,
      reward: '1000 XP + Dividend Pro',
      category: 'investing',
      relatedView: 'dividends',
      checkProgress: () => {
        const dividendHoldings = activePortfolio?.holdings?.filter(h => (h.dividendYield || 0) > 0).length || 0;
        return Math.min(100, Math.round((dividendHoldings / 5) * 100));
      },
    },
    {
      id: 'literacy-week',
      title: 'Financial Literacy Week',
      description: 'Complete 5 learning modules',
      icon: '📚',
      participants: 4210,
      daysLeft: 3,
      reward: '300 XP + Scholar Badge',
      category: 'learning',
      relatedView: 'knowledge-base',
      checkProgress: () => Math.min(100, Math.round((completedLessons / 5) * 100)),
    },
    {
      id: 'diversify',
      title: 'Diversification Challenge',
      description: 'Hold 10+ different assets in your portfolio',
      icon: '🎯',
      participants: 892,
      daysLeft: 12,
      reward: '750 XP + Diversifier Badge',
      category: 'investing',
      relatedView: 'holdings',
      checkProgress: () => Math.min(100, Math.round((holdingsCount / 10) * 100)),
    },
  ];

  const joinChallenge = (id: string) => {
    setJoinedChallenges(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast.info('Left challenge');
      } else {
        next.add(id);
        toast.success('🎯 Challenge joined! +25 XP');
      }
      return next;
    });
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Challenges
          </h3>
          <Badge variant="outline" className="text-[10px] py-0">{CHALLENGES.length} Active</Badge>
        </div>

        <div className="space-y-3">
          {CHALLENGES.map((challenge) => {
            const isJoined = joinedChallenges.has(challenge.id);
            const progress = isJoined ? challenge.checkProgress() : 0;

            return (
              <div
                key={challenge.id}
                className={`p-3 rounded-xl border transition-all ${
                  isJoined
                    ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                    : 'bg-muted/30 border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">{challenge.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground text-sm">{challenge.title}</span>
                      {progress >= 100 && <Badge className="text-[9px] py-0 px-1 bg-emerald-500/10 text-emerald-500 border-0">Done!</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">{challenge.description}</p>

                    {isJoined && (
                      <div className="mb-2">
                        <Progress value={progress} className="h-1.5" />
                        <div className="text-[10px] text-muted-foreground mt-0.5">{progress}% complete</div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {challenge.participants.toLocaleString()}</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {challenge.daysLeft}d left</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isJoined && challenge.relatedView && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => switchView(challenge.relatedView as any)}
                          >
                            Open
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant={isJoined ? "secondary" : "outline"}
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => joinChallenge(challenge.id)}
                        >
                          {isJoined ? 'Joined ✓' : <><Zap className="w-3 h-3" /> Join</>}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-1.5 text-[10px] text-primary font-medium flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Reward: {challenge.reward}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommunityChallenges;
