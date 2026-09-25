import React, { useState } from 'react';
import { BookOpen, Play, CheckCircle, Lock, Clock, Star, ArrowRight, GraduationCap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePortfolio } from '@/context/PortfolioContext';
import { toast } from 'sonner';

interface LearningPath {
  id: string;
  title: string;
  description: string;
  lessons: { title: string; duration: string; type: 'article' | 'video'; completed: boolean }[];
  icon: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  relatedView?: string;
}

const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'stocks-101',
    title: 'Stocks 101',
    description: 'Master the basics of stock investing',
    icon: '📈',
    level: 'Beginner',
    relatedView: 'knowledge-base',
    lessons: [
      { title: 'What is a Stock?', duration: '3 min', type: 'article', completed: true },
      { title: 'How the Stock Market Works', duration: '5 min', type: 'video', completed: true },
      { title: 'Understanding P/E Ratio', duration: '4 min', type: 'article', completed: true },
      { title: 'Reading Financial Statements', duration: '8 min', type: 'article', completed: true },
      { title: 'ETFs vs Mutual Funds', duration: '4 min', type: 'video', completed: true },
      { title: 'Building Your First Portfolio', duration: '6 min', type: 'video', completed: false },
      { title: 'Understanding Risk & Return', duration: '5 min', type: 'article', completed: false },
      { title: 'Dollar-Cost Averaging', duration: '3 min', type: 'article', completed: false },
    ],
  },
  {
    id: 'dividend-mastery',
    title: 'Dividend Mastery',
    description: 'Build passive income with dividends',
    icon: '💰',
    level: 'Intermediate',
    relatedView: 'dividends',
    lessons: [
      { title: 'What Are Dividends?', duration: '3 min', type: 'article', completed: true },
      { title: 'Dividend Yield Explained', duration: '4 min', type: 'video', completed: true },
      { title: 'Ex-Date vs Pay Date', duration: '3 min', type: 'article', completed: true },
      { title: 'Payout Ratio Analysis', duration: '5 min', type: 'article', completed: false },
      { title: 'Dividend Aristocrats & Kings', duration: '6 min', type: 'video', completed: false },
      { title: 'DRIP: Reinvestment Power', duration: '4 min', type: 'video', completed: false },
      { title: 'Building a Dividend Portfolio', duration: '8 min', type: 'article', completed: false },
      { title: 'Dividend Safety Scores', duration: '5 min', type: 'article', completed: false },
      { title: 'Tax Implications of Dividends', duration: '6 min', type: 'article', completed: false },
      { title: 'Monthly Income Strategy', duration: '7 min', type: 'video', completed: false },
      { title: 'International Dividends', duration: '4 min', type: 'article', completed: false },
      { title: 'Setting Income Goals', duration: '5 min', type: 'video', completed: false },
    ],
  },
  {
    id: 'portfolio-strategy',
    title: 'Portfolio Strategy',
    description: 'Build & manage a winning portfolio',
    icon: '🎯',
    level: 'Advanced',
    relatedView: 'portfolio-lab',
    lessons: [
      { title: 'Asset Allocation Basics', duration: '5 min', type: 'article', completed: false },
      { title: 'Modern Portfolio Theory', duration: '8 min', type: 'video', completed: false },
      { title: 'Rebalancing Strategies', duration: '6 min', type: 'article', completed: false },
      { title: 'Risk-Adjusted Returns', duration: '7 min', type: 'article', completed: false },
      { title: 'Factor Investing', duration: '6 min', type: 'video', completed: false },
      { title: 'Sector Rotation', duration: '5 min', type: 'article', completed: false },
      { title: 'Tax-Loss Harvesting', duration: '8 min', type: 'video', completed: false },
      { title: 'Backtesting Strategies', duration: '7 min', type: 'article', completed: false },
      { title: 'Correlation Analysis', duration: '5 min', type: 'article', completed: false },
      { title: 'Building a Core-Satellite Portfolio', duration: '6 min', type: 'video', completed: false },
    ],
  },
];

const LearningHub: React.FC = () => {
  const { switchView } = usePortfolio();
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('wealthos_completed_lessons');
    return saved ? new Set(JSON.parse(saved)) : new Set(
      LEARNING_PATHS.flatMap(p => p.lessons.filter(l => l.completed).map(l => `${p.id}-${l.title}`))
    );
  });

  const toggleLesson = (pathId: string, lessonTitle: string) => {
    const key = `${pathId}-${lessonTitle}`;
    setCompletedLessons(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        toast.success(`✅ Lesson completed! +50 XP`);
      }
      localStorage.setItem('wealthos_completed_lessons', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const getPathProgress = (path: LearningPath) => {
    const completed = path.lessons.filter(l => completedLessons.has(`${path.id}-${l.title}`)).length;
    return Math.round((completed / path.lessons.length) * 100);
  };

  const getTotalDuration = (path: LearningPath) => {
    const totalMin = path.lessons.reduce((s, l) => s + parseInt(l.duration), 0);
    return totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`;
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" /> Learning Hub
          </h3>
          <button
            onClick={() => switchView('knowledge-base')}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            View All
          </button>
        </div>

        {/* Learning Paths */}
        <div className="space-y-3">
          {LEARNING_PATHS.map((path) => {
            const progress = getPathProgress(path);
            const isExpanded = expandedPath === path.id;
            const completedCount = path.lessons.filter(l => completedLessons.has(`${path.id}-${l.title}`)).length;

            return (
              <div key={path.id} className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setExpandedPath(isExpanded ? null : path.id)}
                  className="w-full p-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{path.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground text-sm">{path.title}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">{path.level}</Badge>
                        {progress === 100 && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">{path.description}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground font-medium">{progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3" /> {completedCount}/{path.lessons.length}</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {getTotalDuration(path)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded lesson list */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-2 space-y-1 max-h-[250px] overflow-y-auto">
                    {path.lessons.map((lesson, i) => {
                      const isCompleted = completedLessons.has(`${path.id}-${lesson.title}`);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleLesson(path.id, lesson.title)}
                          className={`flex items-center gap-2.5 w-full p-2 rounded-lg text-left transition-colors ${
                            isCompleted ? 'bg-primary/5' : 'hover:bg-muted'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isCompleted ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {isCompleted && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className={`flex-1 min-w-0 ${isCompleted ? 'opacity-60' : ''}`}>
                            <span className={`text-xs font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {lesson.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                            {lesson.type === 'video' ? <Play className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                            {lesson.duration}
                          </div>
                        </button>
                      );
                    })}
                    {path.relatedView && (
                      <button
                        onClick={() => switchView(path.relatedView as any)}
                        className="w-full mt-1 py-2 text-[11px] font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        Open Related Tool <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LearningHub;
