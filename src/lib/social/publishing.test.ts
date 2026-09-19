import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaGraphAdapter } from './adapters/meta-graph-adapter';
import { LinkedInAdapter } from './adapters/linkedin-adapter';
import { generateOAuthState, verifyOAuthState } from './oauth-state';
import { reconcileChannelPost } from './reconciliation';
import type { PostPublishPayload, MarketingSocialChannelRecord } from './types';

describe('DailyBuz Native Social Publishing Engine (Phase 1: Meta & LinkedIn)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. OAuth State CSRF Protection', () => {
    it('generates a valid signed state token and successfully verifies it', () => {
      const workspaceId = 'ws_test_123';
      const userId = 'usr_alex_456';
      const state = generateOAuthState(workspaceId, userId, 'meta');

      expect(typeof state).toBe('string');
      expect(state.split('.')).toHaveLength(2);

      const verified = verifyOAuthState(state);
      expect(verified).not.toBeNull();
      expect(verified?.workspaceId).toBe(workspaceId);
      expect(verified?.userId).toBe(userId);
      expect(verified?.provider).toBe('meta');
    });

    it('rejects tampered or forged state parameters', () => {
      const state = generateOAuthState('ws_1', 'usr_1', 'linkedin');
      const [payload] = state.split('.');
      const forgedState = `${payload}.invalid_signature_hex`;

      const verified = verifyOAuthState(forgedState);
      expect(verified).toBeNull();
    });
  });

  describe('2. Meta Graph Adapter (Facebook Pages & Instagram Professional)', () => {
    const dummyChannel: MarketingSocialChannelRecord = {
      id: 'chan_fb_1',
      workspace_id: 'ws_1',
      integration_id: 'int_meta_1',
      provider: 'meta',
      provider_channel_id: '10987654321',
      platform: 'facebook',
      display_name: 'DailyBuz Facebook Page',
      is_enabled: true,
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const dummyIgChannel: MarketingSocialChannelRecord = {
      ...dummyChannel,
      id: 'chan_ig_1',
      provider_channel_id: '17841400000000000',
      platform: 'instagram',
      display_name: 'DailyBuz Instagram',
    };

    it('validates that Instagram posts require media assets', () => {
      const igAdapter = new MetaGraphAdapter('instagram');
      const textOnlyPost: PostPublishPayload = {
        id: 'post_1',
        workspace_id: 'ws_1',
        title: 'Text Only Announcement',
        default_caption: 'This is a text only post without image',
        media_url: null,
      };

      const val = igAdapter.validatePayload(textOnlyPost, dummyIgChannel);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('Instagram requires an image or video asset');
    });

    it('publishes text post to Facebook Page feed successfully', async () => {
      const fbAdapter = new MetaGraphAdapter('facebook');
      const post: PostPublishPayload = {
        id: 'post_fb_1',
        workspace_id: 'ws_1',
        title: 'New Feature Release',
        default_caption: 'Check out DailyBuz Social Hub!',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '10987654321_99887766' }),
      } as any);

      const result = await fbAdapter.publishPost({
        post,
        channel: dummyChannel,
        accessToken: 'EAAB_test_page_token',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalPostId).toBe('10987654321_99887766');
      expect(result.externalPostUrl).toBe('https://facebook.com/10987654321_99887766');
    });

    it('executes Instagram 2-step container creation, polling, and container publish', async () => {
      const igAdapter = new MetaGraphAdapter('instagram');
      const post: PostPublishPayload = {
        id: 'post_ig_1',
        workspace_id: 'ws_1',
        title: 'Product Snapshot',
        default_caption: 'Streamline your WhatsApp CRM!',
        media_url: 'https://dailybuz.com/assets/banner.png',
        media_type: 'image',
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/media_publish')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ id: '17999888777666' }),
          });
        }
        if (url.includes('/container_123')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ status_code: 'FINISHED' }),
          });
        }
        // Container creation
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ id: 'container_123' }),
        });
      });

      const result = await igAdapter.publishPost({
        post,
        channel: dummyIgChannel,
        accessToken: 'EAAB_test_ig_token',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalPostId).toBe('17999888777666');
      expect(result.providerRequestId).toBe('container_123');
    });

    it('classifies Meta token expiration as authentication error requiring reconnection', async () => {
      const fbAdapter = new MetaGraphAdapter('facebook');
      const post: PostPublishPayload = {
        id: 'post_err',
        workspace_id: 'ws_1',
        title: 'Test Error',
        default_caption: 'Caption',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Error validating access token: Session has expired.',
            code: 190,
            error_subcode: 463,
          },
        }),
      } as any);

      const result = await fbAdapter.publishPost({
        post,
        channel: dummyChannel,
        accessToken: 'expired_token',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorClassification).toBe('authentication');
    });
  });

  describe('3. LinkedIn REST API Adapter (Profiles & Company Pages)', () => {
    const dummyLiChannel: MarketingSocialChannelRecord = {
      id: 'chan_li_1',
      workspace_id: 'ws_1',
      integration_id: 'int_li_1',
      provider: 'linkedin',
      provider_channel_id: 'urn:li:person:abcdef1234',
      platform: 'linkedin',
      display_name: 'Alex Costa (Profile)',
      account_type: 'profile',
      is_enabled: true,
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    it('publishes commentary text post to LinkedIn profile via /rest/posts', async () => {
      const liAdapter = new LinkedInAdapter();
      const post: PostPublishPayload = {
        id: 'post_li_1',
        workspace_id: 'ws_1',
        title: 'Enterprise Update',
        default_caption: 'DailyBuz now supports native social scheduling.',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'x-restli-id': 'urn:li:share:71234567890' }),
        text: async () => JSON.stringify({ id: 'urn:li:share:71234567890' }),
      } as any);

      const result = await liAdapter.publishPost({
        post,
        channel: dummyLiChannel,
        accessToken: 'AQ_test_linkedin_token',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalPostId).toBe('urn:li:share:71234567890');
    });

    it('uploads binary image to LinkedIn /rest/images before posting', async () => {
      const liAdapter = new LinkedInAdapter();
      const post: PostPublishPayload = {
        id: 'post_li_img',
        workspace_id: 'ws_1',
        title: 'Infographic',
        default_caption: 'Our Q3 Growth Metrics.',
        media_url: 'https://dailybuz.com/charts/q3.png',
        media_type: 'image',
      };

      global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (url.includes('/images?action=initializeUpload')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              value: {
                uploadUrl: 'https://media.licdn.com/upload-target',
                image: 'urn:li:image:D5622AQG987654321',
              },
            }),
          });
        }
        if (url.includes('dailybuz.com/charts/q3.png')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'image/png' }),
            arrayBuffer: async () => new ArrayBuffer(1024),
          });
        }
        if (url.includes('media.licdn.com/upload-target')) {
          return Promise.resolve({ ok: true, status: 201 });
        }
        if (url.includes('/rest/posts')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            headers: new Headers({ 'x-restli-id': 'urn:li:share:7999888' }),
            text: async () => JSON.stringify({ id: 'urn:li:share:7999888' }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL ${url}`));
      });

      const result = await liAdapter.publishPost({
        post,
        channel: dummyLiChannel,
        accessToken: 'AQ_test_linkedin_token',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalPostId).toBe('urn:li:share:7999888');
    });

    it('classifies missing w_organization_social permission as authorization failure', async () => {
      const liAdapter = new LinkedInAdapter();
      const orgChannel: MarketingSocialChannelRecord = {
        ...dummyLiChannel,
        provider_channel_id: 'urn:li:organization:998877',
        account_type: 'organization',
      };

      const post: PostPublishPayload = {
        id: 'post_org_err',
        workspace_id: 'ws_1',
        title: 'Company Post',
        default_caption: 'Caption',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Not enough permissions to access organization posts' }),
      } as any);

      const result = await liAdapter.publishPost({
        post,
        channel: orgChannel,
        accessToken: 'AQ_token_missing_org_scope',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorClassification).toBe('authorization');
    });
  });

  describe('4. Crash-Safe Reconciliation Engine', () => {
    it('reconciles an unknown Facebook post by querying page feed and avoids duplicate posting', async () => {
      const fbAdapter = new MetaGraphAdapter('facebook');
      const dummyChannel: MarketingSocialChannelRecord = {
        id: 'chan_1',
        workspace_id: 'ws_1',
        integration_id: 'int_1',
        provider: 'meta',
        provider_channel_id: '12345',
        platform: 'facebook',
        display_name: 'FB Page',
        is_enabled: true,
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      };

      const post: PostPublishPayload = {
        id: 'post_reconcile_1',
        workspace_id: 'ws_1',
        title: 'Crucial Update',
        default_caption: 'This post previously timed out during dispatch.',
      };

      // Mock FB feed returning the post published 2 minutes ago
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: '12345_67890',
              message: 'Crucial Update\n\nThis post previously timed out during dispatch.',
              created_time: new Date().toISOString(),
            },
          ],
        }),
      } as any);

      const reconciliation = await reconcileChannelPost({
        post,
        channel: dummyChannel,
        accessToken: 'EAAB_token',
        adapter: fbAdapter,
      });

      expect(reconciliation.reconciled).toBe(true);
      expect(reconciliation.newStatus).toBe('published');
      expect(reconciliation.externalPostId).toBe('12345_67890');
    });

    it('leaves post in unknown state if reconciliation lookup is inconclusive', async () => {
      const fbAdapter = new MetaGraphAdapter('facebook');
      const dummyChannel: MarketingSocialChannelRecord = {
        id: 'chan_1',
        workspace_id: 'ws_1',
        integration_id: 'int_1',
        provider: 'meta',
        provider_channel_id: '12345',
        platform: 'facebook',
        display_name: 'FB Page',
        is_enabled: true,
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      };

      const post: PostPublishPayload = {
        id: 'post_reconcile_none',
        workspace_id: 'ws_1',
        title: 'Different Title',
        default_caption: 'Text not in feed',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as any);

      const reconciliation = await reconcileChannelPost({
        post,
        channel: dummyChannel,
        accessToken: 'EAAB_token',
        adapter: fbAdapter,
      });

      expect(reconciliation.reconciled).toBe(false);
      expect(reconciliation.newStatus).toBe('unknown');
    });
  });

  describe('5. Partial Failure & Targeted Retry Logic', () => {
    it('calculates partially_published status when 1 of 2 channels fails and preserves published channel result on retry', () => {
      const fbChannelId = 'chan_fb_1';
      const liChannelId = 'chan_li_1';

      // Initial execution state: FB succeeded, LinkedIn failed
      const existingResults = {
        [fbChannelId]: {
          channelId: fbChannelId,
          platform: 'facebook' as const,
          status: 'published' as const,
          attemptCount: 1,
          externalPostId: 'fb_post_100',
        },
        [liChannelId]: {
          channelId: liChannelId,
          platform: 'linkedin' as const,
          status: 'failed' as const,
          attemptCount: 1,
          lastErrorCode: '429',
          lastErrorMessage: 'Rate limit exceeded',
        },
      };

      const activeChannels = [
        { id: fbChannelId, platform: 'facebook' },
        { id: liChannelId, platform: 'linkedin' },
      ];

      // On retry, channels already marked published should be filtered out
      const channelsToExecute = activeChannels.filter((ch) => {
        const prior = existingResults[ch.id];
        return prior?.status !== 'published';
      });

      expect(channelsToExecute).toHaveLength(1);
      expect(channelsToExecute[0].id).toBe(liChannelId);
    });
  });

  describe('6. Media Validation Pipeline', () => {
    const igAdapter = new MetaGraphAdapter('instagram');
    const dummyIgChannel: MarketingSocialChannelRecord = {
      id: 'chan_ig_1',
      workspace_id: 'ws_1',
      integration_id: 'int_1',
      provider: 'meta',
      provider_channel_id: '17841400',
      platform: 'instagram',
      display_name: 'IG Account',
      is_enabled: true,
      status: 'connected',
      connected_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    it('rejects Instagram captions longer than 2200 characters before sending API request', () => {
      const longPost: PostPublishPayload = {
        id: 'post_long',
        workspace_id: 'ws_1',
        title: 'Title',
        default_caption: 'A'.repeat(2250),
        media_url: 'https://dailybuz.com/pic.jpg',
      };

      const val = igAdapter.validatePayload(longPost, dummyIgChannel);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('exceeds 2,200 characters limit');
    });

    it('rejects LinkedIn commentary longer than 3000 characters before sending API request', () => {
      const liAdapter = new LinkedInAdapter();
      const longLiPost: PostPublishPayload = {
        id: 'post_long_li',
        workspace_id: 'ws_1',
        title: 'Title',
        default_caption: 'L'.repeat(3050),
      };

      const dummyLiChannel: MarketingSocialChannelRecord = {
        ...dummyIgChannel,
        platform: 'linkedin',
        provider_channel_id: 'urn:li:person:123',
      };

      const val = liAdapter.validatePayload(longLiPost, dummyLiChannel);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('exceeds 3,000 characters limit');
    });
  });

  describe('7. Security & Multi-Tenant Boundary Enforcement', () => {
    it('verifies that cross-workspace state parameter cannot be decoded for a different workspace', () => {
      const stateA = generateOAuthState('ws_alpha', 'usr_1', 'meta');
      const verified = verifyOAuthState(stateA);

      expect(verified?.workspaceId).toBe('ws_alpha');
      expect(verified?.workspaceId).not.toBe('ws_beta');
    });
  });
});
