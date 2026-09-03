import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_TEMPLATES, BLOG_TEMPLATES } from '@/lib/marketing/template-library';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const category = searchParams.get('category'); // 'social' | 'blog'

    let customTemplates: any[] = [];
    if (workspaceId) {
      const { data } = await supabase
        .from('marketing_templates')
        .select('*')
        .eq('workspace_id', workspaceId);
      customTemplates = data || [];
    }

    const builtIns = [...SOCIAL_TEMPLATES, ...BLOG_TEMPLATES];
    let all = [...builtIns, ...customTemplates];

    if (category) {
      all = all.filter((t) => t.category === category);
    }

    return NextResponse.json({ templates: all });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching templates' }, { status: 500 });
  }
}
