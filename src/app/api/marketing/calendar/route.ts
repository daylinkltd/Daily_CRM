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
    const startStr = searchParams.get('startDate'); // e.g. 2026-09-01
    const endStr = searchParams.get('endDate');     // e.g. 2026-09-30

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

    let postsQuery = supabase
      .from('marketing_posts')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (startStr && endStr) {
      postsQuery = postsQuery
        .gte('scheduled_at', `${startStr}T00:00:00Z`)
        .lte('scheduled_at', `${endStr}T23:59:59Z`);
    }

    const { data: posts } = await postsQuery;

    let blogsQuery = supabase
      .from('marketing_blogs')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (startStr && endStr) {
      blogsQuery = blogsQuery
        .gte('scheduled_at', `${startStr}T00:00:00Z`)
        .lte('scheduled_at', `${endStr}T23:59:59Z`);
    }

    const { data: blogs } = await blogsQuery;

    return NextResponse.json({
      posts: posts || [],
      blogs: blogs || [],
      startDate: startStr,
      endDate: endStr,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching calendar events' }, { status: 500 });
  }
}
