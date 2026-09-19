import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SOCIAL_CONFIG } from '@/lib/social/config';
import { verifyOAuthState } from '@/lib/social/oauth-state';
import { encrypt } from '@/lib/whatsapp/encryption';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const redirectSettingsUrl = `${appUrl.replace(/\/$/, '')}/marketing/settings?tab=channels`;

  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');

    if (oauthError) {
      console.error('[LinkedInCallback] OAuth error returned from LinkedIn:', oauthError);
      return NextResponse.redirect(`${redirectSettingsUrl}&error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Missing+authorization+code+or+state`);
    }

    const statePayload = verifyOAuthState(state);
    if (!statePayload || statePayload.provider !== 'linkedin') {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Invalid+or+expired+state+token`);
    }

    const { workspaceId, userId } = statePayload;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Unauthorized+session+mismatch`);
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Server+LinkedIn+credentials+not+configured`);
    }

    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/marketing/social/linkedin/callback`;

    // 1. Exchange code for Access Token (+ Refresh Token if available)
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(SOCIAL_CONFIG.linkedin.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[LinkedInCallback] Token exchange error:', tokenData);
      return NextResponse.redirect(
        `${redirectSettingsUrl}&error=${encodeURIComponent(tokenData.error_description || tokenData.error || 'Token exchange failed')}`
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresInSec = tokenData.expires_in || 5184000; // ~60 days default
    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    // 2. Fetch User Profile Info via OpenID userinfo
    const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userinfo = await userinfoRes.json();

    const personId = userinfo.sub;
    const personUrn = `urn:li:person:${personId}`;
    const displayName = userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim() || 'LinkedIn User';

    // 3. Upsert marketing_integrations
    const { data: integration, error: intError } = await supabase
      .from('marketing_integrations')
      .upsert(
        {
          workspace_id: workspaceId,
          provider: 'linkedin',
          provider_account_id: personUrn,
          provider_account_name: displayName,
          provider_account_email: userinfo.email || null,
          access_token_encrypted: encrypt(accessToken),
          refresh_token_encrypted: refreshToken ? encrypt(refreshToken) : null,
          token_expires_at: tokenExpiresAt,
          scopes: SOCIAL_CONFIG.linkedin.scopes,
          status: 'connected',
          last_error: null,
          connected_by_user_id: user.id,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider' }
      )
      .select('id')
      .single();

    if (intError || !integration) {
      console.error('[LinkedInCallback] Error saving integration:', intError);
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Failed+to+save+integration+record`);
    }

    // 4. Create Personal Profile channel
    await supabase.from('marketing_social_channels').upsert(
      {
        workspace_id: workspaceId,
        integration_id: integration.id,
        provider: 'linkedin',
        provider_channel_id: personUrn,
        platform: 'linkedin',
        display_name: `${displayName} (Profile)`,
        username: userinfo.email || null,
        avatar_url: userinfo.picture || null,
        is_enabled: true,
        status: 'connected',
        account_type: 'profile',
        page_access_token_encrypted: encrypt(accessToken),
        token_expires_at: tokenExpiresAt,
        raw_metadata: { person_id: personId, sub: userinfo.sub },
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,provider,provider_channel_id' }
    );

    // 5. Attempt to query Administered Organizations (if w_organization_social / r_organization_social is granted)
    try {
      const aclsRes = await fetch(
        `${SOCIAL_CONFIG.linkedin.apiBaseUrl}/organizationalEntityAcls?q=roleAssignee&state=APPROVED`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Linkedin-Version': SOCIAL_CONFIG.linkedin.apiVersion,
            'X-Restli-Protocol-Version': SOCIAL_CONFIG.linkedin.restliProtocolVersion,
          },
        }
      );

      if (aclsRes.ok) {
        const aclsData = await aclsRes.json();
        const elements = aclsData.elements || [];
        for (const el of elements) {
          const orgUrn = el.organizationalTarget; // e.g. "urn:li:organization:123456"
          if (!orgUrn) continue;

          await supabase.from('marketing_social_channels').upsert(
            {
              workspace_id: workspaceId,
              integration_id: integration.id,
              provider: 'linkedin',
              provider_channel_id: orgUrn,
              platform: 'linkedin',
              display_name: `LinkedIn Company (${orgUrn.replace('urn:li:organization:', '')})`,
              username: null,
              avatar_url: null,
              is_enabled: true,
              status: 'connected',
              account_type: 'organization',
              page_access_token_encrypted: encrypt(accessToken),
              token_expires_at: tokenExpiresAt,
              raw_metadata: { role: el.role, organizationalTarget: orgUrn },
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'workspace_id,provider,provider_channel_id' }
          );
        }
      } else {
        console.log('[LinkedInCallback] Organization ACLs query not accessible (requires Community Management API product approval)');
      }
    } catch (aclErr) {
      console.warn('[LinkedInCallback] Could not fetch organization ACLs:', aclErr);
    }

    return NextResponse.redirect(`${redirectSettingsUrl}&connected=linkedin`);
  } catch (err: any) {
    console.error('[LinkedInCallback] Unexpected error:', err);
    return NextResponse.redirect(`${redirectSettingsUrl}&error=${encodeURIComponent(err.message || 'Internal error')}`);
  }
}
