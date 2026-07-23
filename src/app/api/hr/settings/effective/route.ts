import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const memberId = searchParams.get('memberId');
    const settingType = searchParams.get('settingType');

    if (!workspaceId || !settingType) {
      return NextResponse.json({ error: 'workspaceId and settingType are required' }, { status: 400 });
    }

    // 1. Fetch employee profile details to get department_id and designation_id if memberId is passed
    let departmentId: string | null = null;
    let designationId: string | null = null;

    if (memberId) {
      const { data: profile } = await supabase
        .from('employee_profiles')
        .select('department_id, designation_id')
        .eq('workspace_member_id', memberId)
        .maybeSingle();

      if (profile) {
        departmentId = profile.department_id;
        designationId = profile.designation_id;
      }
    }

    // 2. Fetch all matching setting rows for this settingType in the workspace
    const { data: allSettings, error } = await supabase
      .from('hr_operational_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('setting_type', settingType);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settingsList = allSettings || [];

    // 3. Fallback resolution chain: Member Override > Designation Override > Department Override > Workspace Default
    const memberSetting = memberId ? settingsList.find(s => s.scope_type === 'MEMBER' && s.scope_id === memberId) : null;
    const designationSetting = designationId ? settingsList.find(s => s.scope_type === 'DESIGNATION' && s.scope_id === designationId) : null;
    const departmentSetting = departmentId ? settingsList.find(s => s.scope_type === 'DEPARTMENT' && s.scope_id === departmentId) : null;
    const defaultSetting = settingsList.find(s => s.scope_type === 'WORKSPACE_DEFAULT');

    const resolved = memberSetting || designationSetting || departmentSetting || defaultSetting || null;

    return NextResponse.json({
      resolvedScope: resolved ? resolved.scope_type : 'NONE',
      resolvedScopeId: resolved ? resolved.scope_id : null,
      settingsJson: resolved ? resolved.settings_json : {},
      resolutionChain: {
        member: memberSetting ? memberSetting.settings_json : null,
        designation: designationSetting ? designationSetting.settings_json : null,
        department: departmentSetting ? departmentSetting.settings_json : null,
        workspaceDefault: defaultSetting ? defaultSetting.settings_json : null
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
