import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

export const usePostComments = (postId: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!postId || !UUID_RE.test(postId)) {
      // Demo / synthetic posts have non-UUID ids — skip remote fetch
      setComments([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedComments: PostComment[] = data.map(comment => ({
          ...comment,
          user_name: profileMap.get(comment.user_id)?.full_name || 'Anonymous',
          user_avatar: profileMap.get(comment.user_id)?.avatar_url
        }));

        setComments(enrichedComments);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error?.message || error?.code || JSON.stringify(error));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const addComment = async (content: string) => {
    if (!user || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Update comment count on post and get post owner
      const { data: post } = await supabase
        .from('community_posts')
        .select('comments_count, user_id')
        .eq('id', postId)
        .single();
      
      if (post) {
        await supabase
          .from('community_posts')
          .update({ comments_count: (post.comments_count || 0) + 1 })
          .eq('id', postId);

        // Create notification for post owner (if not commenting on own post)
        if (post.user_id !== user.id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: post.user_id,
              type: 'comment',
              actor_id: user.id,
              target_id: postId,
              content: content.trim().substring(0, 100)
            });

          // Send email notification via edge function
          await supabase.functions.invoke('social-notifications', {
            body: {
              type: 'comment',
              recipientUserId: post.user_id,
              actorUserId: user.id,
              content: content.trim().substring(0, 100),
              postId
            }
          });
        }
      }

      // Fetch user profile for the new comment
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      const newComment: PostComment = {
        ...data,
        user_name: profile?.full_name || 'You',
        user_avatar: profile?.avatar_url
      };

      setComments(prev => [...prev, newComment]);
      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== commentId));
      toast({ title: 'Comment deleted' });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({ title: 'Failed to delete comment', variant: 'destructive' });
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`
        },
        async (payload) => {
          // Avoid duplicates from own inserts
          if (comments.some(c => c.id === payload.new.id)) return;

          // Fetch user profile for new comment
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newComment: PostComment = {
            ...(payload.new as any),
            user_name: profile?.full_name || 'Anonymous',
            user_avatar: profile?.avatar_url
          };

          setComments(prev => {
            if (prev.some(c => c.id === newComment.id)) return prev;
            return [...prev, newComment];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`
        },
        (payload) => {
          setComments(prev => prev.filter(c => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchComments]);

  return {
    comments,
    loading,
    addComment,
    deleteComment,
    refetch: fetchComments
  };
};
