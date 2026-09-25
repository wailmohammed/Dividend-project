import React, { useState } from 'react';
import { UserCheck, MessageCircle, Star, ArrowRight, Shield, Sparkles, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePortfolio } from '@/context/PortfolioContext';

interface Mentor {
  id: string;
  name: string;
  avatar: string;
  expertise: string[];
  rating: number;
  sessions: number;
  bio: string;
  availability: string;
  relatedView?: string;
}

const MENTORS: Mentor[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    avatar: 'SC',
    expertise: ['Dividends', 'REITs', 'Income'],
    rating: 4.9,
    sessions: 234,
    bio: 'Former financial advisor with 15+ years experience in dividend investing.',
    availability: 'Available this week',
    relatedView: 'dividends',
  },
  {
    id: '2',
    name: 'Marcus Williams',
    avatar: 'MW',
    expertise: ['Growth', 'Tech', 'ETFs'],
    rating: 4.8,
    sessions: 187,
    bio: 'Software engineer turned full-time investor. Specializes in tech sector analysis.',
    availability: 'Next available: Mon',
    relatedView: 'etf-lookthrough',
  },
  {
    id: '3',
    name: 'Priya Patel',
    avatar: 'PP',
    expertise: ['Value', 'Fundamentals', 'Macro'],
    rating: 4.9,
    sessions: 312,
    bio: 'CFA charterholder helping beginners build long-term wealth strategies.',
    availability: 'Available today',
    relatedView: 'fair-value',
  },
];

const MentorshipWidget: React.FC = () => {
  const { switchView } = usePortfolio();
  const [showAll, setShowAll] = useState(false);
  const [requestedMentors, setRequestedMentors] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('wealthos_mentor_requests');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const displayed = showAll ? MENTORS : MENTORS.slice(0, 2);

  const requestSession = (mentorId: string, mentorName: string) => {
    setRequestedMentors(prev => {
      const next = new Set(prev);
      next.add(mentorId);
      localStorage.setItem('wealthos_mentor_requests', JSON.stringify(Array.from(next)));
      return next;
    });
    toast.success(`📩 Session request sent to ${mentorName}! You'll be notified when they accept.`);
  };

  return (
    <Card className="shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Support Circle
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          Connect with experienced investors who can guide your wealth-building journey.
        </p>
      </div>

      <CardContent className="pt-3 space-y-3">
        {displayed.map((mentor) => {
          const isRequested = requestedMentors.has(mentor.id);
          return (
            <div
              key={mentor.id}
              className="p-3 rounded-xl border border-border hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {mentor.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-foreground text-sm">{mentor.name}</span>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      <Star className="w-3 h-3 fill-amber-500" />
                      <span className="text-[10px] font-bold">{mentor.rating}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5">{mentor.bio}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {mentor.expertise.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] py-0 px-1.5 cursor-pointer" onClick={() => {
                        if (mentor.relatedView) switchView(mentor.relatedView as any);
                      }}>{tag}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {mentor.sessions} sessions</span>
                    <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {mentor.availability}</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={isRequested ? "secondary" : "outline"}
                className="w-full mt-2 h-7 text-[11px] gap-1.5"
                disabled={isRequested}
                onClick={() => requestSession(mentor.id, mentor.name)}
              >
                <MessageCircle className="w-3 h-3" />
                {isRequested ? 'Request Sent ✓' : 'Request Session'}
              </Button>
            </div>
          );
        })}

        {!showAll && MENTORS.length > 2 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            View All Mentors <ArrowRight className="w-3 h-3" />
          </button>
        )}

        {/* Become a Mentor CTA */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Become a Mentor</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Share your knowledge and earn XP by helping others build wealth.
          </p>
          <Button
            size="sm"
            className="h-7 text-[11px] w-full"
            onClick={() => {
              toast.success('🎓 Mentor application submitted! We\'ll review and get back to you within 48 hours.');
            }}
          >
            Apply Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MentorshipWidget;
