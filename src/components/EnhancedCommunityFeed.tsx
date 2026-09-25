import React, { useState } from 'react';
import { MessageSquare, Heart, Share2, TrendingUp, Users, Send, UserPlus, UserCheck, Loader2, FlaskConical, Smile, BarChart2, Copy, Check, MoreHorizontal, Pencil, Trash2, X, GraduationCap, Trophy, Target, Shield } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext';
import { useSocialFeatures } from '../hooks/useSocialFeatures';
import { formatDistanceToNow } from 'date-fns';
import PostComments from './PostComments';
import { Alert, AlertDescription } from './ui/alert';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { DEMO_COMMUNITY_POSTS } from '@/constants/demoCommunityPosts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';
import MemberAchievements from '@/components/community/MemberAchievements';
import CommunityChallenges from '@/components/community/CommunityChallenges';
import LearningHub from '@/components/community/LearningHub';
import MentorshipWidget from '@/components/community/MentorshipWidget';

const TOPIC_FILTERS = [
  { id: 'all', label: 'All', icon: '🔥' },
  { id: 'dividends', label: 'Dividends', icon: '💰' },
  { id: 'growth', label: 'Growth', icon: '📈' },
  { id: 'etf', label: 'ETFs', icon: '📊' },
  { id: 'crypto', label: 'Crypto', icon: '₿' },
  { id: 'macro', label: 'Macro', icon: '🌍' },
];

const EMOJI_REACTIONS = ['🚀', '💎', '🔥', '💡', '👀', '🐻'];

const CommunityView: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole(user?.id);
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { viewStock, switchView } = usePortfolio();
  const { posts, following, loading, createPost, updatePost, deletePost, likePost, followUser } = useSocialFeatures();
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [activeTopic, setActiveTopic] = useState('all');
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [userReactions, setUserReactions] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const handlePost = async () => {
    if (!newPostContent.trim() || isPosting) return;
    setIsPosting(true);
    await createPost(newPostContent);
    setNewPostContent('');
    setIsPosting(false);
  };

  const handleReaction = (postId: string, emoji: string) => {
    setReactions(prev => {
      const postReactions = { ...(prev[postId] || {}) };
      const prevEmoji = userReactions[postId];
      if (prevEmoji === emoji) {
        postReactions[emoji] = Math.max(0, (postReactions[emoji] || 1) - 1);
        setUserReactions(r => { const n = { ...r }; delete n[postId]; return n; });
      } else {
        if (prevEmoji) postReactions[prevEmoji] = Math.max(0, (postReactions[prevEmoji] || 1) - 1);
        postReactions[emoji] = (postReactions[emoji] || 0) + 1;
        setUserReactions(r => ({ ...r, [postId]: emoji }));
      }
      return { ...prev, [postId]: postReactions };
    });
    setShowEmojiPicker(null);
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/community/post/${postId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(postId);
    toast.success('Post link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (postId: string, content: string) => {
    setEditingPostId(postId);
    setEditContent(content);
  };

  const handleSaveEdit = async () => {
    if (!editingPostId || !editContent.trim()) return;
    await updatePost(editingPostId, editContent);
    setEditingPostId(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditContent('');
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deletePost(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const canManagePost = (postUserId: string) => {
    if (!user) return false;
    return user.id === postUserId || isAdmin;
  };

  const formatTimeAgo = (dateString: string) => {
    try { return formatDistanceToNow(new Date(dateString), { addSuffix: true }); }
    catch { return 'recently'; }
  };

  const renderTickerLink = (word: string, i: number) => {
    if (word.startsWith('$')) {
      const ticker = word.replace(/[^A-Z$]/gi, '');
      return (
        <button key={i} onClick={() => viewStock(ticker.replace('$', ''))}
          className="inline-flex items-center gap-0.5 text-primary font-bold hover:underline bg-primary/10 px-1.5 py-0.5 rounded-md text-sm">
          {ticker}
        </button>
      );
    }
    if (word.startsWith('#')) return <span key={i} className="text-primary font-semibold">{word} </span>;
    return word + ' ';
  };

  const allPosts = isDemoMode ? DEMO_COMMUNITY_POSTS : posts;

  const filteredPosts = activeTopic === 'all' ? allPosts : allPosts.filter(p => {
    const content = p.content.toLowerCase();
    if (activeTopic === 'dividends') return content.includes('dividend') || content.includes('yield') || content.includes('income');
    if (activeTopic === 'growth') return content.includes('growth') || content.includes('bull') || p.tickers.some(t => ['NVDA', 'TSLA', 'AMD', 'PLTR'].includes(t));
    if (activeTopic === 'etf') return content.includes('etf') || p.tickers.some(t => ['VOO', 'SCHD', 'QQQ', 'VTI'].includes(t));
    if (activeTopic === 'crypto') return content.includes('crypto') || content.includes('bitcoin');
    if (activeTopic === 'macro') return content.includes('market') || content.includes('fed') || content.includes('economy');
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6 pb-20">
      {isDemoMode && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample community posts and interactions.
          </AlertDescription>
        </Alert>
      )}

      {/* Topic Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {TOPIC_FILTERS.map(topic => (
          <button
            key={topic.id}
            onClick={() => setActiveTopic(topic.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeTopic === topic.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}
          >
            <span>{topic.icon}</span> {topic.label}
          </button>
        ))}
      </div>

      {/* Trending Tickers Bar */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
        <TrendingUp className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">Trending:</span>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {['NVDA', 'AAPL', 'SCHD', 'O', 'PLTR', 'TSLA'].map(ticker => (
            <button key={ticker} onClick={() => viewStock(ticker)}
              className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full hover:bg-primary/20 transition-colors whitespace-nowrap">
              ${ticker}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Create Post */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                {user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Share your investment thoughts (use $TICKER to tag stocks)..."
                  className="w-full bg-muted border-0 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all resize-none min-h-[80px]"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePost()}
                  disabled={isPosting}
                  rows={2}
                />
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">Tip: Use $TICKER</Badge>
                    <Badge variant="outline" className="text-[10px]">Use #hashtags</Badge>
                  </div>
                  <Button onClick={handlePost} disabled={!newPostContent.trim() || isPosting} size="sm" className="gap-1.5">
                    {isPosting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Posts */}
          {loading && !isDemoMode ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-bold text-foreground mb-1">No posts in this topic</h3>
              <p className="text-sm text-muted-foreground">Try another category or be the first to post!</p>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const postReactions = reactions[post.id] || {};
              const isEditing = editingPostId === post.id;
              return (
                <div key={post.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-all shadow-sm">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {post.user_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                          {post.user_name || 'Anonymous'}
                          <Badge variant="secondary" className="text-[10px] py-0">Pro</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatTimeAgo(post.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canManagePost(post.user_id) && !isDemoMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleStartEdit(post.id, post.content)} className="gap-2">
                              <Pencil className="w-3.5 h-3.5" /> Edit Post
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteConfirmId(post.id)} className="gap-2 text-destructive focus:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" /> Delete Post
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <button
                        onClick={() => followUser(post.user_id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                          following.includes(post.user_id)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                        }`}
                      >
                        {following.includes(post.user_id) ? <><UserCheck className="w-3 h-3" /> Following</> : <><UserPlus className="w-3 h-3" /> Follow</>}
                      </button>
                    </div>
                  </div>

                  {/* Content - Edit mode or display mode */}
                  {isEditing ? (
                    <div className="mb-3 space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all resize-none min-h-[80px]"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="gap-1.5">
                          <X className="w-3 h-3" /> Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim()} className="gap-1.5">
                          <Check className="w-3 h-3" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-foreground text-sm leading-relaxed mb-3 whitespace-pre-line">
                      {post.content.split(/(\s+)/).map((word, i) => renderTickerLink(word, i))}
                    </p>
                  )}

                  {/* Ticker Cards */}
                  {!isEditing && post.tickers && post.tickers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.tickers.map(ticker => (
                        <button key={ticker} onClick={() => viewStock(ticker)}
                          className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border hover:border-primary/50 transition-colors">
                          <span className="font-bold text-foreground text-xs">${ticker}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Emoji Reactions Row */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {Object.entries(postReactions).filter(([, count]) => count > 0).map(([emoji, count]) => (
                      <button key={emoji} onClick={() => handleReaction(post.id, emoji)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                          userReactions[post.id] === emoji ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
                        }`}>
                        <span>{emoji}</span>
                        <span className="font-medium">{count}</span>
                      </button>
                    ))}
                    <div className="relative">
                      <button onClick={() => setShowEmojiPicker(showEmojiPicker === post.id ? null : post.id)}
                        className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Smile className="w-4 h-4" />
                      </button>
                      {showEmojiPicker === post.id && (
                        <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-popover border border-border rounded-lg p-1.5 shadow-lg z-10">
                          {EMOJI_REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => handleReaction(post.id, emoji)}
                              className="hover:scale-125 transition-transform p-1 text-lg">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4 pt-3 border-t border-border">
                    <button onClick={() => likePost(post.id)}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${post.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}>
                      <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-red-500' : ''}`} /> {post.likes_count}
                    </button>
                    <button onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-sm">
                      <MessageSquare className="w-4 h-4" /> {post.comments_count}
                    </button>
                    <button onClick={() => handleShare(post.id)}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm ml-auto">
                      {copiedId === post.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <PostComments postId={post.id} isExpanded={expandedComments.has(post.id)}
                    onToggle={() => toggleComments(post.id)} commentCount={post.comments_count} />
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Member Achievements */}
          <MemberAchievements />

          {/* Community Stats */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Community Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-foreground">12.4K</div>
                <div className="text-[10px] text-muted-foreground font-medium">Members</div>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-foreground">847</div>
                <div className="text-[10px] text-muted-foreground font-medium">Posts Today</div>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-primary">{following.length}</div>
                <div className="text-[10px] text-muted-foreground font-medium">Following</div>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-foreground">$2.8B</div>
                <div className="text-[10px] text-muted-foreground font-medium">Total AUM</div>
              </div>
            </div>
          </div>

          {/* Community Challenges */}
          <CommunityChallenges />

          {/* Learning Hub */}
          <LearningHub />

          {/* Mentorship */}
          <MentorshipWidget />

          {/* Top Performers */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Top Contributors
            </h3>
            <div className="space-y-3">
              {[
                { name: 'Sarah Chen', posts: 128, followers: '2.1K' },
                { name: 'Mike Thompson', posts: 94, followers: '1.8K' },
                { name: 'Emily Rodriguez', posts: 76, followers: '3.2K' },
              ].map((contributor, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    {contributor.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{contributor.name}</div>
                    <div className="text-[10px] text-muted-foreground">{contributor.posts} posts · {contributor.followers} followers</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular Tags */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-foreground mb-4">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              {['#DividendInvesting', '#PassiveIncome', '#FIRE', '#ValueInvesting', '#GrowthStocks', '#ETFs', '#DividendGrowth', '#IncomeInvesting'].map(tag => (
                <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone. All comments and likes will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommunityView;
