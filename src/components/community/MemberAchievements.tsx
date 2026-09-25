import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Star, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { useSocialFeatures } from '@/hooks/useSocialFeatures';

const BADGES_CONFIG = [
  { icon: '🏆', label: 'Top Contributor', requirement: 'Create 10+ posts', threshold: 10, type: 'posts' },
  { icon: '🔥', label: '7-Day Streak', requirement: 'Visit 7 days in a row', threshold: 7, type: 'streak' },
  { icon: '💎', label: 'Diamond Hands', requirement: 'Track 5+ holdings for 30d', threshold: 5, type: 'holdings' },
  { icon: '📊', label: 'Analyst', requirement: 'Use 5 research tools', threshold: 5, type: 'tools' },
  { icon: '🎓', label: 'Course Graduate', requirement: 'Complete a learning path', threshold: 1, type: 'courses' },
  { icon: '🌟', label: 'Community Star', requirement: 'Get 50+ total likes', threshold: 50, type: 'likes' },
];

const MemberAchievements: React.FC = () => {
  const { user } = useAuth();
  const { posts, followers } = useSocialFeatures();

  // Streak tracking via localStorage
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem('wealthos_last_visit');
    const savedStreak = parseInt(localStorage.getItem('wealthos_streak') || '0');

    if (lastVisit === today) {
      setStreak(savedStreak);
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const newStreak = lastVisit === yesterday.toDateString() ? savedStreak + 1 : 1;
      localStorage.setItem('wealthos_last_visit', today);
      localStorage.setItem('wealthos_streak', String(newStreak));
      setStreak(newStreak);
    }
  }, []);

  const userPostCount = posts.filter(p => p.user_id === user?.id).length;
  const totalLikes = posts.filter(p => p.user_id === user?.id).reduce((s, p) => s + p.likes_count, 0);
  const completedLessons = JSON.parse(localStorage.getItem('wealthos_completed_lessons') || '[]').length;

  // Calculate XP based on real activity
  const xpFromPosts = userPostCount * 50;
  const xpFromStreak = streak * 20;
  const xpFromLikes = totalLikes * 10;
  const xpFromLessons = completedLessons * 50;
  const currentXP = xpFromPosts + xpFromStreak + xpFromLikes + xpFromLessons;
  const level = Math.max(1, Math.floor(currentXP / 500) + 1);
  const nextLevelXP = level * 500;
  const xpProgress = Math.min(100, Math.round((currentXP / nextLevelXP) * 100));

  // Check which badges are earned
  const earnedBadges = BADGES_CONFIG.map(badge => {
    let earned = false;
    switch (badge.type) {
      case 'posts': earned = userPostCount >= badge.threshold; break;
      case 'streak': earned = streak >= badge.threshold; break;
      case 'likes': earned = totalLikes >= badge.threshold; break;
      case 'courses': earned = completedLessons >= 8; break; // At least one full path
      default: earned = false;
    }
    return { ...badge, earned };
  });

  const levelTitle = level >= 20 ? 'WealthMaster' : level >= 10 ? 'WealthBuilder' : level >= 5 ? 'Investor' : 'Beginner';

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Your Progress
        </h3>

        {/* Level & XP Bar */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-3 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">Lv.{level}</span>
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{levelTitle}</div>
                <div className="text-[10px] text-muted-foreground">{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</div>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-full">
              <Flame className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{streak}d</span>
            </div>
          </div>
          <Progress value={xpProgress} className="h-2" />
          <div className="text-[10px] text-muted-foreground mt-1 text-right">
            {Math.max(0, nextLevelXP - currentXP)} XP to Level {level + 1}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Posts', value: String(userPostCount), icon: Zap },
            { label: 'Likes', value: String(totalLikes), icon: Star },
            { label: 'Streak', value: `${streak}d`, icon: Flame },
          ].map((stat, i) => (
            <div key={i} className="bg-muted rounded-lg p-2 text-center">
              <stat.icon className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
              <div className="font-bold text-foreground text-sm">{stat.value}</div>
              <div className="text-[9px] text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Badges ({earnedBadges.filter(b => b.earned).length}/{earnedBadges.length})
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {earnedBadges.map((badge, i) => (
              <div
                key={i}
                title={badge.earned ? badge.label : badge.requirement}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                  badge.earned
                    ? 'bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/10'
                    : 'bg-muted/50 border-border opacity-40 grayscale'
                }`}
              >
                <span className="text-lg">{badge.icon}</span>
                <span className="text-[9px] font-medium text-center text-foreground leading-tight">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberAchievements;
