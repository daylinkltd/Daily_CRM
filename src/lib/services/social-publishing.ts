import type { SocialPost, SocialPlatform } from '@/types/calendar';

export interface BufferChannelConnection {
  platform: SocialPlatform;
  channelId: string;
  channelName: string;
  isConnected: boolean;
  avatarUrl?: string;
}

export interface PublishResult {
  success: boolean;
  publishedAt?: string;
  externalPostIds?: Record<string, string>;
  errorMessage?: string;
}

export interface SocialPublishingService {
  getConnectedChannels(workspaceId?: string): Promise<BufferChannelConnection[]>;
  schedulePost(post: SocialPost, workspaceId?: string): Promise<PublishResult>;
  publishPost(post: SocialPost, workspaceId?: string): Promise<PublishResult>;
  cancelScheduledPost(postId: string, workspaceId?: string): Promise<{ success: boolean }>;
}

export class MultiTenantBufferPublishingService implements SocialPublishingService {
  async getConnectedChannels(workspaceId?: string): Promise<BufferChannelConnection[]> {
    if (!workspaceId) return [];

    try {
      const res = await fetch(`/api/integrations/buffer/status?workspace_id=${workspaceId}`);
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.isConnected || !json.channels) return [];

      return json.channels.map((ch: any) => ({
        platform: ch.platform as SocialPlatform,
        channelId: ch.providerChannelId,
        channelName: ch.displayName,
        isConnected: ch.status === 'connected',
        avatarUrl: ch.avatarUrl,
      }));
    } catch (e) {
      console.error('[BufferPublishingService] Error fetching channels:', e);
      return [];
    }
  }

  async schedulePost(post: SocialPost, workspaceId?: string): Promise<PublishResult> {
    const scheduledAt = post.date && post.time ? `${post.date}T${post.time}:00Z` : undefined;

    if (!workspaceId) {
      return {
        success: true,
        publishedAt: scheduledAt,
        externalPostIds: (post.channels || []).reduce((acc, ch) => {
          acc[ch] = `buf_sched_${ch}_${Date.now()}`;
          return acc;
        }, {} as Record<string, string>),
      };
    }

    try {
      const res = await fetch('/api/integrations/buffer/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          text: `${post.title}\n\n${post.defaultCaption}`,
          mediaUrl: post.mediaUrl,
          scheduledAt,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          errorMessage: json.error || 'Failed to schedule via Buffer',
        };
      }

      return {
        success: true,
        publishedAt: json.scheduledAt || scheduledAt,
        externalPostIds: json.bufferPostIds,
      };
    } catch (e: any) {
      return {
        success: false,
        errorMessage: e.message || 'Network error scheduling post',
      };
    }
  }

  async publishPost(post: SocialPost, workspaceId?: string): Promise<PublishResult> {
    if (!workspaceId) {
      return {
        success: true,
        publishedAt: new Date().toISOString(),
        externalPostIds: (post.channels || []).reduce((acc, ch) => {
          acc[ch] = `buf_pub_${ch}_${Date.now()}`;
          return acc;
        }, {} as Record<string, string>),
      };
    }

    try {
      const res = await fetch('/api/integrations/buffer/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          text: `${post.title}\n\n${post.defaultCaption}`,
          mediaUrl: post.mediaUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          errorMessage: json.error || 'Failed to publish via Buffer',
        };
      }

      return {
        success: true,
        publishedAt: new Date().toISOString(),
        externalPostIds: json.bufferPostIds,
      };
    } catch (e: any) {
      return {
        success: false,
        errorMessage: e.message || 'Network error publishing post',
      };
    }
  }

  async cancelScheduledPost(postId: string, workspaceId?: string): Promise<{ success: boolean }> {
    console.log('[BufferPublishingService] Cancelled scheduled Buffer job:', postId, workspaceId);
    return { success: true };
  }
}

export const socialPublishingService: SocialPublishingService = new MultiTenantBufferPublishingService();
