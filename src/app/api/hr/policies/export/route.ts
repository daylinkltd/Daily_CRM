import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const policyId = searchParams.get('policyId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    let query = supabase
      .from('hr_policy_acknowledgements')
      .select(`
        *,
        policy:hr_policies(title, category),
        member:workspace_members(id, user_id)
      `)
      .eq('workspace_id', workspaceId);

    if (policyId) {
      query = query.eq('policy_id', policyId);
    }

    const { data: acks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Two-step profile enrichment
    const ackList = acks || [];
    const memberUserIds = ackList.map((a: any) => a.member?.user_id).filter(Boolean);
    const profileMap: Record<string, any> = {};
    if (memberUserIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', memberUserIds);
      (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p; });
    }

    // Build CSV Content
    const headers = ['Employee Name', 'Employee Email', 'Policy Title', 'Category', 'Version', 'Status', 'SHA-256 Hash', 'Typed Signature', 'IP Address', 'Signed Timestamp'];
    const rows = ackList.map((a: any) => {
      const prof = a.member?.user_id ? profileMap[a.member.user_id] : null;
      return [
        `"${prof?.full_name || 'Unknown'}"`,
        `"${prof?.email || ''}"`,
        `"${a.policy?.title || ''}"`,
        `"${a.policy?.category || ''}"`,
        `"v${a.version_number}"`,
        `"${a.status}"`,
        `"${a.content_hash}"`,
        `"${a.signature_value}"`,
        `"${a.ip_address || ''}"`,
        `"${new Date(a.acknowledged_at).toISOString()}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hr-compliance-report-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
