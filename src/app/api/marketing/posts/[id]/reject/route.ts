import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: post } = await supabase
      .from('marketing_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (post.creator_id === user.id) {
      return NextResponse.json(
        { error: 'Governance Rule: Creators cannot reject or request changes on their own content.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason, actionType = 'reject' } = body; // 'reject' or 'request_changes'

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'A feedback reason or revision note is mandatory when rejecting or sending back content.' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const reviewerName = profile?.full_name || profile?.email?.split('@')[0] || 'Reviewer';
    const targetStatus = actionType === 'request_changes' ? 'changes_requested' : 'rejected';

    const { data: updatedPost, error: updateError } = await supabase
      .from('marketing_posts')
      .update({
        status: targetStatus,
        rejection_reason: reason.trim(),
        approver_id: user.id,
        approver_name: reviewerName,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from('marketing_audit_logs').insert({
      workspace_id: post.workspace_id,
      entity_type: 'post',
      entity_id: id,
      action: actionType === 'request_changes' ? 'changes_requested' : 'rejected',
      user_id: user.id,
      user_name: reviewerName,
      user_role: membership.role,
      comment: reason.trim(),
    });

    return NextResponse.json({ post: updatedPost });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error processing rejection' }, { status: 500 });
  }
}
