import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const headersList = await headers();
    const body = await request.json();

    const {
      workspaceId,
      versionId,
      versionNumber,
      memberId,
      signatureValue,
      signatureType,
      readTimeSeconds,
      readTillBottom
    } = body;

    if (!workspaceId || !versionId || !memberId || !signatureValue) {
      return NextResponse.json({ error: 'Missing required signature parameters' }, { status: 400 });
    }

    // 1. Fetch version object to verify content_hash
    const { data: version } = await supabase
      .from('hr_policy_versions')
      .select('content_hash')
      .eq('id', versionId)
      .single();

    if (!version || !version.content_hash) {
      return NextResponse.json({ error: 'Policy version hash not found' }, { status: 400 });
    }

    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1';
    const userAgent = headersList.get('user-agent') || 'Browser';

    // 2. Insert digital sign-off record
    const { data: ack, error } = await supabase
      .from('hr_policy_acknowledgements')
      .upsert({
        workspace_id: workspaceId,
        policy_id: id,
        version_id: versionId,
        version_number: versionNumber || 1,
        workspace_member_id: memberId,
        content_hash: version.content_hash,
        status: 'ACTIVE',
        signature_type: signatureType || 'TYPED_NAME',
        signature_value: signatureValue.trim(),
        read_time_seconds: readTimeSeconds || 0,
        read_till_bottom: readTillBottom !== undefined ? readTillBottom : true,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: userAgent
      }, {
        onConflict: 'version_id,workspace_member_id'
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, acknowledgement: ack });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
