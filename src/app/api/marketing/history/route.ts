import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const entityType = searchParams.get('entity_type'); // 'post' | 'blog' | 'campaign'
    const entityId = searchParams.get('entity_id');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
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

    let query = supabase
      .from('marketing_audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    if (action) query = query.eq('action', action);

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json({ logs: [] });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching audit history' }, { status: 500 });
  }
}
