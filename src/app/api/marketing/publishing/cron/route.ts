import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_CONFIG } from '@/lib/social/config';
import { publishMarketingPost } from '@/lib/social/publishing-engine';

function secretsMatch(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  try {
    const expected = process.env.AUTOMATION_CRON_SECRET;
    const supplied = request.headers.get('x-cron-secret');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isCronAuthorized = expected && secretsMatch(supplied, expected);
    const isUserAuthorized = Boolean(user);

    if (!isCronAuthorized && !isUserAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: invalid cron secret or session' }, { status: 401 });
    }

    const now = new Date();
    const staleThreshold = new Date(now.getTime() - SOCIAL_CONFIG.publishing.lockTimeoutMs).toISOString();

    // 1. Recover stale locks -> Transition to 'reconciling'
    await supabase
      .from('marketing_posts')
      .update({
        status: 'reconciling',
        locked_at: null,
        locked_by: null,
      })
      .eq('status', 'publishing')
      .lt('locked_at', staleThreshold);

    // 2. Fetch due scheduled & reconciling posts
    const { data: duePosts, error: queryErr } = await supabase
      .from('marketing_posts')
      .select('id, workspace_id, status, title')
      .in('status', ['scheduled', 'reconciling'])
      .lte('scheduled_at', now.toISOString())
      .is('locked_at', null)
      .order('scheduled_at', { ascending: true })
      .limit(SOCIAL_CONFIG.publishing.maxWorkerBatchSize);

    if (queryErr) {
      return NextResponse.json({ error: queryErr.message }, { status: 500 });
    }

    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No due social posts to publish' });
    }

    const results: any[] = [];
    for (const post of duePosts) {
      try {
        const summary = await publishMarketingPost({
          postId: post.id,
          workspaceId: post.workspace_id,
          workerId: `cron_${now.getTime()}`,
        });
        results.push({ postId: post.id, status: summary.aggregateStatus, success: summary.success });
      } catch (postErr: any) {
        console.error(`[PublishingCron] Failed to process post ${post.id}:`, postErr);
        results.push({ postId: post.id, error: postErr.message, success: false });
      }
    }

    return NextResponse.json({
      processed: duePosts.length,
      timestamp: now.toISOString(),
      results,
    });
  } catch (err: any) {
    console.error('[PublishingCron] Unexpected cron failure:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
