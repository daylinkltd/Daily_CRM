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
    const { workspaceId, organizationId, organizationName } = body;

    if (!workspaceId || !organizationId) {
      return NextResponse.json({ error: 'Workspace ID and Organization ID are required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await BufferService.switchOrganization(workspaceId, organizationId, organizationName);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[BufferOrganization] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to switch Buffer organization' }, { status: 500 });
  }
}
