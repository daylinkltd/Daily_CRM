import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
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

    const { data: post, error } = await supabase
      .from('marketing_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch audit logs for this post
    const { data: logs } = await supabase
      .from('marketing_audit_logs')
      .select('*')
      .eq('entity_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ post: { ...post, auditHistory: logs || [] } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching post' }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();

    // Fetch existing post to check workspace & ownership
    const { data: existingPost } = await supabase
      .from('marketing_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Verify workspace membership & role
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', existingPost.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const userName = profile?.full_name || profile?.email?.split('@')[0] || 'Team Member';

    const updates: Record<string, any> = { ...body };
    delete updates.id;
    delete updates.workspace_id;
    delete updates.created_at;

    const { data: updatedPost, error: updateError } = await supabase
      .from('marketing_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Record audit edit
    try {
      await supabase.from('marketing_audit_logs').insert({
        workspace_id: existingPost.workspace_id,
        entity_type: 'post',
        entity_id: id,
        action: updates.status === 'pending_approval' ? 'submitted' : 'edited',
        user_id: user.id,
        user_name: userName,
        user_role: membership.role,
        comment: updates.status === 'pending_approval' ? 'Resubmitted for approval' : 'Edited post content',
      });
    } catch {}

    return NextResponse.json({ post: updatedPost });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error updating post' }, { status: 500 });
  }
}

export async function DELETE(
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
      .select('workspace_id, creator_id')
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

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('marketing_posts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error deleting post' }, { status: 500 });
  }
}
