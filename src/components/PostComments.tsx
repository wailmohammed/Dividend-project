import React, { useState } from 'react';
import { usePostComments, PostComment } from '@/hooks/usePostComments';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { Send, Loader2, Trash2, MessageSquare } from 'lucide-react';

interface PostCommentsProps {
  postId: string;
  isExpanded: boolean;
  onToggle: () => void;
  commentCount: number;
}

const PostComments: React.FC<PostCommentsProps> = ({ postId, isExpanded, onToggle, commentCount }) => {
  const { user } = useAuth();
  const { comments, loading, addComment } = usePostComments(postId);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    await addComment(newComment);
    setNewComment('');
    setSubmitting(false);
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="border-t border-slate-100 dark:border-slate-800/50">
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        {isExpanded ? 'Hide comments' : `View ${commentCount || comments.length} comments`}
      </button>

      {/* Comments Section */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Comments List */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {comments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} currentUserId={user?.id} />
              ))}
            </div>
          )}

          {/* Add Comment Form */}
          {user && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 text-sm"
                disabled={submitting}
              />
              <Button 
                type="submit" 
                size="sm" 
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

const CommentItem: React.FC<{ comment: PostComment; currentUserId?: string }> = ({ comment, currentUserId }) => {
  const { deleteComment } = usePostComments(comment.post_id);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await deleteComment(comment.id);
    setDeleting(false);
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <div className="flex gap-3 group animate-fade-in">
      {comment.user_avatar ? (
        <img 
          src={comment.user_avatar} 
          alt={comment.user_name} 
          className="w-8 h-8 rounded-full shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
          {comment.user_name?.charAt(0) || 'U'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-slate-900 dark:text-white">
              {comment.user_name}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatTime(comment.created_at)}
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 break-words">
            {comment.content}
          </p>
        </div>
        {currentUserId === comment.user_id && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="mt-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

export default PostComments;
