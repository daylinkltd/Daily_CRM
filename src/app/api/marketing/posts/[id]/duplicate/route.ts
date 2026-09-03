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

    const { data: originalPost } = await supabase
      .from('marketing_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!originalPost) {
      return NextResponse.json({ error: 'Source post not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', originalPost.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const creatorName = profile?.full_name || profile?.email?.split('@')[0] || 'Team Member';

    // Clone into new draft
    const clonePayload = {
      workspace_id: originalPost.workspace_id,
      title: `${originalPost.title} (Copy)`,
      content_type: originalPost.content_type,
      channels: originalPost.channels,
      default_caption: originalPost.default_caption,
      short_caption: originalPost.short_caption,
      cta: originalPost.cta,
      hashtags: originalPost.hashtags,
      keywords: originalPost.keywords,
      media_url: originalPost.media_url,
      media_urls: originalPost.media_urls,
      media_type: originalPost.media_type,
      alt_text: originalPost.alt_text,
      first_comment: originalPost.first_comment,
      trending_angle: originalPost.trending_angle,
      creative_suggestion: originalPost.creative_suggestion,
      target_audience: originalPost.target_audience,
      tone: originalPost.tone,
      platform_overrides: originalPost.platform_overrides,
      campaign_id: originalPost.campaign_id,
      status: 'draft',
      scheduled_at: null,
      published_at: null,
      creator_id: user.id,
      creator_name: creatorName,
      approver_id: null,
      approver_name: null,
      rejection_reason: null,
      failure_reason: null,
      external_post_ids: {},
    };

    const { data: duplicatedPost, error: insertError } = await supabase
      .from('marketing_posts')
      .insert(clonePayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await supabase.from('marketing_audit_logs').insert({
      workspace_id: originalPost.workspace_id,
      entity_type: 'post',
      entity_id: duplicatedPost.id,
      action: 'duplicated',
      user_id: user.id,
      user_name: creatorName,
      user_role: membership.role,
      comment: `Duplicated from post "${originalPost.title}"`,
    });

    return NextResponse.json({ post: duplicatedPost }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error duplicating post' }, { status: 500 });
  }
}
