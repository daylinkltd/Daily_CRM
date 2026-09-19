import { SOCIAL_CONFIG } from '../config';
import type {
  SocialPlatformAdapter,
  PostPublishPayload,
  MarketingSocialChannelRecord,
  PlatformExecutionResult,
  ErrorClassification,
  ReconciliationMatch,
} from '../types';

export class LinkedInAdapter implements SocialPlatformAdapter {
  platform = 'linkedin' as const;

  validatePayload(
    post: PostPublishPayload,
    channel: MarketingSocialChannelRecord
  ): { valid: boolean; error?: string } {
    const override = post.platform_overrides?.['linkedin'];
    const commentary = override?.caption || (post.title ? `${post.title}\n\n${post.default_caption}` : post.default_caption) || '';
    const mediaUrl = override?.media_url || post.media_url;

    if (!commentary.trim() && !mediaUrl) {
      return {
        valid: false,
        error: 'LinkedIn post must contain either commentary text or an image attachment.',
      };
    }

    if (commentary.length > 3000) {
      return {
        valid: false,
        error: `LinkedIn commentary exceeds 3,000 characters limit (${commentary.length} characters).`,
      };
    }

    return { valid: true };
  }

  async publishPost(params: {
    post: PostPublishPayload;
    channel: MarketingSocialChannelRecord;
    accessToken: string;
  }): Promise<PlatformExecutionResult> {
    const { post, channel, accessToken } = params;
    const authorUrn = channel.provider_channel_id; // e.g. "urn:li:person:..." or "urn:li:organization:..."
    const override = post.platform_overrides?.['linkedin'];
    const commentary = override?.caption || (post.title ? `${post.title}\n\n${post.default_caption}` : post.default_caption);
    const mediaUrl = override?.media_url || post.media_url;
    const mediaType = post.media_type || (mediaUrl ? 'image' : 'none');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Linkedin-Version': SOCIAL_CONFIG.linkedin.apiVersion,
      'X-Restli-Protocol-Version': SOCIAL_CONFIG.linkedin.restliProtocolVersion,
      'Content-Type': 'application/json',
    };

    try {
      let imageUrn: string | null = null;

      // 1. If image is provided, upload image to LinkedIn REST Images API
      if (mediaUrl && mediaType === 'image') {
        imageUrn = await this.uploadImageToLinkedIn({
          authorUrn,
          imageUrl: mediaUrl,
          headers,
        });
      }

      // 2. Build LinkedIn /rest/posts payload
      const postPayload: Record<string, any> = {
        author: authorUrn,
        commentary: commentary.trim(),
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };

      if (imageUrn) {
        postPayload.content = {
          media: {
            id: imageUrn,
            title: post.title || 'Marketing Post',
          },
        };
      }

      const res = await fetch(`${SOCIAL_CONFIG.linkedin.apiBaseUrl}/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(postPayload),
      });

      const responseText = await res.text();
      let responseData: any = {};
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch {}

      if (!res.ok) {
        throw {
          status: res.status,
          message: responseData.message || `LinkedIn API error (HTTP ${res.status})`,
          rawResponse: responseData,
        };
      }

      // LinkedIn returns the new Post URN in the x-restli-id header (or response JSON)
      const restliId = res.headers.get('x-restli-id') || responseData.id || `urn:li:share:${Date.now()}`;
      const postUrn = restliId.startsWith('urn:') ? restliId : `urn:li:share:${restliId}`;

      return {
        success: true,
        status: 'published',
        externalPostId: postUrn,
        externalPostUrl: `https://www.linkedin.com/feed/update/${postUrn}`,
        rawResponseSnippet: { id: postUrn },
      };
    } catch (err: any) {
      console.error('[LinkedInAdapter] Publish error:', err);
      const classified = this.classifyLinkedInError(err);
      return {
        success: false,
        status: classified.status,
        errorClassification: classified.classification,
        lastErrorCode: String(err.status || err.code || 'UNKNOWN'),
        lastErrorMessage: err.message || 'Failed to publish post to LinkedIn',
        reconciliationRequired: classified.status === 'unknown',
        rawResponseSnippet: err.rawResponse || null,
      };
    }
  }

  // --- Upload Image to LinkedIn REST API ---
  private async uploadImageToLinkedIn(params: {
    authorUrn: string;
    imageUrl: string;
    headers: Record<string, string>;
  }): Promise<string> {
    const { authorUrn, imageUrl, headers } = params;

    // Step A: Initialize upload
    const initRes = await fetch(`${SOCIAL_CONFIG.linkedin.apiBaseUrl}/images?action=initializeUpload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
        },
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok || !initData.value?.uploadUrl || !initData.value?.image) {
      throw {
        status: initRes.status,
        message: 'Failed to initialize LinkedIn image upload',
        rawResponse: initData,
      };
    }

    const { uploadUrl, image: imageUrn } = initData.value;

    // Step B: Fetch source image buffer & upload binary to LinkedIn uploadUrl
    const mediaFetchRes = await fetch(imageUrl);
    if (!mediaFetchRes.ok) {
      throw {
        status: 400,
        message: `Could not download image from ${imageUrl} (${mediaFetchRes.status})`,
      };
    }

    const imageBuffer = await mediaFetchRes.arrayBuffer();
    const contentType = mediaFetchRes.headers.get('content-type') || 'application/octet-stream';

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok) {
      throw {
        status: uploadRes.status,
        message: `Failed to upload image binary to LinkedIn (${uploadRes.status})`,
      };
    }

    return imageUrn; // e.g. "urn:li:image:C5622AQ..."
  }

  // --- Reconciliation Lookup ---
  async reconcileUnknownPost(params: {
    post: PostPublishPayload;
    channel: MarketingSocialChannelRecord;
    accessToken: string;
  }): Promise<ReconciliationMatch> {
    const { post, channel, accessToken } = params;
    const commentary = (
      post.platform_overrides?.['linkedin']?.caption ||
      (post.title && post.default_caption ? `${post.title}\n\n${post.default_caption}` : post.default_caption || post.title) ||
      ''
    ).trim();

    try {
      const authorEncoded = encodeURIComponent(channel.provider_channel_id);
      const res = await fetch(
        `${SOCIAL_CONFIG.linkedin.apiBaseUrl}/posts?author=${authorEncoded}&count=5&sortBy=CREATED_TIME`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Linkedin-Version': SOCIAL_CONFIG.linkedin.apiVersion,
            'X-Restli-Protocol-Version': SOCIAL_CONFIG.linkedin.restliProtocolVersion,
          },
        }
      );

      if (!res.ok) return { found: false, confidence: 'none' };
      const data = await res.json();
      const elements = data.elements || [];

      for (const item of elements) {
        if (item.commentary && item.commentary.trim().startsWith(commentary.slice(0, 50))) {
          return {
            found: true,
            externalPostId: item.id,
            externalPostUrl: `https://www.linkedin.com/feed/update/${item.id}`,
            confidence: 'high',
            matchReason: 'Matched recent LinkedIn post commentary on author feed',
          };
        }
      }
    } catch (err) {
      console.error('[LinkedInAdapter] Reconciliation check failed:', err);
    }

    return { found: false, confidence: 'none' };
  }

  private classifyLinkedInError(err: any): { classification: ErrorClassification; status: 'failed' | 'unknown' } {
    const status = Number(err.status || 0);
    const msg = String(err.message || '').toLowerCase();

    if (status === 401 || msg.includes('unauthorized') || msg.includes('token expired') || msg.includes('revoked')) {
      return { classification: 'authentication', status: 'failed' };
    }

    if (status === 403 || msg.includes('permission') || msg.includes('scope') || msg.includes('forbidden')) {
      return { classification: 'authorization', status: 'failed' };
    }

    if (status === 429 || msg.includes('throttle') || msg.includes('rate limit')) {
      return { classification: 'rate_limit', status: 'failed' };
    }

    if (msg.includes('image') || msg.includes('media') || msg.includes('resolution')) {
      return { classification: 'media', status: 'failed' };
    }

    if (err.name === 'AbortError' || msg.includes('timeout') || msg.includes('econnreset') || status === 504) {
      return { classification: 'unknown', status: 'unknown' };
    }

    if (status >= 500) {
      return { classification: 'temporary', status: 'failed' };
    }

    return { classification: 'validation', status: 'failed' };
  }
}
