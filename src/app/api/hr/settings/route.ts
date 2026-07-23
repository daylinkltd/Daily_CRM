import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const settingType = searchParams.get('settingType');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    let query = supabase
      .from('hr_operational_settings')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (settingType) {
      query = query.eq('setting_type', settingType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { workspaceId, settingType, scopeType, scopeId, settingsJson } = body;

    if (!workspaceId || !settingType || !scopeType || !settingsJson) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert operational setting for scope
    const { data, error } = await supabase
      .from('hr_operational_settings')
      .upsert({
        workspace_id: workspaceId,
        setting_type: settingType,
        scope_type: scopeType,
        scope_id: scopeType === 'WORKSPACE_DEFAULT' ? null : scopeId,
        settings_json: settingsJson,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,setting_type,scope_type,scope_id'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ setting: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
