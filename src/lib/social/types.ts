/**
 * Strict TypeScript models and interfaces for DailyBuz Native Social Publishing Engine.
 */

export type NativeSocialPlatform = 'facebook' | 'instagram' | 'linkedin';

export type PlatformPublishStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'unknown'
  | 'reconciling';

export type ErrorClassification =
  | 'validation'       // Invalid media, payload or missing parameters -> No automatic retry
  | 'authentication'   // Expired/revoked token -> Mark channel as needs_reconnection
  | 'authorization'    // Missing required scope/page role -> No automatic retry
  | 'rate_limit'       // Platform rate limit reached (HTTP 429) -> Exponential backoff retry
  | 'temporary'        // 5xx server error / network socket reset -> Automatic retry up to 3 times
  | 'media'            // Incompatible aspect ratio, codec or format -> No retry until media fixed
  | 'provider'         // Platform explicitly rejected content -> No retry
  | 'unknown';         // Timeout / unhandled response -> Requires reconciliation lookup

export interface PlatformResult {
  channelId: string;
  platform: NativeSocialPlatform;
  status: PlatformPublishStatus;
  attemptCount: number;
  startedAt?: string;
  completedAt?: string;
  externalPostId?: string;
  externalPostUrl?: string;
  errorClassification?: ErrorClassification;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastAttemptAt?: string;
  providerRequestId?: string;
  reconciliationRequired?: boolean;
  rawResponseSnippet?: Record<string, unknown>;
}

export interface MarketingSocialChannelRecord {
  id: string;
  workspace_id: string;
  integration_id: string;
  provider: string; // 'meta' | 'facebook' | 'instagram' | 'linkedin' | 'buffer'
  provider_channel_id: string; // Facebook Page ID, Instagram IG User ID, LinkedIn URN
  provider_organization_id?: string | null;
  platform: NativeSocialPlatform | string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
  external_url?: string | null;
  is_enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'paused';
  account_type?: 'page' | 'instagram_business' | 'profile' | 'organization' | null;
  page_access_token_encrypted?: string | null;
  token_expires_at?: string | null;
  raw_metadata?: Record<string, unknown> | null;
  connected_at: string;
  last_synced_at: string;
}

export interface MarketingIntegrationRecord {
  id: string;
  workspace_id: string;
  provider: string; // 'meta' | 'linkedin'
  provider_account_id?: string | null;
  provider_account_name?: string | null;
  provider_account_email?: string | null;
  access_token_encrypted?: string | null;
  refresh_token_encrypted?: string | null;
  token_expires_at?: string | null;
  scopes?: string[] | null;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  last_error?: string | null;
}

export interface PostPublishPayload {
  id: string;
  workspace_id: string;
  title: string;
  default_caption: string;
  short_caption?: string | null;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'none' | null;
  hashtags?: string[] | null;
  platform_overrides?: Record<string, { caption?: string; media_url?: string }> | null;
  scheduled_at?: string | null;
  target_channel_ids?: string[] | null;
  channels?: string[] | null;
  platform_results?: Record<string, PlatformResult> | null;
  external_post_ids?: Record<string, string> | null;
}

export interface PlatformExecutionResult {
  success: boolean;
  status: PlatformPublishStatus;
  externalPostId?: string;
  externalPostUrl?: string;
  errorClassification?: ErrorClassification;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  providerRequestId?: string;
  reconciliationRequired?: boolean;
  rawResponseSnippet?: Record<string, unknown>;
}

export interface ReconciliationMatch {
  found: boolean;
  externalPostId?: string;
  externalPostUrl?: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchReason?: string;
}

export interface SocialPlatformAdapter {
  platform: NativeSocialPlatform;
  validatePayload(payload: PostPublishPayload, channel: MarketingSocialChannelRecord): { valid: boolean; error?: string };
  publishPost(params: {
    post: PostPublishPayload;
    channel: MarketingSocialChannelRecord;
    accessToken: string;
  }): Promise<PlatformExecutionResult>;
  reconcileUnknownPost?(params: {
    post: PostPublishPayload;
    channel: MarketingSocialChannelRecord;
    accessToken: string;
  }): Promise<ReconciliationMatch>;
}
