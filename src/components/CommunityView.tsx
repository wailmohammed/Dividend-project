import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Heart, Share2, TrendingUp, Users, Zap, ArrowRight, Sparkles, Send, UserPlus, UserCheck, Loader2, FlaskConical, Flame, Clock, PieChart, Eye, ExternalLink } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useSocialFeatures } from '../hooks/useSocialFeatures';
import { formatDistanceToNow } from 'date-fns';
import PostComments from './PostComments';
import PortfolioSharingModal from './PortfolioSharingModal';
import { Alert, AlertDescription } from './ui/alert';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { useAuth } from '@/context/AuthContext';
import { DEMO_COMMUNITY_POSTS } from '@/constants/demoCommunityPosts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { supabase } from '@/integrations/supabase/client';

const CommunityView: React.FC = () => {
  const { user } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState(!user || user.id === 'demo-user' || getDemoModeEnabled());

  useEffect(() => {
    const checkDemoMode = () => {
      setIsDemoMode(!user || user.id === 'demo-user' || getDemoModeEnabled());
    };
    window.addEventListener('storage', checkDemoMode);
    const interval = setInterval(checkDemoMode, 1000);
    return () => {
      window.removeEventListener('storage', checkDemoMode);
      clearInterval(interval);
    };
  }, [user]);
  const { viewStock, switchView } = usePortfolio();
  const { posts, following, loading, createPost, likePost, followUser } = useSocialFeatures();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('for-you');
  const [publicPortfolios, setPublicPortfolios] = useState<any[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  // Fetch public portfolios when tab changes
  useEffect(() => {
    if (activeTab === 'portfolios') {
      setLoadingPublic(true);
      supabase
        .from('shared_portfolios')
        .select('*, profiles:user_id(full_name, avatar_url)')
        .eq('is_public', true)
        .order('views_count', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setPublicPortfolios(data || []);
          setLoadingPublic(false);
        });
    }
  }, [activeTab]);

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  // Helper to find asset details - just return ticker info, no hardcoded data
  const getAssetDetails = (ticker: string) => {
    const cleanTicker = ticker.replace('$', '');
    return { symbol: cleanTicker, name: cleanTicker, currentPrice: 0 };
  };

  const handlePost = async () => {
    if (!newPostContent.trim() || isPosting) return;
    setIsPosting(true);
    await createPost(newPostContent);
    setNewPostContent('');
    setIsPosting(false);
  };

  const handleLike = async (postId: string) => {
    await likePost(postId);
  };

  const handleFollow = async (userId: string) => {
    await followUser(userId);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-20">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Demo Mode:</strong> Viewing sample community posts and interactions.
          </AlertDescription>
        </Alert>
      )}

      {/* Featured Insights Carousel */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" /> Daily Insights
          </h2>
          <button onClick={() => switchView('research')} className="text-sm text-brand-600 dark:text-brand-400 font-medium hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => viewStock('NVDA')} className="relative h-48 rounded-2xl p-6 flex flex-col justify-end overflow-hidden group cursor-pointer shadow-lg hover:shadow-xl transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 transition-transform duration-500 group-hover:scale-105"></div>
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            <div className="relative z-10">
              <div className="bg-white/20 backdrop-blur-md w-fit px-2 py-1 rounded text-[10px] font-bold text-white mb-2 border border-white/10">MARKET MOVER</div>
              <h3 className="text-white font-bold text-lg leading-tight mb-1">Tech Sector Rebounds</h3>
              <p className="text-indigo-100 text-xs line-clamp-2">Nasdaq futures are up 1.2% pre-market as AI stocks lead the charge.</p>
            </div>
          </div>

          <div onClick={() => viewStock('O')} className="relative h-48 rounded-2xl p-6 flex flex-col justify-end overflow-hidden group cursor-pointer shadow-lg hover:shadow-xl transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-700 transition-transform duration-500 group-hover:scale-105"></div>
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            <div className="relative z-10">
              <div className="bg-white/20 backdrop-blur-md w-fit px-2 py-1 rounded text-[10px] font-bold text-white mb-2 border border-white/10">DIVIDEND GEM</div>
              <h3 className="text-white font-bold text-lg leading-tight mb-1">Realty Income (O) Analysis</h3>
              <p className="text-emerald-100 text-xs line-clamp-2">Why the 6% yield might be the safest bet in this high-rate environment.</p>
            </div>
          </div>

          <div onClick={() => viewStock('TSLA')} className="relative h-48 rounded-2xl p-6 flex flex-col justify-end overflow-hidden group cursor-pointer shadow-lg hover:shadow-xl transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 transition-transform duration-500 group-hover:scale-105"></div>
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
            <div className="relative z-10">
              <div className="bg-white/20 backdrop-blur-md w-fit px-2 py-1 rounded text-[10px] font-bold text-white mb-2 border border-white/10">EARNINGS WATCH</div>
              <h3 className="text-white font-bold text-lg leading-tight mb-1">Tesla Q3 Preview</h3>
              <p className="text-amber-100 text-xs line-clamp-2">Margins are in focus. What analysts are expecting from the EV giant.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Community</h2>
          </div>

          {/* Create Post */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-600/20 shrink-0">YO</div>
              <input
                type="text"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share your investment thoughts (use $TICKER)..."
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-slate-900 dark:text-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                disabled={isPosting}
              />
            </div>
            <div className="flex justify-between items-center mt-3 px-1">
              <div className="flex gap-2">
                <button className="p-2 text-slate-400 hover:text-brand-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><TrendingUp className="w-4 h-4" /></button>
                <button className="p-2 text-slate-400 hover:text-brand-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Zap className="w-4 h-4" /></button>
              </div>
              <button
                onClick={handlePost}
                disabled={!newPostContent.trim() || isPosting}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isPosting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Post
              </button>
            </div>
          </div>

          {/* Tabs for Feed Filtering */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-6">
              <TabsTrigger value="for-you" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">For You</span>
                <span className="sm:hidden">For You</span>
              </TabsTrigger>
              <TabsTrigger value="following" className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Following</span>
                <span className="sm:hidden">Follow</span>
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex items-center gap-2">
                <Flame className="w-4 h-4" />
                <span className="hidden sm:inline">Trending</span>
                <span className="sm:hidden">Hot</span>
              </TabsTrigger>
              <TabsTrigger value="portfolios" className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                <span className="hidden sm:inline">Portfolios</span>
                <span className="sm:hidden">Port.</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="for-you" className="mt-0 space-y-4">
              {loading && !isDemoMode ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
              ) : (isDemoMode ? DEMO_COMMUNITY_POSTS : posts).length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                  <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1">No posts yet</h3>
                  <p className="text-sm text-slate-500">Be the first to share your investment thoughts!</p>
                </div>
              ) : (
                (isDemoMode ? DEMO_COMMUNITY_POSTS : posts).map((post) => (
                <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-brand-200 dark:hover:border-slate-700 transition-all shadow-sm animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {post.user_avatar ? (
                        <img src={post.user_avatar} alt={post.user_name} className="w-11 h-11 rounded-full border-2 border-slate-100 dark:border-slate-800" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
                          {post.user_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                          {post.user_name || 'Anonymous'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(post.created_at)}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleFollow(post.user_id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        following.includes(post.user_id)
                          ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                          : 'text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                      }`}
                    >
                      {following.includes(post.user_id) ? (
                        <><UserCheck className="w-3 h-3" /> Following</>
                      ) : (
                        <><UserPlus className="w-3 h-3" /> Follow</>
                      )}
                    </button>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4 whitespace-pre-line">
                    {post.content.split(' ').map((word, i) =>
                      word.startsWith('$') ?
                        <button key={i} onClick={() => viewStock(word.replace('$', ''))} className="text-brand-600 dark:text-brand-400 font-bold cursor-pointer hover:underline">{word} </button> :
                        word.startsWith('#') ? <span key={i} className="text-brand-600 dark:text-brand-400 font-bold">{word} </span> :
                          word + ' '
                    )}
                  </p>

                  {/* Rich Asset Snapshot Cards */}
                  {post.tickers && post.tickers.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                      {post.tickers.map(ticker => {
                        const asset = getAssetDetails(ticker);
                        if (!asset) return null;
                        return (
                          <div key={ticker} onClick={() => viewStock(ticker)} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 group cursor-pointer hover:border-brand-300 dark:hover:border-slate-600 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">
                                {ticker[0]}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{ticker}</div>
                                <div className="text-xs text-slate-500">Stock</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Quote unavailable</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-2 transition-colors text-sm group ${post.is_liked ? 'text-red-500' : 'text-slate-500 hover:text-red-500'}`}
                    >
                      <Heart className={`w-5 h-5 ${post.is_liked ? 'fill-red-500' : 'group-hover:fill-red-500'}`} /> {post.likes_count}
                    </button>
                    <button 
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-2 text-slate-500 hover:text-blue-500 transition-colors text-sm"
                    >
                      <MessageSquare className="w-5 h-5" /> {post.comments_count}
                    </button>
                    <button className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm ml-auto">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Comments Section */}
                  <PostComments 
                    postId={post.id} 
                    isExpanded={expandedComments.has(post.id)}
                    onToggle={() => toggleComments(post.id)}
                    commentCount={post.comments_count}
                  />
                </div>
              ))
            )}
            </TabsContent>

            <TabsContent value="following" className="mt-0 space-y-4">
              {(isDemoMode ? DEMO_COMMUNITY_POSTS : posts)
                .filter(post => following.includes(post.user_id))
                .length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
                  <UserCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1">No posts from following</h3>
                  <p className="text-sm text-slate-500">Follow investors to see their posts here</p>
                </div>
              ) : (
                (isDemoMode ? DEMO_COMMUNITY_POSTS : posts)
                  .filter(post => following.includes(post.user_id))
                  .slice(0, 3)
                  .map((post) => (
                    <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-brand-200 dark:hover:border-slate-700 transition-all shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        {post.user_avatar ? (
                          <img src={post.user_avatar} alt={post.user_name} className="w-11 h-11 rounded-full border-2 border-slate-100 dark:border-slate-800" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
                            {post.user_name?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            {post.user_name || 'Anonymous'}
                          </div>
                          <div className="text-xs text-slate-500">{formatTimeAgo(post.created_at)}</div>
                        </div>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{post.content}</p>
                    </div>
                  ))
              )}
            </TabsContent>

            <TabsContent value="trending" className="mt-0 space-y-4">
              {(isDemoMode ? DEMO_COMMUNITY_POSTS : posts).slice(0, 5).map((post) => (
                <div key={post.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-brand-200 dark:hover:border-slate-700 transition-all shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {post.user_avatar ? (
                        <img src={post.user_avatar} alt={post.user_name} className="w-11 h-11 rounded-full border-2 border-slate-100 dark:border-slate-800" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
                          {post.user_name?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                          {post.user_name || 'Anonymous'}
                          <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                        </div>
                        <div className="text-xs text-slate-500">{post.likes_count + post.comments_count} engagements</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4">{post.content}</p>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {post.likes_count}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {post.comments_count}</span>
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Public Portfolios Tab */}
            <TabsContent value="portfolios" className="mt-0 space-y-4">
              {loadingPublic ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : publicPortfolios.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <PieChart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <h3 className="font-bold mb-1">No public portfolios yet</h3>
                    <p className="text-sm text-muted-foreground">Be the first to share your portfolio with the community!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {publicPortfolios.map((p: any) => {
                    const profile = p.profiles as any;
                    const name = profile?.full_name || 'Anonymous';
                    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <Card key={p.id} className="hover:border-primary/50 transition-colors">
                        <CardContent className="pt-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{name}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Eye className="w-3 h-3" />
                                <span>{p.views_count || 0} views</span>
                              </div>
                            </div>
                            {p.share_code && (
                              <a
                                href={`/portfolio/${p.share_code}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Shared {formatTimeAgo(p.created_at)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Trending & Discovery */}
        <div className="space-y-6">

          {/* Trending Assets */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-500" /> Trending Assets
            </h3>
            <div className="space-y-2">
              {[
                { s: 'NVDA', n: 'Nvidia', v: '+5.4%', p: 460.12 },
                { s: 'PLTR', n: 'Palantir', v: '+3.2%', p: 17.40 },
                { s: 'AMD', n: 'Adv Micro Dev', v: '-1.1%', p: 102.33 },
                { s: 'TSLA', n: 'Tesla', v: '+1.8%', p: 242.50 },
                { s: 'COIN', n: 'Coinbase', v: '+4.5%', p: 85.20 },
              ].map((item) => (
                <div key={item.s} onClick={() => viewStock(item.s)} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700 group-hover:border-brand-500/50">
                      {item.s[0]}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200 text-sm">{item.s}</div>
                      <div className="text-slate-500 text-[10px]">${item.p}</div>
                    </div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-lg ${item.v.includes('+') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {item.v}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => switchView('research')} className="w-full mt-4 py-2.5 text-sm text-brand-600 dark:text-brand-400 font-bold bg-brand-50 dark:bg-brand-900/20 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors flex items-center justify-center gap-2">
              View Market <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Top Portfolios */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-500" /> Top Investors
            </h3>
            <div className="space-y-3">
              {[
                { name: 'DividendKing', followers: 2453, ret: '+24%' },
                { name: 'TechAggressive', followers: 1876, ret: '+56%' },
                { name: 'AllWeather', followers: 1234, ret: '+12%' },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:border-brand-300 dark:hover:border-brand-500/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-400 to-purple-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200 text-sm">{p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.followers.toLocaleString()} followers</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-500">{p.ret}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Share Portfolio Card */}
          <div className="bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-brand-500/20 rounded-2xl p-5">
            <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-brand-500" /> Share Your Portfolio
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Make your portfolio public and share your investment strategy with the community.
            </p>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="w-full py-2.5 text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition-colors"
            >
              Share Portfolio
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Sharing Modal */}
      <PortfolioSharingModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
      />
    </div>
  );
};

export default CommunityView;
