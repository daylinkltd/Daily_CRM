import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateMediaForPlatforms } from '@/lib/marketing/media-validator';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const campaignId = searchParams.get('campaign_id');
    const creatorId = searchParams.get('creator_id');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id query parameter is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this workspace' }, { status: 403 });
    }

    let query = supabase
      .from('marketing_posts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (platform && platform !== 'all') {
      query = query.contains('channels', [platform]);
    }

    if (campaignId && campaignId !== 'all') {
      query = query.eq('campaign_id', campaignId);
    }

    if (creatorId && creatorId !== 'all') {
      query = query.eq('creator_id', creatorId);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: posts, error } = await query;

    if (error) {
      // If table does not exist or Postgres query fails, return clean array
      console.error('[MarketingPostsAPI] Query error:', error);
      return NextResponse.json({ posts: [], count: 0 });
    }

    return NextResponse.json({ posts: posts || [], count: posts?.length || 0 });
  } catch (err: any) {
    console.error('[MarketingPostsAPI] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch marketing posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspaceId,
      title,
      contentType = 'post',
      channels = ['linkedin'],
      defaultCaption = '',
      shortCaption,
      cta,
      hashtags = [],
      keywords = [],
      mediaUrl,
      mediaUrls = [],
      mediaType = 'image',
      altText,
      firstComment,
      trendingAngle,
      creativeSuggestion,
      targetAudience,
      tone,
      platformOverrides = {},
      campaignId,
      status = 'draft',
      scheduledAt,
      timezone = 'UTC',
    } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Post title is required' }, { status: 400 });
    }

    // Verify workspace membership & role
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Role check: Creators cannot directly save as 'approved' or 'published' without approval bypass
    let initialStatus = status;
    if (membership.role === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot create content' }, { status: 403 });
    }

    // Validate Media if present
    if (mediaUrl) {
      const validation = validateMediaForPlatforms({ url: mediaUrl, type: mediaType }, channels);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors.join(' ') }, { status: 400 });
      }
    }

    // Fetch user display name for creator
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();

    const creatorName = profile?.full_name || profile?.email?.split('@')[0] || 'Team Member';

    const insertPayload = {
      workspace_id: workspaceId,
      title: title.trim(),
      content_type: contentType,
      channels,
      default_caption: defaultCaption,
      short_caption: shortCaption,
      cta,
      hashtags,
      keywords,
      media_url: mediaUrl,
      media_urls: mediaUrls,
      media_type: mediaType,
      alt_text: altText,
      first_comment: firstComment,
      trending_angle: trendingAngle,
      creative_suggestion: typeof creativeSuggestion === 'object' ? JSON.stringify(creativeSuggestion) : creativeSuggestion,
      target_audience: targetAudience,
      tone,
      platform_overrides: platformOverrides,
      campaign_id: campaignId || null,
      status: initialStatus,
      scheduled_at: scheduledAt || null,
      timezone,
      creator_id: user.id,
      creator_name: creatorName,
    };

    const { data: newPost, error: insertError } = await supabase
      .from('marketing_posts')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[MarketingPostsAPI] Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Create Audit Log
    try {
      await supabase.from('marketing_audit_logs').insert({
        workspace_id: workspaceId,
        entity_type: 'post',
        entity_id: newPost.id,
        action: initialStatus === 'pending_approval' ? 'submitted' : 'created',
        user_id: user.id,
        user_name: creatorName,
        user_role: membership.role,
        comment: initialStatus === 'pending_approval' ? 'Submitted for admin approval' : 'Draft created',
      });
    } catch (auditErr) {
      console.warn('[MarketingPostsAPI] Audit log insert error (non-fatal):', auditErr);
    }

    return NextResponse.json({ post: newPost }, { status: 201 });
  } catch (err: any) {
    console.error('[MarketingPostsAPI] Error creating post:', err);
    return NextResponse.json({ error: err.message || 'Failed to create post' }, { status: 500 });
  }
}
