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

    if (!workspaceId || !versionId || !signatureValue) {
      return NextResponse.json({ error: 'Missing required signature parameters' }, { status: 400 });
    }

    // A policy acknowledgement is a compliance signature: it is stamped
    // with a SHA-256 of the content and rendered on the audit trail as
    // proof that a named person read and accepted it. The signing member
    // is therefore derived from the SESSION, never from the request body —
    // trusting `memberId` let anyone file a colleague's signature, with an
    // arbitrary typed name, against a policy they never opened.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: signingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!signingMember) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    // The body's memberId is accepted only when it agrees with the session;
    // signing on someone else's behalf is never valid.
    if (memberId && memberId !== signingMember.id) {
      return NextResponse.json(
        { error: 'A policy can only be signed by the person signing in.' },
        { status: 403 }
      );
    }
    const signerId = signingMember.id;

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
        workspace_member_id: signerId,
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
