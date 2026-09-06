import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/whatsapp/encryption';

export interface BufferOrganization {
  id: string;
  name: string;
  role?: string;
  channelsCount?: number;
}

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
  serviceId?: string;
  avatar?: string;
  isConnected?: boolean;
}

export interface BufferIntegrationStatus {
  isConfigured: boolean;
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  accountId?: string;
  accountName?: string;
  accountEmail?: string;
  currentOrganizationId?: string;
  currentOrganizationName?: string;
  organizations: BufferOrganization[];
  channels: Array<{
    id: string;
    providerChannelId: string;
    platform: string;
    displayName: string;
    username?: string;
    avatarUrl?: string;
    isEnabled: boolean;
    status: string;
  }>;
  connectedAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
  isDevSimulation?: boolean;
}

export class BufferService {
  private static BUFFER_GRAPHQL_URL = 'https://api.buffer.com';
  private static BUFFER_AUTH_URL = 'https://login.buffer.com/oauth2/authorize';
  private static BUFFER_TOKEN_URL = 'https://login.buffer.com/oauth2/token';

  /**
   * Helper: Generate PKCE code_verifier and code_challenge (S256)
   */
  private static generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const hash = crypto.createHash('sha256').update(verifier).digest();
    const challenge = hash.toString('base64url');
    return { verifier, challenge };
  }

  /**
   * 1. Initiate OAuth 2.0 PKCE flow
   */
  static async getAuthorizationUrl(workspaceId: string, userId: string): Promise<{ url: string; state: string; isDevSimulation?: boolean }> {
    const clientId = process.env.BUFFER_CLIENT_ID;
    const redirectUri = process.env.BUFFER_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/buffer/callback`;

    const state = crypto.randomBytes(32).toString('hex');
    const { verifier, challenge } = this.generatePKCE();

    const supabase = await createClient();

    // Store state in database (expires in 15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase.from('marketing_oauth_states').insert({
      state,
      code_verifier: verifier,
      workspace_id: workspaceId,
      user_id: userId,
      provider: 'buffer',
      expires_at: expiresAt,
    });

    if (!clientId) {
      // In development when BUFFER_CLIENT_ID is not configured in .env, provide simulation callback URL
      const devSimulationUrl = `/api/integrations/buffer/callback?code=sim_code_${Date.now()}&state=${state}&sim=true`;
      return { url: devSimulationUrl, state, isDevSimulation: true };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return { url: `${this.BUFFER_AUTH_URL}?${params.toString()}`, state };
  }

  /**
   * 2. Handle OAuth Callback, exchange token, and initialize integration
   */
  static async handleOAuthCallback(code: string, state: string, isSimulation = false): Promise<{ success: boolean; workspaceId: string; error?: string }> {
    let supabase: any;
    try {
      supabase = createAdminClient();
    } catch {
      supabase = await createClient();
    }

    // Verify state
    const { data: stateRecord, error: stateError } = await supabase
      .from('marketing_oauth_states')
      .select('*')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (stateError || !stateRecord) {
      throw new Error('Invalid or expired OAuth state parameter. Please try connecting again.');
    }

    const { workspace_id: workspaceId, user_id: userId, code_verifier: codeVerifier } = stateRecord;

    // Remove consumed state
    await supabase.from('marketing_oauth_states').delete().eq('state', state);

    let accessToken = '';
    let refreshToken = '';
    let expiresIn = 3600 * 24 * 30; // 30 days
    let accountData: any = null;

    if (isSimulation || !process.env.BUFFER_CLIENT_ID) {
      // Development Simulation data
      accessToken = `sim_buf_tok_${Date.now()}`;
      refreshToken = `sim_buf_ref_${Date.now()}`;
      accountData = {
        id: `buf_acc_${workspaceId.substring(0, 8)}`,
        name: 'Daily CRM Brand Hub',
        email: 'marketing@dailybuz.com',
        organizations: [
          {
            id: `org_primary_${workspaceId.substring(0, 6)}`,
            name: 'Daily CRM Main Org',
            role: 'admin',
            channels: [
              { id: 'ch_ig_101', name: '@dailycrm_official', service: 'instagram', isConnected: true },
              { id: 'ch_li_102', name: 'Daily CRM Technologies', service: 'linkedin', isConnected: true },
              { id: 'ch_fb_103', name: 'Daily CRM Official Page', service: 'facebook', isConnected: true },
              { id: 'ch_x_104', name: '@DailyCRMApp', service: 'x', isConnected: true },
            ],
          },
          {
            id: `org_secondary_${workspaceId.substring(0, 6)}`,
            name: 'Daily CRM Retail Ventures',
            role: 'editor',
            channels: [
              { id: 'ch_ig_201', name: '@dailycrm_retail', service: 'instagram', isConnected: true },
              { id: 'ch_yt_202', name: 'Daily CRM Retail TV', service: 'youtube', isConnected: true },
            ],
          },
        ],
      };
    } else {
      // Real Buffer OAuth token exchange
      const redirectUri = process.env.BUFFER_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/buffer/callback`;
      const tokenRes = await fetch(this.BUFFER_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.BUFFER_CLIENT_ID!,
          client_secret: process.env.BUFFER_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Buffer token exchange failed (${tokenRes.status}): ${errText}`);
      }

      const tokenJson = await tokenRes.json();
      accessToken = tokenJson.access_token;
      refreshToken = tokenJson.refresh_token || '';
      expiresIn = tokenJson.expires_in || 3600 * 24 * 30;

      // Query real Buffer Account & Organizations via GraphQL
      accountData = await this.queryAccountData(accessToken);
    }

    const primaryOrg = accountData.organizations?.[0] || { id: 'org_default', name: 'Default Organization' };
    const channels: BufferChannel[] = primaryOrg.channels || [];

    // Encrypt tokens at rest
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Upsert integration
    const { data: integration, error: upsertErr } = await supabase
      .from('marketing_integrations')
      .upsert(
        {
          workspace_id: workspaceId,
          provider: 'buffer',
          provider_account_id: accountData.id,
          provider_account_name: accountData.name,
          provider_account_email: accountData.email,
          provider_organization_id: primaryOrg.id,
          provider_organization_name: primaryOrg.name,
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          token_expires_at: tokenExpiresAt,
          status: 'connected',
          last_error: null,
          connected_by_user_id: userId,
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider' }
      )
      .select('id')
      .single();

    if (upsertErr || !integration) {
      throw new Error(`Failed to store integration: ${upsertErr?.message}`);
    }

    // Ingest channels for primary organization
    for (const ch of channels) {
      await supabase.from('marketing_social_channels').upsert(
        {
          workspace_id: workspaceId,
          integration_id: integration.id,
          provider: 'buffer',
          provider_channel_id: ch.id,
          provider_organization_id: primaryOrg.id,
          platform: ch.service.toLowerCase(),
          display_name: ch.name,
          username: ch.name.startsWith('@') ? ch.name : undefined,
          avatar_url: ch.avatar,
          is_enabled: true,
          status: ch.isConnected ? 'connected' : 'disconnected',
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider,provider_channel_id' }
      );
    }

    return { success: true, workspaceId };
  }

  /**
   * 3. Query Account Data via Buffer GraphQL
   */
  private static async queryAccountData(accessToken: string): Promise<any> {
    const query = `
      query GetBufferAccount {
        account {
          id
          name
          email
          organizations {
            id
            name
            role
            channels {
              id
              name
              service
              serviceId
              avatar
              isConnected
            }
          }
        }
      }
    `;

    const res = await fetch(this.BUFFER_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      throw new Error(`Buffer GraphQL request failed with HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Buffer GraphQL error: ${json.errors[0].message}`);
    }

    return json.data?.account || {};
  }

  /**
   * 4. Retrieve Connection Status for a Workspace
   */
  static async getStatus(workspaceId: string): Promise<BufferIntegrationStatus> {
    const supabase = await createClient();

    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer')
      .maybeSingle();

    if (!integration || integration.status === 'disconnected') {
      return {
        isConfigured: Boolean(process.env.BUFFER_CLIENT_ID),
        isConnected: false,
        status: 'disconnected',
        organizations: [],
        channels: [],
      };
    }

    const { data: channels = [] } = await supabase
      .from('marketing_social_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer');

    const isSimulated = integration.provider_account_id?.startsWith('buf_acc_');

    const mappedChannels = (channels || []).map((ch: any) => ({
      id: ch.id,
      providerChannelId: ch.provider_channel_id,
      platform: ch.platform,
      displayName: ch.display_name,
      username: ch.username,
      avatarUrl: ch.avatar_url,
      isEnabled: ch.is_enabled,
      status: ch.status,
    }));

    return {
      isConfigured: Boolean(process.env.BUFFER_CLIENT_ID) || isSimulated,
      isConnected: integration.status === 'connected',
      status: integration.status as any,
      accountId: integration.provider_account_id,
      accountName: integration.provider_account_name,
      accountEmail: integration.provider_account_email,
      currentOrganizationId: integration.provider_organization_id,
      currentOrganizationName: integration.provider_organization_name,
      organizations: [
        {
          id: integration.provider_organization_id || 'org_main',
          name: integration.provider_organization_name || 'Main Organization',
        },
      ],
      channels: mappedChannels,
      connectedAt: integration.connected_at,
      lastSyncedAt: integration.last_synced_at,
      lastError: integration.last_error,
      isDevSimulation: isSimulated,
    };
  }

  /**
   * 5. Sync Live Channels for Active Organization
   */
  static async syncChannels(workspaceId: string): Promise<{ success: boolean; count: number }> {
    const supabase = await createClient();

    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer')
      .eq('status', 'connected')
      .maybeSingle();

    if (!integration) {
      throw new Error('No active Buffer integration found for this workspace.');
    }

    let token = '';
    try {
      token = decrypt(integration.access_token_encrypted);
    } catch (e) {
      throw new Error('Failed to decrypt Buffer credentials. Please reconnect your account.');
    }

    if (token.startsWith('sim_buf_tok_')) {
      // In simulation mode, touch timestamp and return channel count
      await supabase
        .from('marketing_integrations')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', integration.id);

      const { count } = await supabase
        .from('marketing_social_channels')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId);

      return { success: true, count: count || 0 };
    }

    // Fetch real channels via GraphQL
    const accountData = await this.queryAccountData(token);
    const org = accountData.organizations?.find((o: any) => o.id === integration.provider_organization_id) || accountData.organizations?.[0];
    const channels = org?.channels || [];

    for (const ch of channels) {
      await supabase.from('marketing_social_channels').upsert(
        {
          workspace_id: workspaceId,
          integration_id: integration.id,
          provider: 'buffer',
          provider_channel_id: ch.id,
          provider_organization_id: org?.id,
          platform: ch.service.toLowerCase(),
          display_name: ch.name,
          username: ch.name.startsWith('@') ? ch.name : undefined,
          avatar_url: ch.avatar,
          is_enabled: true,
          status: ch.isConnected ? 'connected' : 'disconnected',
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,provider,provider_channel_id' }
      );
    }

    await supabase
      .from('marketing_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', integration.id);

    return { success: true, count: channels.length };
  }

  /**
   * 6. Switch Active Buffer Organization
   */
  static async switchOrganization(workspaceId: string, orgId: string, orgName?: string): Promise<{ success: boolean }> {
    const supabase = await createClient();

    await supabase
      .from('marketing_integrations')
      .update({
        provider_organization_id: orgId,
        provider_organization_name: orgName,
        last_synced_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer');

    await this.syncChannels(workspaceId);
    return { success: true };
  }

  /**
   * 7. Publish or Schedule a Post via Buffer GraphQL
   */
  static async createPost(workspaceId: string, postPayload: {
    channelIds: string[];
    text: string;
    mediaUrl?: string;
    scheduledAt?: string;
    isDraft?: boolean;
  }): Promise<{ success: boolean; bufferPostIds?: Record<string, string>; scheduledAt?: string }> {
    const supabase = await createClient();

    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer')
      .eq('status', 'connected')
      .maybeSingle();

    if (!integration) {
      throw new Error('Buffer is not connected for this workspace. Please connect Buffer in Settings -> Social Accounts.');
    }

    // Verify all requested channels belong to this tenant
    const { data: verifiedChannels } = await supabase
      .from('marketing_social_channels')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('provider_channel_id', postPayload.channelIds);

    if (!verifiedChannels || verifiedChannels.length === 0) {
      throw new Error('No verified channels found for this workspace. Please check your channel connections.');
    }

    let token = '';
    try {
      token = decrypt(integration.access_token_encrypted);
    } catch (e) {
      throw new Error('Invalid Buffer credentials. Please reconnect your account.');
    }

    if (token.startsWith('sim_buf_tok_')) {
      // Simulation response
      const bufferPostIds = verifiedChannels.reduce((acc, ch) => {
        acc[ch.platform] = `buf_post_${ch.provider_channel_id}_${Date.now()}`;
        return acc;
      }, {} as Record<string, string>);

      return {
        success: true,
        bufferPostIds,
        scheduledAt: postPayload.scheduledAt || new Date().toISOString(),
      };
    }

    // Real GraphQL Mutation to Buffer
    const mutation = `
      mutation CreateBufferPost($input: CreatePostInput!) {
        createPost(input: $input) {
          post {
            id
            status
            scheduledAt
          }
        }
      }
    `;

    const bufferPostIds: Record<string, string> = {};

    for (const ch of verifiedChannels) {
      const variables = {
        input: {
          channelId: ch.provider_channel_id,
          text: postPayload.text,
          media: postPayload.mediaUrl ? [postPayload.mediaUrl] : undefined,
          scheduledAt: postPayload.scheduledAt,
          mode: postPayload.scheduledAt ? 'customScheduled' : 'now',
        },
      };

      const res = await fetch(this.BUFFER_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });

      if (res.ok) {
        const json = await res.json();
        const postId = json.data?.createPost?.post?.id;
        if (postId) {
          bufferPostIds[ch.platform] = postId;
        }
      }
    }

    return {
      success: Object.keys(bufferPostIds).length > 0,
      bufferPostIds,
      scheduledAt: postPayload.scheduledAt,
    };
  }

  /**
   * 8. Disconnect Buffer Integration
   */
  static async disconnect(workspaceId: string): Promise<{ success: boolean }> {
    const supabase = await createClient();

    // Mark integration as disconnected & clear encrypted tokens
    await supabase
      .from('marketing_integrations')
      .update({
        status: 'disconnected',
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer');

    // Mark social channels as disconnected
    await supabase
      .from('marketing_social_channels')
      .update({
        status: 'disconnected',
        is_enabled: false,
        last_synced_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'buffer');

    return { success: true };
  }
}
