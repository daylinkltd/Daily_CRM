'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useWorkspace } from '@/hooks/use-workspace';

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const supabase = createClient();
  const { activeMember } = useWorkspace();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);

    const { data: rawData, error } = await supabase
      .from('task_comments')
      .select(`id, comment, created_at, member:workspace_members!task_comments_workspace_member_id_fkey ( id, user_id )`)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Failed to load comments');
    } else {
      const commentList = rawData || [];
      if (commentList.length > 0) {
        const userIds = commentList.map((c: any) => c.member?.user_id).filter(Boolean);
        const profileMap: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', userIds);
          (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p; });
        }
        setComments(commentList.map((c: any) => ({ ...c, member: c.member ? { ...c.member, profiles: profileMap[c.member.user_id] || null } : null })));
      } else {
        setComments([]);
      }
    }
    setLoading(false);
  }, [supabase, taskId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !activeMember?.id) return;
    setSubmitting(true);

    try {
      const { data: insertedComment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          workspace_member_id: activeMember.id,
          comment: newComment.trim(),
        })
        .select(`id, comment, created_at, member:workspace_members!task_comments_workspace_member_id_fkey ( id, user_id )`)
        .single();

      if (error) throw error;

      // Enrich with profile (cast to any — Supabase infers member as array type but .single() gives object)
      const inserted = insertedComment as any;
      let enrichedComment: any = inserted;
      if (inserted?.member?.user_id) {
        const { data: prof } = await supabase.from('profiles').select('user_id, full_name, avatar_url').eq('user_id', inserted.member.user_id).single();
        if (prof) enrichedComment = { ...inserted, member: { ...inserted.member, profiles: prof } };
      }
      setComments((prev) => [...prev, enrichedComment]);
      setNewComment('');
    } catch (err) {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px]">
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No comments yet. Start the conversation!
            </p>
          ) : (
            comments.map((c) => {
              const profile = Array.isArray(c.member?.profiles)
                ? c.member.profiles[0]
                : c.member?.profiles;

              return (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="size-8 border border-border mt-1">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {profile?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {profile?.full_name || 'Unknown User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm text-foreground bg-muted/30 p-2.5 rounded-md border border-border/50 whitespace-pre-wrap">
                      {c.comment}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="mt-4 flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="min-h-[60px] resize-none focus-visible:ring-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          size="icon"
          className="h-auto w-12 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
