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

    // Role check: Only admin, owner, or manager can approve
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to access this workspace' }, { status: 403 });
    }

    const isAdminOrOwner = membership.role === 'owner' || membership.role === 'admin';

    // Creators cannot approve their own content unless they are an Admin or Owner with approval authority
    if (post.creator_id === user.id && !isAdminOrOwner) {
      return NextResponse.json({ error: 'Governance Rule: Creators cannot approve their own content.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { notes, scheduleImmediately = false } = body;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    // Must be in pending_approval status
    if (post.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `Cannot approve post in "${post.status}" status. Only pending_approval posts can be approved.` },
        { status: 400 }
      );
    }

    const approverName = profile?.full_name || profile?.email?.split('@')[0] || 'Approver';

    const { data: updatedPost, error: updateError } = await supabase
      .from('marketing_posts')
      .update({
        status: 'approved',
        approver_id: user.id,
        approver_name: approverName,
        approval_notes: notes || null,
        rejection_reason: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Insert audit log
    await supabase.from('marketing_audit_logs').insert({
      workspace_id: post.workspace_id,
      entity_type: 'post',
      entity_id: id,
      action: 'approved',
      user_id: user.id,
      user_name: approverName,
      user_role: membership.role,
      comment: notes || 'Approved content for scheduling/publishing',
    });

    return NextResponse.json({ post: updatedPost });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error approving post' }, { status: 500 });
  }
}
