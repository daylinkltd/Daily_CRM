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

    // Verify workspace membership & role
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden: Admin or Editor access required to connect social accounts' }, { status: 403 });
    }

    const clientId = process.env.META_APP_ID || process.env.FACEBOOK_CLIENT_ID || process.env.NEXT_PUBLIC_META_APP_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Meta OAuth credentials not configured (META_APP_ID missing)' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || url.origin;
    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/marketing/social/meta/callback`;
    const state = generateOAuthState(workspaceId, user.id, 'meta');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: SOCIAL_CONFIG.meta.scopes.join(','),
      response_type: 'code',
      auth_type: 'rerequest',
    });

    const metaAuthUrl = `${SOCIAL_CONFIG.meta.oauthDialogUrl}?${params.toString()}`;

    // If request asks for JSON redirectUrl
    if (url.searchParams.get('format') === 'json') {
      return NextResponse.json({ url: metaAuthUrl });
    }

    return NextResponse.redirect(metaAuthUrl);
  } catch (err: any) {
    console.error('[MetaConnect] Error initiating OAuth:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
