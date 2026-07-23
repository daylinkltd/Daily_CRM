import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { crypto } from 'next/dist/compiled/@edge-runtime/primitives';

async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();
    const { approvedBy, comments } = body;

    // 1. Fetch policy header & latest version
    const { data: policy } = await supabase
      .from('hr_policies')
      .select('*, versions:hr_policy_versions(*)')
      .eq('id', id)
      .single();

    if (!policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const versions = policy.versions || [];
    const maxVerNum = versions.reduce((max: number, v: any) => Math.max(max, v.version_number || 1), 0);
    const latestVersion = versions.find((v: any) => v.version_number === maxVerNum);

    if (!latestVersion) {
      return NextResponse.json({ error: 'Policy version not found' }, { status: 404 });
    }

    // 2. Compute SHA-256 Content Hash
    const contentHash = await computeSHA256(latestVersion.content || '');

    // 3. Update version as PUBLISHED with hash & timestamps
    const nowStr = new Date().toISOString();
    await supabase.from('hr_policy_versions').update({
      content_hash: contentHash,
      published_at: nowStr,
      effective_at: latestVersion.effective_at || nowStr,
      approved_by: approvedBy || null,
      approved_at: nowStr,
      approval_comments: comments || 'Approved & Published'
    }).eq('id', latestVersion.id);

    // 4. Update Policy Header status to PUBLISHED
    await supabase.from('hr_policies').update({
      status: 'PUBLISHED',
      updated_at: nowStr
    }).eq('id', id);

    // 5. Update previous acknowledgements for older versions to SUPERSEDED
    await supabase
      .from('hr_policy_acknowledgements')
      .update({ status: 'SUPERSEDED' })
      .eq('policy_id', id)
      .neq('version_id', latestVersion.id)
      .eq('status', 'ACTIVE');

    // 6. Create Notification Logs for active workspace members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', policy.workspace_id);

    if (members && members.length > 0) {
      const notifRows = members.map(m => ({
        workspace_id: policy.workspace_id,
        policy_id: id,
        version_id: latestVersion.id,
        workspace_member_id: m.id,
        channel: 'IN_APP',
        status: 'SENT'
      }));
      await supabase.from('hr_policy_notifications').insert(notifRows);
    }

    return NextResponse.json({
      success: true,
      publishedVersion: latestVersion.version_number,
      contentHash
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
