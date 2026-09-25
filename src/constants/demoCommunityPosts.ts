// Demo community posts for demonstration mode
export interface DemoCommunityPost {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  tickers: string[];
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
}

export const DEMO_COMMUNITY_POSTS: DemoCommunityPost[] = [
  {
    id: 'demo-post-1',
    user_id: 'demo-user-1',
    user_name: 'Sarah Chen',
    content: 'Just increased my position in $O (Realty Income). The monthly dividend is incredibly reliable and I love the diversification across retail properties. Perfect for building passive income! 💰\n\nAnyone else bullish on REITs in this environment?',
    tickers: ['O'],
    likes_count: 47,
    comments_count: 12,
    is_liked: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
  },
  {
    id: 'demo-post-2',
    user_id: 'demo-user-2',
    user_name: 'Mike Thompson',
    content: 'Portfolio update: Trimmed my $NVDA position after the massive run-up and rotated some profits into $SCHD for more dividend exposure. Still holding core tech but balancing with income. 📊',
    tickers: ['NVDA', 'SCHD'],
    likes_count: 82,
    comments_count: 23,
    is_liked: true,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
  },
  {
    id: 'demo-post-3',
    user_id: 'demo-user-3',
    user_name: 'Emily Rodriguez',
    content: 'Dividend growth investing tip: Focus on companies with 10+ years of consecutive dividend increases. $JNJ, $PG, and $KO are my core holdings for this strategy. Slow and steady wins the race! 🐢',
    tickers: ['JNJ', 'PG', 'KO'],
    likes_count: 156,
    comments_count: 34,
    is_liked: false,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
  },
  {
    id: 'demo-post-4',
    user_id: 'demo-user-4',
    user_name: 'David Park',
    content: 'Big news! $AAPL just announced a dividend increase. That\'s 12 consecutive years of raises. The cash machine keeps delivering. Love seeing my dividend income grow year over year. 📈',
    tickers: ['AAPL'],
    likes_count: 234,
    comments_count: 45,
    is_liked: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: 'demo-post-5',
    user_id: 'demo-user-5',
    user_name: 'Jessica Miller',
    content: 'Just hit a milestone! My portfolio now generates $500/month in passive dividend income. Started 3 years ago with just $10k. Consistency is key! 🎉\n\n#DividendInvesting #PassiveIncome #FinancialFreedom',
    tickers: [],
    likes_count: 312,
    comments_count: 67,
    is_liked: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  },
  {
    id: 'demo-post-6',
    user_id: 'demo-user-6',
    user_name: 'Alex Kim',
    content: 'Comparing $VZ vs $T for dividend income. Verizon has better dividend coverage and lower debt. AT&T yield is tempting but the payout ratio concerns me. What\'s everyone\'s take? 🤔',
    tickers: ['VZ', 'T'],
    likes_count: 89,
    comments_count: 41,
    is_liked: false,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  },
];
