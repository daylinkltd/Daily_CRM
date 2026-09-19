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
      console.error('[MetaCallback] OAuth error returned from Meta:', oauthError);
      return NextResponse.redirect(`${redirectSettingsUrl}&error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Missing+authorization+code+or+state`);
    }

    const statePayload = verifyOAuthState(state);
    if (!statePayload || statePayload.provider !== 'meta') {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Invalid+or+expired+state+token`);
    }

    const { workspaceId, userId } = statePayload;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Unauthorized+session+mismatch`);
    }

    const clientId = process.env.META_APP_ID || process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Server+Meta+credentials+not+configured`);
    }

    const redirectUri = `${appUrl.replace(/\/$/, '')}/api/marketing/social/meta/callback`;

    // 1. Exchange short-lived code for initial User Access Token
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch(`${SOCIAL_CONFIG.meta.tokenUrl}?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[MetaCallback] Token exchange error:', tokenData);
      return NextResponse.redirect(`${redirectSettingsUrl}&error=${encodeURIComponent(tokenData.error?.message || 'Failed to exchange token')}`);
    }

    // 2. Exchange for 60-day Long-Lived User Access Token
    const exchangeParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: tokenData.access_token,
    });

    const longLivedRes = await fetch(`${SOCIAL_CONFIG.meta.tokenUrl}?${exchangeParams.toString()}`);
    const longLivedData = await longLivedRes.json();

    const finalUserToken = longLivedData.access_token || tokenData.access_token;
    const expiresInSec = longLivedData.expires_in || tokenData.expires_in || 5184000; // ~60 days
    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    // 3. Fetch User identity and managed Accounts/Pages with Instagram Business accounts
    const meRes = await fetch(`${SOCIAL_CONFIG.meta.baseUrl}/me?fields=id,name,email&access_token=${finalUserToken}`);
    const meData = await meRes.json();

    const accountsRes = await fetch(
      `${SOCIAL_CONFIG.meta.baseUrl}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}&access_token=${finalUserToken}`
    );
    const accountsData = await accountsRes.json();

    // 4. Save/Update marketing_integrations record
    const { data: integration, error: intError } = await supabase
      .from('marketing_integrations')
      .upsert(
        {
          workspace_id: workspaceId,
          provider: 'meta',
          provider_account_id: meData.id || 'meta_account',
          provider_account_name: meData.name || 'Meta User',
          provider_account_email: meData.email || null,
          access_token_encrypted: encrypt(finalUserToken),
          token_expires_at: tokenExpiresAt,
          scopes: SOCIAL_CONFIG.meta.scopes,
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
      console.error('[MetaCallback] Error saving marketing_integrations:', intError);
      return NextResponse.redirect(`${redirectSettingsUrl}&error=Failed+to+save+integration+record`);
    }

    // 5. Store discovered Facebook Pages & Instagram Business accounts in marketing_social_channels
    const pages = accountsData.data || [];
    for (const page of pages) {
      const pageTokenEncrypted = page.access_token ? encrypt(page.access_token) : encrypt(finalUserToken);

      // A. Facebook Page channel
      await supabase.from('marketing_social_channels').upsert(
        {
          workspace_id: workspaceId,
          integration_id: integration.id,
          provider: 'meta',
          provider_channel_id: page.id,
          platform: 'facebook',
          display_name: page.name,
          username: null,
          avatar_url: `https://graph.facebook.com/${page.id}/picture?type=large`,
          is_enabled: true,
          status: 'connected',
          account_type: 'page',
          page_access_token_encrypted: pageTokenEncrypted,
          raw_metadata: { tasks: page.tasks },
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider,provider_channel_id' }
      );

      // B. Linked Instagram Professional account (if attached to page)
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account;
        await supabase.from('marketing_social_channels').upsert(
          {
            workspace_id: workspaceId,
            integration_id: integration.id,
            provider: 'meta',
            provider_channel_id: ig.id,
            platform: 'instagram',
            display_name: ig.name || ig.username || `${page.name} (Instagram)`,
            username: ig.username || null,
            avatar_url: ig.profile_picture_url || null,
            is_enabled: true,
            status: 'connected',
            account_type: 'instagram_business',
            page_access_token_encrypted: pageTokenEncrypted, // Uses page access token that administers this IG
            raw_metadata: { facebook_page_id: page.id, facebook_page_name: page.name },
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,provider,provider_channel_id' }
        );
      }
    }

    return NextResponse.redirect(`${redirectSettingsUrl}&connected=meta&count=${pages.length}`);
  } catch (err: any) {
    console.error('[MetaCallback] Unexpected error:', err);
    return NextResponse.redirect(`${redirectSettingsUrl}&error=${encodeURIComponent(err.message || 'Internal error')}`);
  }
}
