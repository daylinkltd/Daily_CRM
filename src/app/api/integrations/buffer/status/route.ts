import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BufferService } from '@/lib/integrations/buffer-service';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: You are not a member of this workspace' }, { status: 403 });
    }

    const status = await BufferService.getStatus(workspaceId);
    return NextResponse.json(status);
  } catch (err: any) {
    console.error('[BufferStatus] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch Buffer status' }, { status: 500 });
  }
}
