import { SOCIAL_CONFIG } from '../config';
import type {
  SocialPlatformAdapter,
  NativeSocialPlatform,
  PostPublishPayload,
  MarketingSocialChannelRecord,
  PlatformExecutionResult,
  ErrorClassification,
  ReconciliationMatch,
} from '../types';

export class MetaGraphAdapter implements SocialPlatformAdapter {
  platform: NativeSocialPlatform;

  constructor(platform: 'facebook' | 'instagram') {
    this.platform = platform;
  }

  validatePayload(
    post: PostPublishPayload,
    channel: MarketingSocialChannelRecord
  ): { valid: boolean; error?: string } {
    const override = post.platform_overrides?.[this.platform];
    const caption = override?.caption || post.default_caption || post.title || '';
    const mediaUrl = override?.media_url || post.media_url;

    if (this.platform === 'instagram') {
      if (!mediaUrl) {
        return {
          valid: false,
          error: 'Instagram requires an image or video asset. Text-only posts are not supported.',
        };
      }
      if (caption.length > 2200) {
        return {
          valid: false,
          error: `Instagram caption exceeds 2,200 characters limit (${caption.length} characters).`,
        };
      }
    } else {
      // Facebook
      if (!caption && !mediaUrl) {
        return {
          valid: false,
          error: 'Facebook post must have either text content or a media attachment.',
        };
      }
      if (caption.length > 63206) {
        return {
          valid: false,
          error: `Facebook post exceeds character limit (${caption.length} characters).`,
        };
      }
    }

    return { valid: true };
  }

  async publishPost(params: {
    post: PostPublishPayload;
    channel: MarketingSocialChannelRecord;
    accessToken: string;
  }): Promise<PlatformExecutionResult> {
    const { post, channel, accessToken } = params;
    const override = post.platform_overrides?.[this.platform];
    const caption = override?.caption || (post.title ? `${post.title}\n\n${post.default_caption}` : post.default_caption);
    const mediaUrl = override?.media_url || post.media_url;
    const mediaType = post.media_type || (mediaUrl ? 'image' : 'none');

    try {
      if (this.platform === 'facebook') {
        return await this.publishToFacebookPage({
          pageId: channel.provider_channel_id,
          caption,
          mediaUrl,
          mediaType,
          accessToken,
        });
      } else {
        return await this.publishToInstagramProfessional({
          igUserId: channel.provider_channel_id,
          caption,
          mediaUrl: mediaUrl!,
          mediaType,
          accessToken,
        });
      }
    } catch (err: any) {
      console.error(`[MetaGraphAdapter:${this.platform}] Publish error:`, err);
      const classified = this.classifyMetaError(err);
      return {
        success: false,
        status: classified.status,
        errorClassification: classified.classification,
        lastErrorCode: String(err.code || err.status || 'UNKNOWN'),
        lastErrorMessage: err.message || 'Failed to publish via Meta Graph API',
        reconciliationRequired: classified.status === 'unknown',
        rawResponseSnippet: err.rawResponse || null,
      };
    }
  }

  // --- Facebook Page Publishing ---
  private async publishToFacebookPage(params: {
    pageId: string;
    caption: string;
    mediaUrl?: string | null;
    mediaType: string;
    accessToken: string;
  }): Promise<PlatformExecutionResult> {
    const { pageId, caption, mediaUrl, mediaType, accessToken } = params;
    let endpoint = `${SOCIAL_CONFIG.meta.baseUrl}/${pageId}/feed`;
    let body: Record<string, string> = { access_token: accessToken };

    if (mediaUrl && mediaType === 'image') {
      endpoint = `${SOCIAL_CONFIG.meta.baseUrl}/${pageId}/photos`;
      body = {
        url: mediaUrl,
        caption,
        access_token: accessToken,
      };
    } else if (mediaUrl && mediaType === 'video') {
      endpoint = `${SOCIAL_CONFIG.meta.baseUrl}/${pageId}/videos`;
      body = {
        file_url: mediaUrl,
        description: caption,
        access_token: accessToken,
      };
    } else {
      body = {
        message: caption,
        access_token: accessToken,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const errorObj = data.error || { message: `HTTP error ${res.status}` };
      throw { ...errorObj, status: res.status, rawResponse: data };
    }

    const externalId = data.id || data.post_id;
    return {
      success: true,
      status: 'published',
      externalPostId: externalId,
      externalPostUrl: `https://facebook.com/${externalId}`,
      rawResponseSnippet: { id: externalId },
    };
  }

  // --- Instagram 2-Step Asynchronous Container Publishing ---
  private async publishToInstagramProfessional(params: {
    igUserId: string;
    caption: string;
    mediaUrl: string;
    mediaType: string;
    accessToken: string;
  }): Promise<PlatformExecutionResult> {
    const { igUserId, caption, mediaUrl, mediaType, accessToken } = params;

    // Step 1: Create Media Container
    const containerUrl = `${SOCIAL_CONFIG.meta.baseUrl}/${igUserId}/media`;
    const containerPayload: Record<string, string> = {
      caption,
      access_token: accessToken,
    };

    if (mediaType === 'video') {
      containerPayload.media_type = 'REELS';
      containerPayload.video_url = mediaUrl;
    } else {
      containerPayload.image_url = mediaUrl;
    }

    const createRes = await fetch(containerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerPayload),
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.id) {
      const errorObj = createData.error || { message: `Instagram container creation failed (${createRes.status})` };
      throw { ...errorObj, status: createRes.status, rawResponse: createData };
    }

    const containerId = createData.id;

    // Step 2: Poll Container Status (especially for video transcoding or image ingest)
    let isReady = false;
    const { initialDelayMs, stepDelayMs, maxAttempts } = SOCIAL_CONFIG.meta.containerPoll;
    await new Promise((r) => setTimeout(r, initialDelayMs));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const statusRes = await fetch(
        `${SOCIAL_CONFIG.meta.baseUrl}/${containerId}?fields=status_code,status&access_token=${accessToken}`
      );
      const statusData = await statusRes.json();

      if (statusData.status_code === 'FINISHED') {
        isReady = true;
        break;
      }

      if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
        throw {
          code: 'INSTAGRAM_CONTAINER_ERROR',
          message: `Instagram media processing failed with status: ${statusData.status_code}`,
          rawResponse: statusData,
        };
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, stepDelayMs));
      }
    }

    if (!isReady) {
      // Container poll timeout -> mark as unknown requiring reconciliation
      return {
        success: false,
        status: 'unknown',
        errorClassification: 'unknown',
        lastErrorCode: 'CONTAINER_POLL_TIMEOUT',
        lastErrorMessage: `Instagram media container ${containerId} processing timed out. Reconciling post status before retrying.`,
        providerRequestId: containerId,
        reconciliationRequired: true,
      };
    }

    // Step 3: Publish Container
    const publishRes = await fetch(`${SOCIAL_CONFIG.meta.baseUrl}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      const errorObj = publishData.error || { message: 'Failed to publish Instagram container' };
      throw { ...errorObj, status: publishRes.status, rawResponse: publishData };
    }

    const igPostId = publishData.id;
    return {
      success: true,
      status: 'published',
      externalPostId: igPostId,
      externalPostUrl: `https://instagram.com/p/${igPostId}`,
      providerRequestId: containerId,
      rawResponseSnippet: { id: igPostId },
    };
  }

  // --- Reconciliation Lookup for UNKNOWN states ---
  async reconcileUnknownPost(params: {
    post: PostPublishPayload;
    channel: MarketingSocialChannelRecord;
    accessToken: string;
  }): Promise<ReconciliationMatch> {
    const { post, channel, accessToken } = params;
    const targetCaption = (
      post.platform_overrides?.[this.platform]?.caption ||
      (post.title && post.default_caption ? `${post.title}\n\n${post.default_caption}` : post.default_caption || post.title) ||
      ''
    ).trim();

    try {
      if (this.platform === 'facebook') {
        const res = await fetch(
          `${SOCIAL_CONFIG.meta.baseUrl}/${channel.provider_channel_id}/feed?fields=id,message,created_time&limit=5&access_token=${accessToken}`
        );
        if (!res.ok) return { found: false, confidence: 'none' };
        const data = await res.json();
        const items = data.data || [];

        for (const item of items) {
          if (item.message && item.message.trim().startsWith(targetCaption.slice(0, 50))) {
            return {
              found: true,
              externalPostId: item.id,
              externalPostUrl: `https://facebook.com/${item.id}`,
              confidence: 'high',
              matchReason: 'Matched recent Facebook Page post message and timestamp',
            };
          }
        }
      } else if (this.platform === 'instagram') {
        const res = await fetch(
          `${SOCIAL_CONFIG.meta.baseUrl}/${channel.provider_channel_id}/media?fields=id,caption,timestamp,permalink&limit=5&access_token=${accessToken}`
        );
        if (!res.ok) return { found: false, confidence: 'none' };
        const data = await res.json();
        const items = data.data || [];

        for (const item of items) {
          if (item.caption && item.caption.trim().startsWith(targetCaption.slice(0, 50))) {
            return {
              found: true,
              externalPostId: item.id,
              externalPostUrl: item.permalink || `https://instagram.com/p/${item.id}`,
              confidence: 'high',
              matchReason: 'Matched recent Instagram media item caption',
            };
          }
        }
      }
    } catch (e) {
      console.error(`[MetaGraphAdapter:${this.platform}] Reconciliation lookup failed:`, e);
    }

    return { found: false, confidence: 'none' };
  }

  private classifyMetaError(err: any): { classification: ErrorClassification; status: 'failed' | 'unknown' } {
    const code = Number(err.code || err.error_subcode || 0);
    const msg = String(err.message || '').toLowerCase();

    // Authentication / Token Revocation
    if ([190, 102, 463, 467].includes(code) || msg.includes('token expired') || msg.includes('invalid access token')) {
      return { classification: 'authentication', status: 'failed' };
    }

    // Authorization / Missing permissions
    if ([200, 201, 202, 298, 10].includes(code) || msg.includes('permission') || msg.includes('not authorized')) {
      return { classification: 'authorization', status: 'failed' };
    }

    // Rate Limiting
    if ([4, 17, 32, 613].includes(code) || msg.includes('rate limit') || msg.includes('too many calls')) {
      return { classification: 'rate_limit', status: 'failed' };
    }

    // Media / Format errors
    if (msg.includes('aspect ratio') || msg.includes('image resolution') || msg.includes('media') || msg.includes('codec')) {
      return { classification: 'media', status: 'failed' };
    }

    // Platform content rejection
    if (code === 368 || msg.includes('spam') || msg.includes('blocked')) {
      return { classification: 'provider', status: 'failed' };
    }

    // Network timeout / connection reset
    if (err.name === 'AbortError' || msg.includes('timeout') || msg.includes('econnreset') || err.status === 504) {
      return { classification: 'unknown', status: 'unknown' };
    }

    if (err.status >= 500) {
      return { classification: 'temporary', status: 'failed' };
    }

    return { classification: 'validation', status: 'failed' };
  }
}
