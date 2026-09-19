import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publishMarketingPost } from '@/lib/social/publishing-engine';

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
      .select('id, workspace_id, status, title')
      .eq('id', id)
      .maybeSingle();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Verify workspace membership & permissions
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', post.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to publish' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { targetChannelIds, isRetry } = body;

    // Execute standard publishing engine
    const result = await publishMarketingPost({
      postId: id,
      workspaceId: post.workspace_id,
      targetChannelIds,
      isRetry: Boolean(isRetry),
      triggeredByUserId: user.id,
      workerId: `user_${user.id.slice(0, 8)}`,
    });

    return NextResponse.json({
      success: result.success,
      status: result.aggregateStatus,
      platformResults: result.platformResults,
      externalPostIds: result.externalPostIds,
      message: result.message,
    });
  } catch (err: any) {
    console.error('[InstantPublish] Error publishing post:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
