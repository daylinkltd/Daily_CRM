import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BufferService } from '@/lib/integrations/buffer-service';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspaceId, channelIds, text, mediaUrl, scheduledAt, isDraft } = body;

    if (!workspaceId || !text) {
      return NextResponse.json({ error: 'Workspace ID and post text are required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If channelIds not provided, resolve all enabled channels for this workspace
    let targetChannelIds = channelIds;
    if (!targetChannelIds || targetChannelIds.length === 0) {
      const { data: enabledChannels } = await supabase
        .from('marketing_social_channels')
        .select('provider_channel_id')
        .eq('workspace_id', workspaceId)
        .eq('provider', 'buffer')
        .eq('is_enabled', true);

      targetChannelIds = (enabledChannels || []).map((c: any) => c.provider_channel_id);
    }

    if (!targetChannelIds || targetChannelIds.length === 0) {
      return NextResponse.json({ error: 'No active Buffer channels selected or available for this workspace.' }, { status: 400 });
    }

    const result = await BufferService.createPost(workspaceId, {
      channelIds: targetChannelIds,
      text,
      mediaUrl,
      scheduledAt,
      isDraft,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[BufferPublish] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to publish via Buffer' }, { status: 500 });
  }
}
