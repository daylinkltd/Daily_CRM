import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_CONFIG } from '@/lib/social/config';
import { generateOAuthState } from '@/lib/social/oauth-state';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden: Admin or Editor access required' }, { status: 403 });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'LinkedIn OAuth credentials not configured (LINKEDIN_CLIENT_ID missing)' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || url.origin;
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/marketing/social/linkedin/callback`;
    const state = generateOAuthState(workspaceId, user.id, 'linkedin');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: SOCIAL_CONFIG.linkedin.scopes.join(' '),
    });

    const linkedInAuthUrl = `${SOCIAL_CONFIG.linkedin.oauthUrl}?${params.toString()}`;

    if (url.searchParams.get('format') === 'json') {
      return NextResponse.json({ url: linkedInAuthUrl });
    }

    return NextResponse.redirect(linkedInAuthUrl);
  } catch (err: any) {
    console.error('[LinkedInConnect] Error initiating OAuth:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
