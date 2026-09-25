import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  tickers: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
  is_liked?: boolean;
}

export interface UserFollower {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface SharedPortfolio {
  id: string;
  portfolio_id: string;
  user_id: string;
  is_public: boolean;
  share_code: string | null;
  views_count: number;
}

// Helper to create notifications and send emails
const createNotification = async (
  actorId: string,
  targetUserId: string,
  type: 'follower' | 'like' | 'comment',
  targetId?: string,
  content?: string
) => {
  if (actorId === targetUserId) return; // Don't notify yourself

  try {
    // Create in-app notification
    await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type,
        actor_id: actorId,
        target_id: targetId || null,
        content: content || null
      });

    // Send email notification via edge function
    await supabase.functions.invoke('social-notifications', {
      body: {
        type,
        recipientUserId: targetUserId,
        actorUserId: actorId,
        content,
        postId: targetId
      }
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};

export const useSocialFeatures = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profiles for posts
      if (postsData && postsData.length > 0) {
        const userIds = [...new Set(postsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Check which posts user has liked
        let likedPostIds: string[] = [];
        if (user) {
          const { data: likes } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', user.id);
          likedPostIds = likes?.map(l => l.post_id) || [];
        }

        const enrichedPosts: CommunityPost[] = postsData.map(post => ({
          ...post,
          tickers: post.tickers || [],
          user_name: profileMap.get(post.user_id)?.full_name || 'Anonymous',
          user_avatar: profileMap.get(post.user_id)?.avatar_url,
          is_liked: likedPostIds.includes(post.id)
        }));

        setPosts(enrichedPosts);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  };

  const fetchFollowing = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_followers')
        .select('following_id')
        .eq('follower_id', user.id);

      if (error) throw error;
      setFollowing(data?.map(f => f.following_id) || []);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const fetchFollowers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_followers')
        .select('follower_id')
        .eq('following_id', user.id);

      if (error) throw error;
      setFollowers(data?.map(f => f.follower_id) || []);
    } catch (error) {
      console.error('Error fetching followers:', error);
    }
  };

  const createPost = async (content: string) => {
    if (!user) return;
    
    // Extract tickers from content
    const tickers = (content.match(/\$[A-Z]+/g) || []).map(t => t.replace('$', ''));

    try {
      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: user.id,
          content,
          tickers
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Post created!' });
      await fetchPosts();
      return data;
    } catch (error) {
      console.error('Error creating post:', error);
      toast({ title: 'Failed to create post', variant: 'destructive' });
    }
  };

  const updatePost = async (postId: string, content: string) => {
    if (!user) return;
    const tickers = (content.match(/\$[A-Z]+/g) || []).map(t => t.replace('$', ''));
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({ content, tickers, updated_at: new Date().toISOString() })
        .eq('id', postId);
      if (error) throw error;
      toast({ title: 'Post updated!' });
      await fetchPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      toast({ title: 'Failed to update post', variant: 'destructive' });
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) return;
    try {
      // Delete related likes and comments first
      await supabase.from('post_likes').delete().eq('post_id', postId);
      await supabase.from('post_comments').delete().eq('post_id', postId);
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
      toast({ title: 'Post deleted' });
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({ title: 'Failed to delete post', variant: 'destructive' });
    }
  };

  const likePost = async (postId: string) => {
    if (!user) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.is_liked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await supabase
          .from('community_posts')
          .update({ likes_count: Math.max(0, post.likes_count - 1) })
          .eq('id', postId);
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        await supabase
          .from('community_posts')
          .update({ likes_count: post.likes_count + 1 })
          .eq('id', postId);

        // Create notification for post owner
        await createNotification(user.id, post.user_id, 'like', postId);
      }

      // Update local state
      setPosts(posts.map(p => 
        p.id === postId 
          ? { ...p, is_liked: !p.is_liked, likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      ));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const followUser = async (userId: string) => {
    if (!user || userId === user.id) return;

    try {
      if (following.includes(userId)) {
        // Unfollow
        await supabase
          .from('user_followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        setFollowing(following.filter(id => id !== userId));
        toast({ title: 'Unfollowed user' });
      } else {
        // Follow
        await supabase
          .from('user_followers')
          .insert({ follower_id: user.id, following_id: userId });

        setFollowing([...following, userId]);
        toast({ title: 'Now following user!' });

        // Create notification for followed user
        await createNotification(user.id, userId, 'follower');
      }
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const sharePortfolio = async (portfolioId: string, isPublic: boolean) => {
    if (!user) return;

    const shareCode = Math.random().toString(36).substring(2, 10);

    try {
      const { data, error } = await supabase
        .from('shared_portfolios')
        .upsert({
          portfolio_id: portfolioId,
          user_id: user.id,
          is_public: isPublic,
          share_code: shareCode
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: isPublic ? 'Portfolio shared publicly!' : 'Portfolio sharing updated' });
      return data;
    } catch (error) {
      console.error('Error sharing portfolio:', error);
      toast({ title: 'Failed to share portfolio', variant: 'destructive' });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPosts(), fetchFollowing(), fetchFollowers()]);
      setLoading(false);
    };
    loadData();
  }, [user]);

  return {
    posts,
    following,
    followers,
    loading,
    createPost,
    updatePost,
    deletePost,
    likePost,
    followUser,
    sharePortfolio,
    refetch: fetchPosts
  };
};
