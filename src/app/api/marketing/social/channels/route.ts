import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch channels for workspace
    const { data: channels, error: chError } = await supabase
      .from('marketing_social_channels')
      .select('id, integration_id, provider, provider_channel_id, platform, display_name, username, avatar_url, external_url, is_enabled, status, account_type, connected_at, last_synced_at, token_expires_at')
      .eq('workspace_id', workspaceId)
      .order('connected_at', { ascending: true });

    if (chError) {
      return NextResponse.json({ error: chError.message }, { status: 500 });
    }

    // Fetch integrations status
    const { data: integrations } = await supabase
      .from('marketing_integrations')
      .select('id, provider, provider_account_name, provider_account_email, status, last_error, token_expires_at')
      .eq('workspace_id', workspaceId);

    return NextResponse.json({
      channels: channels || [],
      integrations: integrations || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { channelId, isEnabled, workspaceId } = body;

    if (!channelId || !workspaceId) {
      return NextResponse.json({ error: 'Missing channelId or workspaceId' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('marketing_social_channels')
      .update({ is_enabled: isEnabled, last_synced_at: new Date().toISOString() })
      .eq('id', channelId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, channel: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channel_id');
    const provider = url.searchParams.get('provider');
    const workspaceId = url.searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (channelId) {
      await supabase
        .from('marketing_social_channels')
        .delete()
        .eq('id', channelId)
        .eq('workspace_id', workspaceId);
    } else if (provider) {
      await supabase
        .from('marketing_integrations')
        .delete()
        .eq('provider', provider)
        .eq('workspace_id', workspaceId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
