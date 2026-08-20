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
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Verify user is active workspace member with permissions
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this workspace' }, { status: 403 });
    }

    const authData = await BufferService.getAuthorizationUrl(workspaceId, user.id);

    return NextResponse.json({
      url: authData.url,
      state: authData.state,
      isDevSimulation: authData.isDevSimulation,
    });
  } catch (err: any) {
    console.error('[BufferAuthorize] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to initiate Buffer OAuth flow' }, { status: 500 });
  }
}
